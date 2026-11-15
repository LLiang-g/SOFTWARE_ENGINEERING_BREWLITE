# ADR-005 — Tách xử lý nghiệp vụ khỏi gateway thanh toán

- Ngày ghi nhận: 14/11/2026.
- Trạng thái: Áp dụng, ghi nhận theo hiện thực hiện tại.

## Bối cảnh

Assignment yêu cầu thanh toán Ví/Thẻ mô phỏng. Kiểm thử cần kết quả xác định mà không phụ thuộc merchant, mạng và tiền thật; sản phẩm còn tích hợp VNPay Sandbox.

## Quyết định

MockGatewayService trả ChargeResult thành công/thất bại và reference, không trực tiếp cập nhật Order. PaymentsService kiểm quyền/trạng thái/key và ghi nhận kết quả trong transaction. WALLET/CARD và simulateFailure hỗ trợ test. Mock chỉ hoạt động khi PAYMENT_MOCK_ENABLED=true và VNPAY_ENABLED không bật. VNPay có service/gateway riêng, ký và kiểm tra tại backend.

## Phương án khác và đánh đổi

- Gọi cổng thật cho mọi test gần thực tế nhưng khó tái lập và phụ thuộc bên ngoài.
- UI tự đổi PAID dễ demo nhưng không có nguồn dữ liệu đáng tin.
- Mock ổn định, nhanh và kiểm được nhánh lỗi; không chứng minh xác thực/nghiệp vụ ngân hàng. Hai gateway hiện là service cụ thể, không khẳng định code có một interface thay thế tổng quát chưa được hiện thực.

## Hệ quả và truy vết

Browser E2E dùng mock; VNPay test xác minh chữ ký và callback riêng. Return điều hướng, kết quả tiền do backend quyết định. Nguồn: `payments/mock-gateway.service.ts`, `payments/payments.service.ts`, `payments/vnpay.gateway.ts`, `payments/vnpay.service.ts`.
