# ADR-007 — Cấu hình theo môi trường, log và healthcheck

- Ngày ghi nhận: 14/11/2026.
- Trạng thái: Áp dụng, ghi nhận theo hiện thực hiện tại.

## Bối cảnh

Local, CI và máy đích khác URL, secret và dữ liệu. Cần biết dịch vụ sẵn sàng để dựng stack và lưu thông tin khi kiểm tra thất bại.

## Quyết định

Backend dùng env qua dotenv; `.env.docker` phục vụ Compose; frontend tách biến public build-time với biến server runtime. JWT secret thiếu gây lỗi cấu hình; gateway kiểm merchant/URL/thời hạn trước dùng. Nest ghi log tiến trình/exception ra console; Docker thu stdout/stderr và CI lưu log container làm artifact. Healthcheck kiểm pg_isready, GET /products có truy cập DB và GET / của web.

## Phương án khác và đánh đổi

- Hardcode cấu hình dễ chạy lần đầu nhưng làm lộ bí mật và khó đổi môi trường.
- Probe chỉ kiểm cổng mở nhanh nhưng không biết API có đọc DB được không.
- Log console đơn giản và phù hợp quy mô hiện tại; không phải hệ thống log tập trung, retention hay distributed tracing. Probe /products kiểm cả DB nhưng nặng hơn liveness thuần và phụ thuộc dữ liệu/độ trễ.

## Hệ quả và truy vết

Secret chỉ ở backend/CI/máy đích, không commit hoặc đưa vào ảnh. Docker health phục vụ startup và smoke, không tự chứng minh SLA uptime. Backup/deploy có state/manifest riêng hỗ trợ truy vết. Nguồn: `backend/src/main.ts`, `backend/src/auth/jwt.config.ts`, `docker-compose.yml`, workflows và `scripts/deploy/deploy.ps1`.
