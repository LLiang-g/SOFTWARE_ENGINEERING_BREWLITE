# Ma trận truy vết BrewLite — baseline Task 1

Ngày 12/11/2026. Đây là baseline liên kết yêu cầu với code/test, chưa xác nhận mọi AC đã PASS. ACT-01 (activity-checkout), SEQ-01 (sequence-checkout), CLASS-01 (class-domain) có nguồn .puml và ảnh .png tại docs/diagrams. DEP-01 chưa có; sơ đồ hiện có mô tả chọn lọc, chưa bao phủ mọi nghiệp vụ đổi món/hoàn khoản thu dư.

Use-case nguồn/render hiện có tại `docs/diagrams/usecase-system.*`, `usecase-checkout.*`. Tiêu chí AC và NFR nằm trong `docs/requirements/srs.md`. Quy tắc nằm trong `business-rules.md`.

| Yêu cầu | Use-case / quy tắc | Thiết kế | Code / API hiện có | Test / bằng chứng hiện có hoặc cần bổ sung |
| --- | --- | --- | --- | --- |
| FR-01 | UC-02 | ACT-01, CLASS-01 | products.service.ts, ProductGrid; GET /products | availability.spec.ts, ingredients.e2e-spec.ts; thêm E2E menu |
| FR-02 | UC-02, BR-01 | CLASS-01 | products.service.ts, ProductDetail; GET /products/:id | Cần bổ sung test riêng cho giá size/topping và browser E2E tùy chọn |
| FR-03 | UC-03 | ACT-01 | cart.store.ts, CartView.tsx | Browser E2E thật cần bổ sung |
| FR-04 | UC-04 | SEQ-01 | auth.service.ts, jwt.strategy.ts, AuthForm | auth-roles.e2e-spec.ts; kiểm tra phiên nhiều tab chưa xong |
| FR-05 | UC-01, BR-02/07 | SEQ-01 | orders.service.ts; POST /orders | order-idempotency.e2e-spec.ts, inventory.e2e-spec.ts |
| FR-06 | UC-01, BR-09 | SEQ-01 | payments.service.ts, mock-gateway.service.ts | payments.e2e-spec.ts, staff-orders.e2e-spec.ts |
| FR-07 | UC-05 | ACT-01 | OrderHistory, OrderConfirmation; GET /orders/me, /orders/:id | auth-roles.e2e-spec.ts, staff-orders.e2e-spec.ts; browser nghiệm thu |
| FR-08 | UC-08, BR-21 | State machine trong code; cần CLASS-01 | staff-orders.controller.ts, orders.service.ts, order-state-machine.ts | order-state-machine.spec.ts, staff-orders.e2e-spec.ts, payment-exchange.e2e-spec.ts |
| FR-09 | UC-06, BR-04/05/06 | SEQ-01/CLASS-01 | inventory.service.ts; reserve/release; snapshot | inventory.e2e-spec.ts, inventory-snapshot.e2e-spec.ts |
| FR-10 | UC-07, BR-03/13 | CLASS-01 | promotions.service.ts, loyalty.service.ts | promotions.e2e-spec.ts, loyalty.e2e-spec.ts |
| FR-11 | UC-01 | SEQ-01 | vnpay.gateway.ts, PaymentQr.tsx, VnpayPanel | vnpay.crypto.spec.ts, vnpay.e2e-spec.ts; merchant demo cần lưu minh chứng |
| FR-12 | UC-01, BR-08/09 | SEQ-01 | vnpay.crypto.ts, vnpay.service.ts; IPN/QueryDr/Return | vnpay.e2e-spec.ts, vnpay.crypto.spec.ts |
| FR-13 | UC-11, BR-10/11 | SEQ-01 | VnpayService.start/check/apply, PaymentRefundCase | payment-exchange.e2e-spec.ts, vnpay.e2e-spec.ts |
| FR-14 | UC-09, BR-14/15/19 | ACT-01/CLASS-01 | ExchangeWorkspace, ExchangeService.quote/request/withdraw | payment-exchange.e2e-spec.ts; verify-ui.cjs trong bản vá 08 dùng fixture |
| FR-15 | UC-09, BR-16/17/18 | SEQ-01/CLASS-01 | ExchangeService.decide, creditApplied; VNPay thu delta | payment-exchange.e2e-spec.ts; UI tổng tiền bản vá 09 |
| FR-16 | UC-10, BR-20 | CLASS-01 | PaymentRefundCase, updateRefund, PaymentAudit | payment-exchange.e2e-spec.ts; chưa có refund tự động |
| FR-17 | UC-09/10/11 | ACT-01 | StaffPaymentCases, queue API | payment-exchange.e2e-spec.ts; verify-ui.cjs bản vá 08 |
| FR-18 | Vận hành local | DEP-01 | Compose hiện chỉ DB; Dockerfile trống, chưa health | Thiếu test compose/clean migration/health |
| FR-19 | Delivery | DEP-01 | Chưa thấy workflow/URL production trong local | Thiếu CI pass/fail, required checks, CD/smoke/rollback/release |
| FR-20 | Ngoài phạm vi | Không nghiệm thu hiện tại | Chưa có vòng đời giao hàng riêng | Không đánh dấu PASS một chức năng chưa triển khai |

## Truy vết phi chức năng

| Mã | Code / tài liệu liên quan | Phép kiểm chứng còn phải gắn minh chứng |
| --- | --- | --- |
| NFR-01 | JWT/guards/DTO/auth service | auth-roles API test; scan secret và kiểm tra deployment |
| NFR-02 | Transaction/unique/Order lock/Ingredient lock/version | Inventory, snapshot, idempotency, VNPay, exchange test trên commit nộp |
| NFR-03 | API sản phẩm/đơn | Chưa có script và kết quả đo tải |
| NFR-04 | Components Next.js, ảnh docs/staff và screenshots bản vá | Checklist trình duyệt/mobile/bàn phím trên bản nộp |
| NFR-05 | Loading/error/realtime/payment check | Cần health và diễn tập lỗi kết nối/Return/IPN |
| NFR-06 | Lockfile/schema/seed/Compose | Cần dựng sạch, Docker đủ 3 dịch vụ và production |
| NFR-07 | PaymentAudit và log ứng dụng | Cần health/log vận hành/runbook hỗ trợ |
| NFR-08 | Tài liệu requirements/ma trận này | Cần sơ đồ/ADR và review liên kết |
| NFR-09 | Chưa có workflow local | Cần CI trên PR, required checks, minh chứng pass/fail |
| NFR-10 | Lịch sử migration cần đối chiếu | Cần runbook và test restore/rollback ở DB riêng |
| NFR-11 | auth.store.ts hiện localStorage | Cần chốt chính sách và test nhiều tab |
| NFR-12 | Chưa manifest/service worker | Nếu chọn triển khai PWA, kiểm tra khả năng cài đặt và cập nhật |

Đường dẫn code/test rút gọn: backend/src/, backend/test/ và frontend/src/features/ như tên module trong bảng. Tại bước nghiệm thu, bổ sung đường dẫn đầy đủ, tên test/AC và commit SHA; ma trận không dùng số lượng test đã chạy ở một bản vá khác làm kết quả của commit hiện tại.
