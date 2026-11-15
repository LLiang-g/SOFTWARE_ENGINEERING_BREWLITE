# ADR-002 — Kiến trúc phân lớp trong modular monolith

- Ngày ghi nhận: 14/11/2026.
- Trạng thái: Áp dụng, ghi nhận theo hiện thực hiện tại.

## Bối cảnh

Đơn hàng, thanh toán, kho và điểm liên quan chặt về transaction. Chia thành microservices ngay sẽ phát sinh giao dịch phân tán và nhiều thành phần vận hành.

## Quyết định

Backend là một ứng dụng NestJS, tổ chức module theo domain: Auth, Users, Products, Orders, Promotions và Payments. RealtimeModule được OrdersModule sử dụng. Guard/DTO/controller xử lý quyền và biên HTTP; service xử lý quy tắc; PrismaService cung cấp truy cập dữ liệu. Đây là phân lớp trách nhiệm trong module, không tạo thêm repository abstraction chưa có trong code.

## Phương án khác và đánh đổi

- Microservices cho khả năng scale/phát hành riêng nhưng tăng chi phí giao tiếp và tính nhất quán.
- Controller chứa trực tiếp toàn bộ SQL/quy tắc ngắn ở ban đầu nhưng khó kiểm thử và review.
- Modular monolith giữ transaction đơn giản và giảm vận hành; service có thể lớn và cần kiểm soát phụ thuộc vòng. Một sự cố tiến trình API ảnh hưởng nhiều domain.

## Hệ quả và truy vết

OrdersModule sử dụng InventoryService và chính sách khuyến mãi; thay đổi dữ liệu thành công mới phát tín hiệu orders.changed. Client tải lại API đã bảo vệ quyền để nhận dữ liệu. Nguồn: `backend/src/app.module.ts`, `orders/orders.module.ts`, `products/products.module.ts`, `realtime/orders.gateway.ts`.
