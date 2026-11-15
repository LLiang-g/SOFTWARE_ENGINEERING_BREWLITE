# ADR-003 — PostgreSQL, Prisma và migration có phiên bản

- Ngày ghi nhận: 14/11/2026.
- Trạng thái: Áp dụng, ghi nhận theo hiện thực hiện tại.

## Bối cảnh

Order, OrderItem, Payment, nguyên liệu và sổ điểm có quan hệ, ràng buộc duy nhất và cập nhật nguyên tử. Môi trường local/CI cần tái tạo cùng schema.

## Quyết định

Dùng PostgreSQL 16 với Prisma 7 và adapter pg. `schema.prisma` mô tả model; generate sinh client TypeScript. SQL migration thay đổi database; migrate deploy áp dụng migration đã lưu. Seed cung cấp dữ liệu mẫu cho database mới, không chạy trong cập nhật dữ liệu vận hành. Tiền VND dùng số nguyên.

## Phương án khác và đánh đổi

- NoSQL linh hoạt schema nhưng quan hệ và transaction hiện tại cần thiết kế khác.
- SQL thuần cho toàn bộ API kiểm soát truy vấn tốt nhưng tăng code ánh xạ; ORM hỗ trợ kiểu và CRUD song vẫn cần SQL cho khóa/ràng buộc đặc thù.
- Prisma giảm lỗi kiểu, không tự thay thế constraint, transaction hay kế hoạch migration. Thay schema không tự thay database; sửa migration đã áp dụng gây lệch lịch sử.

## Hệ quả và truy vết

Generate và migrate là hai bước riêng. Named volume giữ PostgreSQL qua vòng đời container. Deploy backup trước migration, không reset/seed. Nguồn: `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, `backend/prisma.config.ts`, `backend/src/prisma/prisma.service.ts`, `scripts/deploy/deploy.ps1`.
