# ADR-004 — Transaction và các lớp chống tranh chấp

- Ngày ghi nhận: 14/11/2026.
- Trạng thái: Áp dụng, ghi nhận cơ chế hiện tại và khác biệt lịch sử.

## Bối cảnh

Hai đơn có thể tranh nguyên liệu cuối, request có thể gửi lại, công thức có thể thay đổi trước khi hủy đơn và hai nhân viên có thể cùng xử lý một hồ sơ.

## Quyết định

Giữ nguyên liệu cùng transaction tạo đơn; khóa các dòng Ingredient theo thứ tự ID. Lưu snapshot lượng đã giữ để hoàn kho một lần. Idempotency key và ràng buộc duy nhất bảo vệ một ý định gửi lại. Version kiểm soát cập nhật hồ sơ nghiệp vụ theo phiên bản khách/nhân viên đã đọc. Sự kiện UI được phát sau khi cập nhật thành công.

## Phương án khác và đánh đổi

- Optimistic locking tồn kho Product được hiện thực tại commit `3c50070`; bản nguyên liệu hiện tại dùng khóa dòng, không gọi cơ chế đó là optimistic locking.
- Chỉ kiểm kho ở frontend không ngăn request đồng thời hoặc sửa request.
- Khóa dòng phù hợp nhiều nguyên liệu trong một đơn nhưng tạo chờ khóa; transaction cần ngắn và thứ tự khóa thống nhất. Snapshot thêm bảng/dữ liệu nhưng giữ được tính đúng lịch sử.

## Hệ quả và truy vết

Không gọi gateway mạng trong transaction giữ khóa dài. Idempotency, row lock và version không thay thế nhau. Nguồn: `products/inventory.service.ts`, `orders/orders.service.ts`, `orders/exchange.service.ts`, schema và test inventory/idempotency/exchange.
