#!/usr/bin/env bash
# Chạy trên máy chủ EC2, do GitHub Actions gọi qua SSH (hoặc tự chạy tay).
#   ./deploy.sh deploy <backend_image> <frontend_image> <tools_image> <commit> <registry_user>
#       (token đọc GHCR đưa vào qua stdin, không để trên dòng lệnh)
#   ./deploy.sh rollback      quay về bản đã deploy thành công gần nhất
set -euo pipefail
cd "$(dirname "$0")"

[[ -f .env ]] || { echo "Thiếu file .env trên máy chủ (xem hướng dẫn cài đặt lần đầu)"; exit 1; }
set -a; . ./.env; set +a

dc() { docker compose --env-file .env --env-file release.env -f docker-compose.prod.yml "$@"; }

rollback() {
  if [[ ! -f release.good.env ]]; then
    echo "Chưa có bản nào deploy thành công trước đó, không có gì để quay về."
    return 1
  fi
  cp release.good.env release.env
  if ! dc up -d --remove-orphans --wait --wait-timeout 240; then
    echo "::error::Rollback failed: previous release did not become healthy" >&2
    return 1
  fi
  if ! api_ok; then
    echo "::error::Rollback failed: previous API health check failed" >&2
    return 1
  fi
  rm -f release.pending.env
  echo "Đã quay về bản: $(grep '^RELEASE_COMMIT=' release.env)"
}

api_ok() {
  dc exec -T backend node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
}

deploy() {
  [[ ! -f release.pending.env ]] || { echo "Unconfirmed release exists: confirm or rollback first" >&2; return 1; }
  local backend=$1 frontend=$2 tools=$3 commit=$4 reg_user=$5
  local token; token=$(cat)

  # Đăng nhập GHCR bằng thư mục cấu hình tạm, xong là xóa
  DOCKER_CONFIG=$(mktemp -d); export DOCKER_CONFIG
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true; rm -rf "$DOCKER_CONFIG"' EXIT
  printf '%s' "$token" | docker login ghcr.io -u "$reg_user" --password-stdin

  cat > release.env <<EOT
BACKEND_IMAGE=$backend
FRONTEND_IMAGE=$frontend
TOOLS_IMAGE=$tools
RELEASE_COMMIT=$commit
EOT

  echo "==> Kéo image"
  dc --profile setup pull

  echo "==> Bật database"
  dc up -d --wait db

  # Sao lưu trước khi đổi cấu trúc bảng (bỏ qua ở lần đầu vì chưa có bảng)
  mkdir -p backups
  tables=$(dc exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='Product'")
  if [[ "$tables" == "1" ]]; then
    echo "==> Sao lưu database"
    dc exec -T db pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "backups/pre-${commit:0:12}-$(date -u +%Y%m%dT%H%M%SZ).dump"
    ls -1t backups/*.dump | tail -n +6 | xargs -r rm -f
  fi

  echo "==> Chạy migration (nếu lỗi thì dừng, app cũ vẫn chạy)"
  dc --profile setup run --rm migrate

  # Seed chỉ chạy khi chưa có sản phẩm, vì seed sẽ đặt lại kho nguyên liệu
  products=$(dc exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SELECT count(*) FROM "Product"')
  if [[ "$products" == "0" ]]; then
    echo "==> Database trống, nạp dữ liệu mẫu"
    dc --profile setup run --rm seed
  fi

  echo "==> Bật app"
  if ! dc up -d --remove-orphans --wait --wait-timeout 240; then
    echo "::error::App không khỏe sau khi bật, đang quay về bản trước"
    rollback || true
    exit 1
  fi

  echo "==> Smoke test nội bộ: GET /health"
  if ! api_ok; then
    echo "::error::/health không đạt, đang quay về bản trước"
    rollback || true
    exit 1
  fi

  # Internal health is necessary, but public HTTPS smoke has not run yet.
  cp release.env release.pending.env
  echo "==> Awaiting public HTTPS confirmation: $commit"
}

# Called only after the runner has verified public HTTPS for this commit.
confirm() {
  local expected=${1:?Expected commit is required}
  [[ -f release.pending.env ]] || { echo "No pending release" >&2; return 1; }
  [[ "$(sed -n 's/^RELEASE_COMMIT=//p' release.pending.env)" == "$expected" ]] || {
    echo "Pending commit mismatch" >&2; return 1;
  }
  cmp -s release.env release.pending.env || { echo "Active release changed" >&2; return 1; }
  api_ok || { echo "API unhealthy at confirmation" >&2; return 1; }
  # Preserve the old good file until a same-directory atomic rename succeeds.
  cp release.pending.env release.good.env.tmp
  mv -f release.good.env.tmp release.good.env
  rm -f release.pending.env
  echo "==> Confirmed release: $expected"
}

case "${1:-}" in
  deploy)   shift; deploy "$@" ;;
  rollback) rollback ;;
  confirm) shift; confirm "$@" ;;
  *) echo "Cách dùng: $0 deploy <backend> <frontend> <tools> <commit> <registry_user> | $0 rollback | $0 confirm <commit>"; exit 2 ;;
esac
