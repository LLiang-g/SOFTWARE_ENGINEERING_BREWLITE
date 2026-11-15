# Kiến trúc BrewLite — Task 3.1

Ngày ghi nhận: 14/11/2026. Tài liệu mô tả quyết định kiến trúc theo code/cấu hình hiện tại; không gán ngày ghi ADR cho thời điểm bắt đầu dự án.

## Phương pháp

Sử dụng **kiến trúc phân lớp** theo lựa chọn được Task 3.1 cho phép. Một repository chứa hai ứng dụng web/API; backend là modular monolith, tổ chức theo domain. UI không truy cập trực tiếp PostgreSQL. Controller/guard/DTO xử lý biên HTTP; service điều phối nghiệp vụ; Prisma và SQL trong transaction thực thi lưu trữ/ràng buộc.

| Thành phần | Trách nhiệm | Nguồn kiểm tra |
| --- | --- | --- |
| Next.js | SSR/CSR, giao diện mobile-first, giỏ/phiên, gọi REST và nhận tín hiệu realtime | `frontend/src/app`, `frontend/src/features`, `frontend/src/lib/api.ts` |
| NestJS | Module auth/users/products/orders/promotions/payments; guard, DTO, service | `backend/src/app.module.ts` và module domain |
| PostgreSQL/Prisma | Dữ liệu, constraint, transaction, migration; client sinh từ schema | `backend/prisma/`, `backend/src/prisma/prisma.service.ts` |
| Mock gateway | Kết quả WALLET/CARD thành công/thất bại có thể tái lập | `backend/src/payments/mock-gateway.service.ts` |
| Health/log/config | Docker health probes, Nest console/container logs và env theo môi trường | `docker-compose.yml`, `backend/src/main.ts`, Dockerfile, workflow |

## ADR

1. [001 — Monorepo](adr/001-monorepo.md)
2. [002 — Phân lớp và module/domain](adr/002-layered-modular-backend.md)
3. [003 — PostgreSQL, Prisma và migration](adr/003-postgresql-prisma-migrations.md)
4. [004 — Transaction, khóa dòng, snapshot và version](adr/004-consistency-and-concurrency.md)
5. [005 — Mock payment và tích hợp gateway](adr/005-payment-gateway-boundary.md)
6. [006 — Next.js, dữ liệu client/server](adr/006-nextjs-client-server-boundary.md)
7. [007 — Cấu hình, log và healthcheck](adr/007-configuration-logging-health.md)

Mỗi ADR ghi bối cảnh, quyết định, phương án thay thế, ưu/nhược điểm và liên kết code. Trạng thái “Áp dụng” xác nhận phù hợp với hiện thực được rà soát, không khẳng định mọi tình huống vận hành đã được thử nghiệm.

## Sơ đồ

- `docs/diagrams/architecture-layered.puml` và `.png`/`.svg`: lớp và hướng phụ thuộc.
- Báo cáo Assignment 2 lấy bản PNG riêng trong assets; báo cáo tổng và Assignment 1 không đổi.

Task 3.2 (deployment production/HTTPS) được xử lý riêng khi nhóm chọn môi trường triển khai; tài liệu này chỉ chốt Task 3.1.
