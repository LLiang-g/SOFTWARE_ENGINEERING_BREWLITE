# Tiến độ BrewLite — 10 task sản phẩm và 5 task Assignment 2

Cập nhật 12/11/2026. **Assignment 1: 10 task sản phẩm, gợi ý 3 Sprint** là backlog chính. **Assignment 2: 5 task tài liệu/triển khai, 2 Sprint** là bộ tiêu chí bổ sung. Hai bộ được theo dõi riêng, không thay thế nhau. Tình trạng tài liệu không thay thế xác nhận chấm điểm của giảng viên.

## 1. Product Backlog chính — Assignment 1

| Mã | Task | Tiêu chí nghiệm thu chính | Điểm tối đa | Hiện trạng / việc còn lại |
| --- | --- | --- | --- | --- |
| A1-01 | Khởi tạo dự án và cấu trúc | Frontend Next.js và backend NestJS chạy được; có Git, README và .env.example | 1 | Có mã nền tảng; README gốc còn trống, chưa đủ DoD |
| A1-02 | API danh sách sản phẩm | GET /products trả menu có id, tên, giá, ảnh từ dữ liệu mẫu/database | 1 | Có API và seed; cần gắn kết quả test của commit bàn giao |
| A1-03 | Trang Menu | Next.js gọi API, hiện lưới sản phẩm, loading và empty | 1 | Có giao diện; một số ảnh mẫu 404 cần sửa |
| A1-04 | Chi tiết và tùy chọn sản phẩm | Chọn size S/M/L, topping; giá cập nhật đúng lựa chọn | 1 | Có mã; cần bộ test nghiệm thu giá và kiểm tra trình duyệt |
| A1-05 | Giỏ hàng | Thêm/gộp, sửa số lượng, xóa; lưu state; tính tổng và badge | 1 | Có mã; cần E2E tích hợp bản nộp |
| A1-06 | API tạo đơn | POST /orders validate giỏ, backend tính giá, lưu PENDING và trả mã | 1 | Có mã, mở rộng idempotency/snapshot kho; cần chạy lại test bản nộp |
| A1-07 | Đăng ký/đăng nhập JWT | POST /auth/register, /auth/login; bcrypt, JWT và guard đặt đơn | 1 | Có mã; chính sách phiên nhiều tab chưa hoàn thiện |
| A1-08 | Thanh toán không tiền mặt | Mock Ví/Thẻ qua POST /payments; PAID hoặc PAYMENT_FAILED, có màn hình xác nhận | 1 | Có mock và VNPay mở rộng; cần đối chiếu tiêu chí giữ giỏ khi thanh toán lỗi của User Story mẫu: UI hiện retry trên đơn đã tạo |
| A1-09 | Xác nhận, lịch sử và bàn giao | Màn hình xác nhận, GET /orders/me, Compose chạy frontend/API/DB, README và demo end-to-end | 1 | Có giao diện/API; Dockerfile và README trống, Compose mới có DB; chưa đủ bàn giao |
| A1-10 | Nghiệp vụ backend | State machine; thanh toán idempotent; transaction + optimistic locking cho tồn kho; voucher và loyalty; test chứng minh ba tình huống a/b/c trong đề | 1 | Có nhiều cơ chế/test. Optimistic locking có ở lịch sử nhánh an; code đang dùng khóa dòng cho kho, cần đáp ứng lại tiêu chí optimistic locking trên bản tích hợp hoặc được nghiệm thu phương án thay thế |

Chi tiết Definition of Done và bốn nội dung Task 10: [product-backlog.md](product-backlog.md).

## 2. Theo dõi riêng Assignment 2

| Task A2 | Tạo phẩm và điều kiện | Trạng thái |
| --- | --- | --- |
| 1 | Context/scope, SRS FR/NFR + MoSCoW + acceptance, use-case tổng quát và UC-01, report tương ứng | Đã lập baseline: 20 FR, 12 NFR, 22 BR, 2 nguồn/render use-case; báo cáo đã build và kiểm tra bố cục; đã khôi phục 10 task A1. Còn review bằng commit/PR thực tế |
| 2 | Activity + sequence + class, nguồn/render; đủ nhánh lỗi và liên kết FR | Chưa hoàn tất |
| 3 | Kiến trúc, ADR, deployment đúng nền tảng thực tế, cấu hình/log/health | Chưa hoàn tất; chưa chốt nền tảng production |
| 4 | Repo/tài liệu/Sprint 1, CI trên PR, branch protection, minh chứng pass/fail | Có code MVP; CI và minh chứng chưa có trong bản local |
| 5 | Luồng end-to-end, E2E thật, Compose 3 dịch vụ, CD, migration, smoke, production, release/rollback/review | Có nhiều chức năng/test; chưa đủ delivery/production |

## 3. Thứ tự làm tiếp

1. Review và commit baseline Task 1 cùng báo cáo; không ghi lùi ngày hoặc tạo lịch sử Scrum giả.
2. Task 2: dựng activity/sequence/class bám đúng SRS và code.
3. Task 3: ADR và phương án triển khai khả thi, rồi deployment diagram đúng phương án được chốt.
4. Task 4: README, Dockerfile/Compose/health, CI, test trên PR và bằng chứng branch protection. Repo hiện dùng frontend/backend, khác cấu trúc apps/web/apps/api trong đề; cần giải quyết trước nghiệm thu repository.
5. Task 5: E2E menu→backend/database→xác nhận, CD/production/migration/smoke/rollback, release và minh chứng demo/review.

## 4. Những kết quả chưa được phép ghi là đã đạt

- Không lấy test giả lập gateway làm bằng chứng ngân hàng/merchant thật đã nghiệm thu.
- Không lấy code trong proposed-fixes làm bằng chứng đã áp dụng vào code gốc.
- Không lấy ngrok callback đang chạy làm bằng chứng đã có CD và production ổn định.
- Không lấy bảng kế hoạch Sprint, burndown lý tưởng hoặc hướng dẫn thao tác làm biên bản thực hiện.
- Không ghi README/Docker/health/CI hoàn tất khi file rỗng, chưa chạy hoặc chưa có log.

## 5. Minh chứng cần nhóm bổ sung bằng hoạt động thực tế

PO/SM và phân công được xác nhận, link issue board hai Sprint, PR review, log CI pass/fail, required checks, release/tag, URL production frontend/API/health, registry, log migration/smoke, chạy thử rollback, video/demo và Sprint Review/Retrospective.
