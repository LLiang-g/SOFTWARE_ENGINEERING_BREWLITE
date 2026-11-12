# Product Backlog chính — 10 task Assignment 1

Cập nhật 12/11/2026. Căn cứ: `Assignment1-BrewLite.pdf`, mục 8–10. Dùng mã **A1-01…A1-10** để không nhầm với năm task tài liệu/triển khai của Assignment 2 (**A2-01…A2-05**).

Đây là khung tiến độ phát triển sản phẩm. Mỗi task có tối đa 1 điểm theo đề; cột điểm không phải điểm đã được giảng viên công nhận. Có commit hoặc có mã chưa đủ kết luận đạt Definition of Done.

## 1. Mười task

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

## 2. Bốn phần bắt buộc bên trong Task 10

- **A1-10a — State machine:** PENDING → PAID → PREPARING → READY → COMPLETED; chặn mọi bước nhảy không hợp lệ và trạng thái kết thúc.
- **A1-10b — Idempotency:** gửi lặp cùng yêu cầu không tạo đơn/Payment hay cộng điểm lần hai. Phân biệt key tạo đơn với key thanh toán.
- **A1-10c — Kho đồng thời:** theo nguyên văn đề cần transaction + optimistic locking; test hai khách tranh phần cuối và rollback đơn nhiều dòng. Khóa dòng hiện tại bảo vệ kho nhưng là kỹ thuật khác. Version ở OrderExchange/PaymentRefundCase không tự chứng minh optimistic locking cho tồn kho.
- **A1-10d — Voucher/loyalty:** chỉ nhận voucher hợp lệ, tính giảm ở backend, cộng điểm sau khi PAID trong cùng transaction; gửi lặp không cộng lại.

## 3. Definition of Done

Một task chỉ đề xuất hoàn thành khi: code chạy và build được; đạt đúng tiêu chí của task; có commit và review thật; API validate; UI có loading/lỗi; README hướng dẫn chạy. Kết quả ghi theo commit SHA, môi trường và minh chứng. Không tự cộng điểm theo số commit.

## 4. Khung ba Sprint của Assignment 1

| Sprint | Mục tiêu gợi ý từ đề | Task |
| --- | --- | --- |
| 1 | Nền tảng và hiển thị menu | A1-01, A1-02, A1-03, A1-04 |
| 2 | Giỏ, tạo đơn và đăng nhập | A1-05, A1-06, A1-07 |
| 3 | Thanh toán, bàn giao và nghiệp vụ nâng cao | A1-08, A1-09, A1-10 |

Đây là khung gợi ý để tổ chức backlog. Chưa gán ngày bắt đầu/kết thúc, PO/SM, số liệu burndown hoặc kết quả Review/Retrospective khi chưa có bằng chứng. Commit dùng làm mốc kỹ thuật, không tự đồng nhất với ngày hoàn thành Sprint.

## 5. Assignment 2 và phần mở rộng

Năm task của Assignment 2 được giữ riêng ở `docs/ASSIGNMENT2-PROGRESS.md`: yêu cầu, mô hình hóa, kiến trúc, Sprint 1/CI và Sprint 2/CD/production. Không thay 10 task này bằng 5 task đó và không cộng hai thang điểm thành một điểm môn học tự suy diễn.

VNPay Sandbox, barista/realtime, snapshot nguyên liệu, đổi món và thu chênh lệch là mở rộng gắn với các task sản phẩm. Chúng không thay thế các điều kiện Docker/README/test hoặc yêu cầu kỹ thuật cụ thể trong đề.
