# ADR-001 — Monorepo cho web và API

- Ngày ghi nhận: 14/11/2026.
- Trạng thái: Áp dụng, ghi nhận theo hiện thực hiện tại.

## Bối cảnh

Nhóm sáu thành viên cần phối hợp thay đổi API, UI, migration và kiểm thử cho cùng sản phẩm. Quy mô quán nhỏ/vừa không cần tách đội vận hành theo dịch vụ.

## Quyết định

Lưu `frontend/`, `backend/`, `e2e/`, `docs/`, scripts và workflows trong một repository. Mỗi ứng dụng có package/lockfile và Dockerfile riêng; Git cung cấp cùng tham chiếu phiên bản cho thay đổi xuyên frontend/backend. Tên frontend/backend tương ứng web/api trong mô hình đề bài.

## Phương án khác và đánh đổi

- Nhiều repository giúp phát hành độc lập nhưng cần điều phối version hợp đồng và truy vết qua nhiều kho.
- Một package duy nhất giảm thao tác cài nhưng dễ trộn dependency frontend/backend.
- Monorepo thuận tiện review tích hợp; đổi lại pipeline cần phân biệt phạm vi build và tránh chạy dư công việc. Một commit không có nghĩa hai ứng dụng luôn tương thích với mọi phiên bản cũ.

## Hệ quả và truy vết

CI checkout cùng commit, gọi hai bộ build và E2E. README hướng dẫn riêng từng thư mục; env thực không đưa vào repository. Nguồn: `.github/workflows/brewlite.yml`, `backend/package.json`, `frontend/package.json`, `e2e/package.json`.
