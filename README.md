# BrewLite

Ứng dụng đặt đồ uống dành cho quán nhỏ và vừa: khách chọn món, thanh toán online và nhận tại quầy; barista tiếp nhận đơn, cập nhật pha chế và xử lý yêu cầu đổi món.

Backend dùng NestJS và PostgreSQL/Prisma; frontend dùng Next.js. Thanh toán tích hợp **VNPay Sandbox**, phục vụ thử nghiệm, không thu tiền thật.

## Mục lục

- [Phiên bản production và nghiệm thu](#phiên-bản-production-và-nghiệm-thu)
- [Chức năng](#chức-năng)
- [Công nghệ và cấu trúc](#công-nghệ-và-cấu-trúc)
- [Chuẩn bị](#chuẩn-bị)
- [Chạy lần đầu bằng Docker](#chạy-lần-đầu-bằng-docker)
- [Chạy lại và cập nhật](#chạy-lại-và-cập-nhật)
- [Chạy chế độ phát triển](#chạy-chế-độ-phát-triển)
- [Thiết lập VNPay Sandbox](#thiết-lập-vnpay-sandbox)
- [Kiểm thử và build](#kiểm-thử-và-build)
- [Sao lưu và thử khôi phục](#sao-lưu-và-thử-khôi-phục)
- [CI/CD và triển khai AWS](#cicd-và-triển-khai-aws)
- [Rollback ứng dụng AWS](#rollback-ứng-dụng-aws)
- [Demo và hồ sơ bàn giao](#demo-và-hồ-sơ-bàn-giao)
- [Xử lý lỗi thường gặp](#xử-lý-lỗi-thường-gặp)
- [Tài liệu và đóng góp](#tài-liệu-và-đóng-góp)

## Phiên bản production và nghiệm thu

| Thành phần | Địa chỉ |
| --- | --- |
| Website HTTPS | https://13.228.196.157 |
| Quầy barista | https://13.228.196.157/barista |
| API sản phẩm | https://13.228.196.157:8443/products |
| API health | https://13.228.196.157:8443/health |
| Mã nguồn | https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE |

Môi trường AWS dùng **thanh toán mô phỏng WALLET/CARD**, không chuyển tiền thật; VNPay Sandbox có thể cấu hình riêng khi chạy local. Tài khoản khách tự đăng ký. Tài khoản barista production được nhóm cấp riêng cho người nghiệm thu, không dùng mật khẩu local mẫu và không công bố thông tin đăng nhập thật trong repo.

Phiên bản đã kiểm chứng ngày 15/11/2026: commit `c3ecfd24fa20de0c9a55fd3a492afc6cba33623e`, [Actions #66](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/actions/runs/43685962677). Cùng lần chạy đạt 16 browser E2E, 10 test release giả lập, publish, deploy, HTTPS smoke và confirm release. Endpoint health trả `status`, `database`, `commit`, `uptimeSeconds`; dùng `commit` để nhận biết bản đang chạy sau mỗi lần cập nhật. IP EC2 có thể thay đổi khi vận hành; nếu đổi IP phải đồng bộ URL trong cấu hình và cập nhật tài liệu.

## Chức năng

- Menu, size, topping, giỏ hàng lưu trên trình duyệt.
- Đăng ký, đăng nhập JWT; phân quyền CUSTOMER và BARISTA.
- Backend tính giá, kiểm tra voucher, ghi nhận điểm thưởng.
- Tạo đơn có idempotency; giữ nguyên liệu trong transaction, kiểm soát đặt đồng thời.
- Định lượng theo size/topping; hoàn nguyên liệu theo snapshot; tự giải phóng đơn hết hạn giữ món.
- VNPay URL/QR, IPN/Return, thanh toán lại và theo dõi khoản thu không áp dụng cho đơn.
- Đổi món sau thanh toán: chọn qua menu, barista duyệt, chuyển giá trị đã trả và thu thêm chênh lệch.
- Hàng đợi quầy, trạng thái pha chế và cập nhật realtime.
- Docker Compose, backup/restore, CI và phát hành Docker image.

Phạm vi hiện tại tập trung đặt và nhận món tại quầy. Giao diện tài xế/điều phối giao hàng và chuyển tiền ngân hàng thật tự động chưa thuộc phạm vi bàn giao.

## Công nghệ và cấu trúc

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, Zustand |
| Backend | NestJS 12, TypeScript, JWT, Socket.IO |
| Database | PostgreSQL 16, Prisma 7 |
| Kiểm thử | Vitest, Supertest, Playwright (Chromium), Node test runner |
| Vận hành | Docker Compose, GitHub Actions, GHCR, AWS EC2, Caddy, Bash/PowerShell |

```text
.
├── backend/                 # API, schema/migration/seed Prisma, test
├── frontend/                # Website khách hàng và quầy barista
├── e2e/                     # Browser E2E Playwright, report/video/trace
├── scripts/database/        # Backup và thử khôi phục database
├── scripts/deploy/          # Triển khai và rollback ứng dụng
├── deploy/                  # AWS production và Compose image phát hành
├── .github/                 # Workflow CI/CD và Dependabot
├── docs/                    # Thiết kế, sơ đồ, tài liệu và bằng chứng kiểm thử
├── Assignment-report/       # Báo cáo tổng, bàn giao riêng (đang ignore)
├── docker-compose.yml       # Môi trường local đầy đủ
└── vnpay.postman_collection.json
```

## Chuẩn bị

**Chạy bằng Docker:** cài Git và Docker Desktop, mở Docker Desktop và chọn Linux containers. Không cần cài Node.js hay PostgreSQL riêng trên máy host.

**Chạy phát triển ngoài Docker:** cần thêm Node.js 24 và npm; PostgreSQL 16 có thể chạy bằng Docker như hướng dẫn bên dưới. Dùng phiên bản dependency trong `package-lock.json`.

Các lệnh dưới dùng **PowerShell trên Windows**. Với Bash, dùng `npm`/`npx` thay `npm.cmd`/`npx.cmd` và tạo file môi trường bằng trình soạn thảo.

```powershell
git clone https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE.git
cd SOFTWARE_ENGINEERING_BREWLITE
docker version
docker compose version
```

Lệnh `docker version` phải có cả Client và Server. Các lệnh Compose chạy tại **thư mục gốc**, nơi có `docker-compose.yml`.

## Chạy lần đầu bằng Docker

### 1. Tạo hai file môi trường

Repo hiện chưa có `.env.docker.example`. Tạo `.env.docker` tại thư mục gốc bằng nội dung mẫu sau:

```dotenv
POSTGRES_USER=brewlite
POSTGRES_PASSWORD=brewlite_local_dev
POSTGRES_DB=brewlite
DB_PORT=5432
API_PORT=3001
WEB_PORT=3000
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Tạo `backend/.env`:

```powershell
Copy-Item backend/.env.example backend/.env
```

Mở file vừa tạo và điền đầy đủ:

```dotenv
DATABASE_URL="postgresql://brewlite:brewlite_local_dev@localhost:5432/brewlite?schema=public"
JWT_SECRET="thay-bang-chuoi-ngau-nhien-dai-rieng-cua-ban"
PORT=3001
FRONTEND_URL=http://localhost:3000

# Chạy thử local chưa cần tài khoản VNPay
VNPAY_ENABLED=false
PAYMENT_MOCK_ENABLED=true

ORDER_RESERVATION_MINUTES=30
ORDER_EXPIRY_WORKER_ENABLED=true

BARISTA_EMAIL=barista@brewlite.local
BARISTA_PASSWORD=barista123
```

Mật khẩu ở trên là dữ liệu mẫu cho local. Đổi `JWT_SECRET` và mật khẩu khi chia sẻ môi trường. Có thể tạo chuỗi ngẫu nhiên bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` nếu máy có Node.js.

`.env.docker` dùng cho Compose; `backend/.env` dùng cho ứng dụng và Prisma CLI. Khi chạy container, Compose thay `DATABASE_URL` bằng địa chỉ nội bộ `db:5432`; khi chạy backend trực tiếp, dùng `localhost` và cổng DB đã cấu hình. Mật khẩu có ký tự đặc biệt cần URL-encode khi đặt vào connection URL.

Không commit file môi trường thật. Hai file này đã được `.gitignore` loại trừ.

### 2. Khởi tạo schema và dữ liệu mẫu

Chỉ thực hiện trên **database mới, trống**:

```powershell
docker compose --env-file .env.docker --profile setup run --build --rm migrate
docker compose --env-file .env.docker --profile setup run --build --rm seed
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

Chạy từng lệnh, chỉ tiếp tục khi lệnh trước thành công. `migrate` và `seed` tự khởi động DB cần thiết. Lần build đầu cần Internet để tải image, package và tài nguyên font.

**Không chạy lại seed trên dữ liệu đang sử dụng:** seed cập nhật sản phẩm, công thức và đặt lại tồn kho một số nguyên liệu. Không dùng `prisma migrate reset` hoặc `docker compose down -v` để sửa lỗi trên database cần giữ dữ liệu.

### 3. Truy cập

| Dịch vụ | Địa chỉ mặc định |
| --- | --- |
| Website | http://localhost:3000 |
| Quầy barista | http://localhost:3000/barista |
| API danh sách sản phẩm | http://localhost:3001/products |
| API health | http://localhost:3001/health |
| Cấu hình chế độ thanh toán công khai | http://localhost:3001/payments/vnpay/config |
| PostgreSQL | `localhost:5432`, database/user `brewlite` |

Đăng nhập quầy bằng `barista@brewlite.local` / `barista123` nếu giữ cấu hình mẫu khi seed. Khách hàng tự đăng ký trên website; seed không tạo sẵn tài khoản khách.

Seed tạo bốn sản phẩm và voucher `BREW10` giảm 10%. Hai nguyên liệu topping được khởi tạo với **stock = 0**; muốn thử món có topping, cần nhập tồn kho cho chúng. Khi seed lại, `BARISTA_PASSWORD` chỉ dùng cho tài khoản mới, không thay mật khẩu tài khoản barista đã tồn tại.

Trong pgAdmin, đăng ký server bằng host `localhost`, port `5432`, database/user/mật khẩu theo `.env.docker`. Đây là DB trong Docker nếu cổng đó được container ánh xạ; cài pgAdmin không yêu cầu cài thêm một PostgreSQL server.

## Chạy lại và cập nhật

Sau khi đã khởi tạo lần đầu, khởi động bằng:

```powershell
docker compose --env-file .env.docker up -d
```

Sau khi sửa/pull mã nguồn cần build lại:

```powershell
git pull
docker compose --env-file .env.docker up -d --build
```

Nếu bản cập nhật có migration mới, sao lưu trước, chạy service `migrate`, sau đó khởi động ứng dụng. Migration đã áp dụng không được sửa để buộc chạy lại; với database cũ đã tạo bảng thủ công, cần đối chiếu schema và lịch sử migration trước khi áp dụng.

Các lệnh vận hành:

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 100 backend frontend
docker compose --env-file .env.docker logs -f backend
docker compose --env-file .env.docker stop
docker compose --env-file .env.docker down
```

`down` không kèm `-v` giữ named volume database. Giữ cùng thư mục/tên project Compose để tiếp tục dùng đúng volume cũ.

## Chạy chế độ phát triển

Không chạy đồng thời frontend/backend Docker và tiến trình Node trên cùng cổng.

### 1. Chạy riêng database

Tạo hai file môi trường như trên. Nếu đã chạy cả stack, dừng ứng dụng container trước:

```powershell
docker compose --env-file .env.docker stop frontend backend
docker compose --env-file .env.docker up -d db
```

### 2. Backend — terminal thứ nhất

```powershell
cd backend
npm.cmd ci --ignore-scripts
npx.cmd prisma generate
# Hai lệnh dưới dành cho database mới
npx.cmd prisma migrate deploy
npx.cmd prisma db seed
npm.cmd run start:dev
```

Nếu database đã có schema/dữ liệu phù hợp, bỏ bước seed; không reset. `prisma generate` sinh client TypeScript từ schema, không tạo bảng database. Sau khi đổi schema/pull cập nhật Prisma, chạy lại generate. Không sửa tay `backend/src/generated/prisma`.

Backend mặc định chạy cổng `3001`. Lệnh Prisma phải chạy trong `backend`, nơi có `prisma.config.ts` và dependency Prisma của project.

### 3. Frontend — terminal thứ hai

Từ thư mục gốc, tạo `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
SERVER_API_URL=http://localhost:3001
```

Sau đó:

```powershell
cd frontend
npm.cmd ci --ignore-scripts
npm.cmd run dev
```

Truy cập http://localhost:3000. Nếu thay biến môi trường, khởi động lại tiến trình tương ứng. `NEXT_PUBLIC_API_URL` được nhúng khi build production; cần build lại frontend khi đổi địa chỉ API.

## Thiết lập VNPay Sandbox

Phần này tùy chọn; có thể chạy luồng thanh toán mock trước. Dùng merchant Sandbox của nhóm và giữ bí mật hash secret.

1. Backend phải truy cập được ở cổng `3001`. Mở terminal riêng chạy `ngrok http 3001` sau khi đã cài và cấu hình ngrok.
2. Trong `backend/.env`, thay cấu hình thanh toán:

```dotenv
VNPAY_ENABLED=true
PAYMENT_MOCK_ENABLED=false
VNPAY_TMN_CODE=merchant_sandbox_cua_ban
VNPAY_HASH_SECRET=hash_secret_sandbox_cua_ban
PUBLIC_BASE_URL=https://ten-mien-ngrok-cua-ban
FRONTEND_URL=http://localhost:3000
VNPAY_PAYMENT_MINUTES=10
```

3. Cấu hình IPN với phía VNPay/đầu mối quản lý merchant thành `https://ten-mien-ngrok-cua-ban/payments/vnpay/ipn`. Backend cũng hỗ trợ alias `/api/payments/vnpay/ipn` cho merchant đang dùng đường dẫn đó.
4. Khởi động lại backend. Nếu dùng Docker, chạy `docker compose --env-file .env.docker up -d --force-recreate backend` để nhận env mới.
5. Đăng nhập khách, tạo đơn và mở thanh toán. QR và nút chuyển trang dùng cùng URL VNPay. Return URL do backend tạo là `PUBLIC_BASE_URL/payments/vnpay/return`.

`PUBLIC_BASE_URL` là origin HTTPS của **backend**, không thêm `/api` hay đường dẫn phía sau. `FRONTEND_URL` là origin website; dùng local chỉ khi khách thử nghiệm trên cùng máy. Đổi domain ngrok thì cập nhật cả env và IPN của merchant. Domain callback phải truy cập được từ bên ngoài.

Return chuyển hướng khách về website bằng HTTP `303`; IPN dùng để xác minh và ghi nhận giao dịch. HTTP `200` ở ngrok chỉ phản ánh phản hồi HTTP, cần đọc nội dung IPN và trạng thái backend để biết kết quả thanh toán. Trang cảnh báo ngrok trên trình duyệt có thể cần bấm **Visit Site**.

Thời hạn QR mặc định 10 phút, thời hạn giữ món mặc định 30 phút. QR hết hạn và đơn hết thời gian giữ món là hai điều kiện khác nhau. Không coi timeout hoặc việc khách đóng trang là bằng chứng thanh toán thất bại.

## Kiểm thử và build

Backend:

```powershell
cd backend
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Unit test không cần DB. API test đọc `DATABASE_URL` và có ghi dữ liệu/fixture: **chỉ chạy với database kiểm thử riêng**. Ví dụ tạo DB mới bằng pgAdmin, rồi trong terminal `backend`:

```powershell
$env:DATABASE_URL = 'postgresql://brewlite:brewlite_local_dev@localhost:5432/brewlite_test?schema=public'
$env:JWT_SECRET = 'chuoi-bi-mat-rieng-cho-test-local'
$env:ORDER_EXPIRY_WORKER_ENABLED = 'false'
$env:PAYMENT_MOCK_ENABLED = 'true'
$env:VNPAY_ENABLED = 'false'
npx.cmd prisma migrate deploy
npm.cmd run test:e2e
Remove-Item Env:DATABASE_URL
Remove-Item Env:JWT_SECRET
Remove-Item Env:ORDER_EXPIRY_WORKER_ENABLED
Remove-Item Env:PAYMENT_MOCK_ENABLED
Remove-Item Env:VNPAY_ENABLED
```

Thay thông tin kết nối theo máy. DB `brewlite_test` phải tồn tại trước khi migrate; dọn dữ liệu thử sau khi kiểm tra. Các biến PowerShell chỉ áp dụng trong terminal đó và ưu tiên hơn `.env`.

Frontend, trong terminal khác từ thư mục gốc:

```powershell
cd frontend
npm.cmd run lint
npm.cmd run build
npm.cmd run start
```

`start` chạy bản build production, không thay cho `dev`. Xem bộ đo hiệu năng tại [docs/performance/method.md](docs/performance/method.md) và kiểm chứng bổ sung tại [docs/verification/README.md](docs/verification/README.md). Import [VNPay Postman collection](vnpay.postman_collection.json) khi cần kiểm tra API; đối chiếu URL/token với môi trường đang chạy.

### Browser E2E và kiểm thử release

Chạy trên stack **local/test riêng** đã migrate/seed, bật `PAYMENT_MOCK_ENABLED=true`, tắt `VNPAY_ENABLED`, đặt `ORDER_EXPIRY_WORKER_ENABLED=false` trong `backend/.env` cho môi trường thử rồi recreate backend. Không thay cấu hình môi trường có dữ liệu cần giữ chỉ để chạy test. Theo mặc định web/API dùng cổng 3000/3001.

Tại thư mục gốc, mở terminal khác:

```powershell
cd e2e
npm.cmd ci
npx.cmd playwright install chromium
$env:E2E_BASE_URL = 'http://localhost:3000'
npx.cmd playwright test --workers=1
npm.cmd run report
```

Trên Linux, cài browser bằng `npx playwright install --with-deps chromium`. Test tạo khách/đơn và thay trạng thái quầy; fixture barista cần phù hợp tài khoản mẫu trong test. Vì có ghi dữ liệu, không trỏ cả bộ test vào production. Một số ca UI chủ động giả lập HTTP lỗi để kiểm tra phản hồi; các bất biến database được kiểm riêng bằng API integration test.

HTML nằm ở `e2e/playwright-report/`; video và dữ liệu từng ca ở `e2e/test-results/`. Video luôn bật, screenshot khi lỗi, trace giữ khi lỗi. Mở report để xem assertion và đính kèm; các thư mục này được workflow upload thành artifact `playwright-report`.

Kiểm thử release/rollback giả lập, chạy từ thư mục gốc:

```powershell
node --test scripts/deploy/tests/aws-release.test.cjs
```

Cần Node 24 và Bash (Linux hoặc Git Bash trên Windows); nếu đường dẫn Git Bash khác máy tác giả, đặt `$env:BASH_PATH = 'C:/Program Files/Git/bin/bash.exe'`. Test dùng thư mục tạm và Docker giả, không truy cập AWS/database thật. Kết quả này kiểm chứng orchestration, khác việc chủ động gây lỗi và phục hồi trên EC2.

## Sao lưu và thử khôi phục

Từ thư mục gốc khi container DB đang chạy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/database/backup.ps1
```

Kết quả nằm trong `backups/`: file `.dump` và manifest `.json` cùng tên. Giữ cả hai file. Thử khôi phục bằng đường dẫn file vừa tạo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/database/restore-test.ps1 -BackupFile 'backups/ten-file-backup.dump'
```

Script kiểm tra hash, tạo **database phục hồi riêng** và lưu kết quả kiểm tra; không tự ghi đè database vận hành. Xem [hướng dẫn kỹ thuật backup/restore](docs/GIAI-THICH-KY-THUAT-BACKUP-RESTORE.md) trước khi thực hiện chuyển đổi dữ liệu thật.

## CI/CD và triển khai AWS

Workflow chính: [`.github/workflows/brewlite.yml`](.github/workflows/brewlite.yml). Workflow [E2E](.github/workflows/e2e.yml) được gọi bằng `workflow_call` cho cùng commit; có thể chạy thủ công để chẩn đoán.

```text
Push / PR / Tag / Manual
  → Backend lint + unit/API + build / Frontend lint + build
  → Docker smoke + backup/restore / Browser E2E
  → AWS release confirmation tests (chạy song song)
  → CI passed (tất cả dependency phải success)
  → Build + push GHCR (backend, frontend, tools)
  → Deploy AWS EC2 → Public HTTPS smoke → Confirm release
```

CI chạy trên mọi nhánh/PR; publish dành cho nhánh mặc định hoặc tag phiên bản, không publish từ PR. Image có tag `sha-<commit>` hoặc tag phiên bản hợp lệ; OCI label giữ revision, bản deploy nhận image theo digest `@sha256:...`. Artifact `release-images.env` ghi ba image cụ thể. Tag phát hành không tự kích hoạt deploy AWS: job AWS chỉ nhận nhánh mặc định và điều kiện bên dưới.

### Chuẩn bị EC2 lần đầu

1. Tạo EC2 Ubuntu tại `ap-southeast-1`, cài Docker Engine và Compose plugin, cho user `ubuntu` chạy Docker. Kiểm tra `docker version` và `docker compose version` từ phiên SSH của user này. EC2 phải có outbound tới GHCR và dịch vụ cấp chứng chỉ.
2. Security Group mở public TCP 80/443/8443 cho Caddy; không mở database 5432 hoặc các cổng ứng dụng 3000/3001. SSH 22 được workflow cấp tạm cho IP /32 của runner; khi cài đặt thủ công chỉ cho IP quản trị cần thiết.
3. Tạo `~/brewlite`, file `~/brewlite/.env`, quyền `chmod 600`. File này được script Bash source nên dùng cú pháp `KEY=value`, đặt giá trị có khoảng trắng trong nháy, không dùng lệnh shell. Điền giá trị riêng:

```dotenv
PUBLIC_IP=YOUR_EC2_PUBLIC_IP
FRONTEND_URL=https://YOUR_EC2_PUBLIC_IP
POSTGRES_USER=brewlite
POSTGRES_DB=brewlite
POSTGRES_PASSWORD=REPLACE_WITH_RANDOM_ALPHANUMERIC_SECRET
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
BARISTA_EMAIL=YOUR_BARISTA_EMAIL
BARISTA_PASSWORD=REPLACE_WITH_PRIVATE_PASSWORD
PAYMENT_MOCK_ENABLED=true
ORDER_EXPIRY_WORKER_ENABLED=true
```

Mẫu trên không phải mật khẩu để dùng thật. Dùng mật khẩu DB ngẫu nhiên dạng chữ/số giúp tránh lỗi URL vì Compose ghép trực tiếp connection string. Compose production hiện đặt `VNPAY_ENABLED=false`. Volume `brewlite-data` giữ DB; `caddy-data`/`caddy-config` giữ trạng thái TLS/proxy. Caddy tự xử lý HTTPS IP theo [Caddyfile](deploy/aws/Caddyfile).

### Cấu hình GitHub

Repo → Settings → Secrets and variables → Actions; cấu hình environment `production` và quyền truy cập theo nhóm:

| Loại | Tên | Giá trị / mục đích |
| --- | --- | --- |
| Secret | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Credentials cấp/thu hồi ingress cho Security Group EC2; giới hạn quyền theo tài nguyên cần dùng |
| Secret | `EC2_SSH_KEY` | Private SSH key tương ứng user ubuntu; không commit |
| Variable | `EC2_HOST` | Public IP của EC2 |
| Variable | `EC2_SG_ID` | ID Security Group cần điều khiển SSH |
| **Repository variable** | `PUBLIC_API_URL` | `https://YOUR_EC2_PUBLIC_IP:8443`; dùng lúc build frontend trong job publish |
| Variable | `AWS_DEPLOY_ENABLED` | `true` nếu muốn tự deploy khi push main; để tắt nếu chỉ chạy thủ công |

`GITHUB_TOKEN` do Actions tự cấp; publish có `packages: write`, deploy có `packages: read`. Các package GHCR phải cho repo quyền đọc. `PUBLIC_API_URL` nên đặt cấp repository vì publish chạy trước job có environment production. Giá trị public được nhúng vào frontend lúc build, không phải secret. Không đặt secret chỉ ở environment production nếu job cần dùng trước khi vào environment đó.

Windows runner là luồng legacy, chỉ chạy khi `WINDOWS_DEPLOY_ENABLED=true`; không cần bật khi dùng AWS.

### Phát hành và kiểm tra

1. Push nhánh riêng, tạo PR về main, đợi toàn bộ quality gate đạt rồi review/merge.
2. Vào Actions → BrewLite CI CD → Run workflow → chọn **main**, bật input `deploy`. Nếu production yêu cầu reviewer thì duyệt deployment. Hoặc bật `AWS_DEPLOY_ENABLED=true` để tự triển khai khi push main.
3. Theo dõi publish, deploy, public smoke, confirm. Chỉ kết luận release hoàn thành khi các bước này thành công.

Runner mở SSH tạm, upload `deploy/aws/` vào `~/brewlite`, truyền token GHCR qua stdin. Script kéo image, chờ DB, tạo custom dump trước migration nếu đã có schema, chạy `prisma migrate deploy`, seed khi số sản phẩm bằng 0, rồi chờ stack healthy. Không reset DB. Dump giữ năm bản gần nhất tại `~/brewlite/backups/`; sao lưu thêm ngoài EC2 nếu cần bảo vệ trước mất ổ/máy.

Public smoke kiểm web và API health qua HTTPS có xác minh chứng chỉ, yêu cầu health chứa đúng commit. Sau smoke đạt, `deploy.sh confirm <commit>` xác nhận bản mới. Kiểm tra từ máy người nghiệm thu:

```powershell
curl.exe -f https://13.228.196.157/
curl.exe -f https://13.228.196.157:8443/health
```

Trên EC2, xem stack/log (không in `.env` ra log công khai):

```bash
cd ~/brewlite
docker compose --env-file .env --env-file release.env -f docker-compose.prod.yml ps
docker compose --env-file .env --env-file release.env -f docker-compose.prod.yml logs --tail 100 backend frontend caddy
```

## Rollback ứng dụng AWS

`release.env` chỉ bản được chọn chạy; `release.pending.env` là bản chờ public smoke; `release.good.env` là bản đã xác nhận. Bản tốt cũ được giữ đến khi HTTPS smoke và confirm đều đạt. Nếu smoke/confirm lỗi sau deploy, workflow gọi rollback; nếu startup/API nội bộ lỗi, script thử rollback và vẫn trả lỗi để pipeline đỏ.

Rollback thủ công trên EC2 bằng tài khoản được phép SSH:

```bash
cd ~/brewlite
./deploy.sh rollback
```

Lệnh chọn image trong `release.good.env`, chờ healthy và kiểm API, xóa pending khi thành công. Khi B đang pending, lệnh quay về A đã xác nhận; khi B đã confirm thì good là B, **lệnh này không tự tìm lại A trong lịch sử**. Muốn quay về bản xa hơn phải chọn digest đã lưu từ artifact của lần phát hành tương ứng và thực hiện một deployment có kiểm soát. Lần đầu chưa có good thì không có bản để rollback.

Nếu runner bị hủy hoặc mất kết nối giữa deploy và confirm, kiểm tra pending và health; gọi rollback để hủy bản đang chờ hoặc chỉ confirm đúng commit sau khi tự kiểm public HTTPS đạt. Script từ chối deploy mới khi còn pending. Không xác nhận thủ công để bỏ qua smoke đang lỗi.

Rollback image **không đảo migration và không khôi phục dữ liệu**. Schema cần tương thích với image được phục hồi; khôi phục dump là quyết định riêng để tránh mất giao dịch mới. Không dùng `down -v`, migrate reset hoặc seed để rollback.

## Demo và hồ sơ bàn giao

Người ngoài nhóm có thể dùng quy trình local ở trên hoặc URL HTTPS production. Demo mock, không nhập thông tin thẻ thật:

1. Mở menu, xem chi tiết, chọn size/topping còn kho, thêm giỏ và sửa số lượng; đối chiếu tổng tiền.
2. Tạo tài khoản khách, đăng nhập, áp `BREW10` nếu còn hợp lệ và tạo đơn.
3. Chọn Ví/Thẻ mô phỏng; thử thành công để thấy PAID, mã đơn và lịch sử. Tạo đơn thử khác nếu muốn xem thanh toán lỗi/thử lại.
4. Mở cửa sổ/context riêng đăng nhập barista được nhóm cấp, nhận đơn → đang pha → sẵn sàng → hoàn tất; khách đối chiếu trạng thái. Khách chỉ tự hủy đơn chưa thanh toán theo điều kiện nghiệp vụ.
5. Mở Actions để đối chiếu commit, test artifact và deploy; xem `/health` cùng commit đã phát hành.

Nếu kho topping bằng 0, chọn đồ uống không topping hoặc dùng môi trường thử đã chuẩn bị nguyên liệu. Test/demonstration tạo dữ liệu thật trong môi trường được chọn; dùng tài khoản và đơn demo riêng.

| Hồ sơ bàn giao | Vị trí / cách đối chiếu |
| --- | --- |
| Bối cảnh, SRS, use-case | [docs/requirements](docs/requirements/) |
| Backlog/Sprint | [Product Backlog](docs/product-backlog.md), [Sprint Backlog](docs/process/assignment2-sprint-backlog.md) |
| UML và quyết định kiến trúc | [docs/diagrams](docs/diagrams/), [ADR](docs/architecture/adr/) |
| Truy vết yêu cầu → code/test | [docs/traceability-matrix.md](docs/traceability-matrix.md) |
| Unit/API/browser E2E | `backend/src/**/*.spec.ts`, `backend/test/`, `e2e/tests/`; artifact trên Actions |
| Pipeline và deploy | `.github/workflows/`, `deploy/aws/`; [lần chạy #66](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/actions/runs/43685962677) |
| Phiên bản phát hành | SHA/digest trong `release-images.env` của run; release/tag và ghi chú phát hành quản lý tại GitHub Releases |
| Video demo, Review/Retrospective | Video Playwright trong artifact; demo bàn giao và biên bản/tổng kết Sprint được nhóm bàn giao cùng báo cáo |
| PDF/LaTeX | Báo cáo bàn giao riêng; các thư mục report đang ignore nên không mặc định có khi clone |

Khi tạo release chính thức, chọn tag trên commit đã qua CI/deploy, ghi release notes gồm chức năng, thay đổi migration/cấu hình, kết quả test, URL và hướng dẫn rollback. SHA/digest của CI cho phép truy vết phiên bản nhưng không thay nội dung release notes. Cấp giảng viên quyền repo/artifact nếu tài nguyên không public; kiểm tra URL và thông tin đăng nhập nghiệm thu trước buổi demo.

## Xử lý lỗi thường gặp

| Hiện tượng | Kiểm tra / cách xử lý |
| --- | --- |
| Không tìm thấy `dockerDesktopLinuxEngine` | Mở Docker Desktop, đợi engine sẵn sàng, kiểm tra Linux containers và `docker version`. |
| Cổng 5432/3000/3001 đã được dùng | Dừng tiến trình trùng hoặc đổi cổng trong `.env.docker`. Đổi API/Web port thì đồng bộ URL frontend, CORS và ngrok. |
| Prisma P2021, thiếu bảng `Recipe`/snapshot | Kiểm tra đúng DB, schema và migration. Generate chỉ tạo client; cần migrate DB mới. Không reset DB đang dùng. |
| Prisma báo thiếu model trong TypeScript | Chạy `npx.cmd prisma generate` trong `backend`, rồi build lại; kiểm tra model có trong schema. |
| `npx` đề nghị tải Prisma phiên bản khác | Kiểm tra đang đứng trong `backend` và đã cài dependency. Không cài bản Prisma mới tùy ý để bỏ qua lỗi. |
| Không đăng nhập PostgreSQL sau khi đổi env | Volume cũ giữ tài khoản/mật khẩu đã khởi tạo. Đổi env không tự đổi mật khẩu PostgreSQL trong volume. |
| API không kết nối DB | Chạy `docker compose --env-file .env.docker ps`; kiểm tra host `db` bên trong container, `localhost` khi chạy Node trực tiếp. |
| Không chọn được topping | Seed tạo kho topping bằng 0. Nhập nguyên liệu phù hợp rồi tải lại menu. |
| VNPay IPN 404 | Ngrok phải trỏ backend; kiểm tra domain và đường dẫn `/payments/vnpay/ipn` hoặc alias `/api/payments/vnpay/ipn`. |
| Thanh toán xong chưa về website | Kiểm tra `PUBLIC_BASE_URL`, `FRONTEND_URL`, ngrok còn chạy và trang cảnh báo ngrok. Đọc log backend và trạng thái giao dịch. |
| Frontend không gọi được API/CORS | Đồng bộ `NEXT_PUBLIC_API_URL` với cổng host và `FRONTEND_URL` với origin website; rebuild khi đổi biến public. |
| PowerShell chặn `npm.ps1` | Dùng `npm.cmd` và `npx.cmd` như các lệnh hướng dẫn. |

Nếu vẫn lỗi, gửi lệnh đã chạy, thư mục hiện tại, phiên bản Node/Docker và log liên quan; che token, mật khẩu và hash secret trước khi chia sẻ.

## Tài liệu và đóng góp

- Báo cáo PDF và nguồn LaTeX được bàn giao riêng; các thư mục report đang ignore, không bảo đảm có sẵn trong bản clone.
- [Product Backlog](docs/product-backlog.md) · [Đối chiếu yêu cầu](docs/traceability-matrix.md).
- [Đặt hàng và kho](docs/GIAI-THICH-KY-THUAT-DAT-HANG-VA-KHO.md).
- [Thanh toán VNPay](docs/GIAI-THICH-KY-THUAT-THANH-TOAN-VNPAY.md).
- [Đổi món và chênh lệch](docs/GIAI-THICH-KY-THUAT-DOI-MON-VA-CHENH-LECH.md).
- [Docker và database](docs/GIAI-THICH-KY-THUAT-DOCKER-VA-KHOI-TAO-DATABASE.md).
- [Sơ đồ hệ thống](docs/diagrams/).

Nhóm phát triển gồm Cao Cát Lượng (PO), Dương Văn Khánh (SM), Dương Trung Lâm, Đinh Văn Thanh Sơn, Nguyễn Hồng An và Phạm Nguyễn Minh Nhật.

Khi đóng góp: tạo nhánh riêng, mô tả thay đổi, cập nhật test/tài liệu liên quan và gửi Pull Request. Với thay đổi schema, bổ sung migration mới; không sửa migration đã áp dụng trên môi trường dùng chung. Không commit `.env`, bản backup hoặc thông tin merchant thật. Báo lỗi và đề xuất tại [GitHub Issues](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/issues).

**Giấy phép:** repo hiện chưa công bố file LICENSE. Liên hệ nhóm trước khi phân phối hoặc tái sử dụng ngoài phạm vi được cho phép.
