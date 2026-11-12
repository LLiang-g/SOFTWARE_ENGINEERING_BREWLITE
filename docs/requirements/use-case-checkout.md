# UC-01 — Đặt và thanh toán đơn hàng

Baseline 1.0 — 12/11/2026. Sơ đồ nguồn/render nằm ở `docs/diagrams/usecase-checkout.*`. Sơ đồ tổng quát: `docs/diagrams/usecase-system.*`.

## 1. Thông tin

| Thuộc tính | Nội dung |
| --- | --- |
| Actor chính | Khách hàng ST-01 |
| Actor hỗ trợ | Dịch vụ thanh toán ST-06; barista ST-02 nhận đơn đủ tiền và hỗ trợ khi có bất thường |
| Trigger | Khách bấm Đặt hàng từ giỏ có món, sau đó chủ động bắt đầu thanh toán |
| Mục tiêu | Có một đơn đúng giá/tùy chọn, giữ nguyên liệu hợp lệ và xác định kết quả thu tiền; khách nhận được mã/trạng thái đơn |
| Tiền điều kiện | Menu và cấu hình giá tồn tại; khách đăng nhập trước khi gửi tạo đơn; PostgreSQL sẵn sàng; gateway mock hoặc VNPay được cấu hình theo chế độ |
| Hậu điều kiện thành công | Order PAID, reservation còn giữ; đúng một khoản thanh toán áp dụng cho đơn; điểm trên tiền mới được ghi cùng transaction; đơn có thể xuất hiện tại quầy |
| Hậu điều kiện tối thiểu | Không kho âm/đơn nửa chừng/thu lặp do callback; giao dịch chưa rõ giữ lịch sử để đối soát; frontend không tự coi timeout là thất bại chắc chắn |
| Liên kết yêu cầu | FR-01–08, FR-09–13; NFR-01/02/04/05/07/11 |
| Quy tắc | BR-01–13, BR-18, BR-21 |

## 2. Luồng chính

| Bước | Khách / Next.js UI | NestJS / database / dịch vụ thanh toán |
| --- | --- | --- |
| M1 | Mở menu, xem chi tiết | GET /products và /products/:id trả sản phẩm và tùy chọn |
| M2 | Chọn size/topping/số lượng, thêm giỏ | Chưa có Order, chưa khóa/giữ kho |
| M3 | Mở giỏ, xác nhận món, voucher nếu có | UI tính tiền tham khảo; backend mới là nguồn giá chính thức |
| M4 | Đăng nhập nếu cần, gửi tạo đơn với key cho lần đặt | JWT và DTO được kiểm tra; key được nhận trước khi giữ nguyên liệu |
| M5 | Chờ kết quả tạo đơn | Transaction tính lại tiền/voucher, khóa nguyên liệu có thứ tự, kiểm tra hàng, trừ lượng giữ, tạo Order PENDING và snapshot; lỗi thì rollback |
| M6 | Nhận mã đơn và bấm Thanh toán | Backend xác thực chủ đơn, trạng thái và snapshot; khóa Order; tạo/tái dùng attempt theo key; số tiền từ total − creditApplied |
| M7 | Quét QR mở URL hoặc bấm mở trang VNPay | VNPay Sandbox nhận URL ký; mock thực hiện theo chế độ kiểm thử riêng khi VNPay tắt |
| M8 | Thực hiện xác nhận trên cổng | IPN đến backend; backend xác minh chữ ký, merchant/ref/amount/status trước khi nhận kết quả |
| M9 | Có thể quay về trang đơn qua Return | Transaction khóa Order, xác nhận một lần, ghi Payment, PAID và điểm; Return không ghi PAID |
| M10 | Xem xác nhận, lịch sử và tiến độ | UI đọc trạng thái từ backend, cập nhật qua HTTP/realtime; barista bắt đầu pha nếu đơn đủ điều kiện |

Kết quả mock và VNPay được kiểm thử riêng. Không bật mock để khách bỏ qua gateway VNPay. Không lưu thông tin thẻ hoặc OTP trong BrewLite.

## 3. Luồng thay thế

| Mã / điểm rẽ | Luồng | Kết quả |
| --- | --- | --- |
| A1 tại M4 | Chưa đăng nhập → mở đăng nhập với next phù hợp → quay về giỏ | Không tạo đơn trước xác thực |
| A2 tại M4–M5 | Mất response → gửi lại cùng key/nội dung | Trả lại cùng Order; không trừ kho thêm |
| A3 tại M6 | Cùng key tạo thanh toán hoặc key khác khi mã còn hiệu lực | Trả/tái dùng attempt còn hiệu lực, không tạo nhiều mã hoạt động do bấm lặp |
| A4 tại M7–M9 | Xác nhận giao dịch thất bại | Lưu kết quả; đơn có thể PAYMENT_FAILED, nguyên liệu chưa tự hoàn chỉ vì thanh toán lỗi; khách retry hoặc hủy nếu đủ điều kiện |
| A5 tại M7 | Mã hết hạn, chưa có khoản thu đã xác minh | Backend thử QueryDr, có thể cấp attempt mới sau hết hạn; giữ lần cũ để nhận kết quả muộn, cảnh báo khách nguy cơ thu trùng |
| A6 tại M9 | Return đến trước IPN hoặc khách đóng trình duyệt | Đơn chưa tự PAID từ Return; mở lịch sử/kiểm tra kết quả, IPN/QueryDr có thể cập nhật sau |
| A7 sau M5 | Khách muốn hủy đơn chưa trả | Kiểm tra BR-06; nếu hợp lệ hủy và hoàn snapshot cùng transaction |
| A8 sau M10 | Khách cần đổi món chưa pha | Chuyển UC-09; không hủy đơn cũ khi khách mới mở menu đổi |

## 4. Ngoại lệ

| Mã | Điều kiện | Xử lý và dữ liệu cần giữ |
| --- | --- | --- |
| E1 | Size/topping/qty/product/voucher không hợp lệ | Trả lỗi có thể hiểu; không tạo đơn/giữ kho dở dang |
| E2 | Hai khách tranh lượng cuối, người sau không đủ nguyên liệu | Một transaction thành công, transaction thiếu hàng rollback; thông báo thiếu món; không stock âm |
| E3 | Cùng key tạo đơn nhưng khác nội dung | 409, yêu cầu kiểm tra đơn trước; không tự dùng key đó cho đơn khác |
| E4 | Sai JWT hoặc không sở hữu đơn | Từ chối theo guard/quyền; không trả dữ liệu người khác |
| E5 | Callback sai chữ ký/ref/merchant/amount | Không cập nhật PAID/Payment/điểm; phản hồi theo giao thức cổng |
| E6 | QueryDr timeout/không có kết quả chắc chắn | Giữ trạng thái chưa rõ; không suy ra ngân hàng đã trả tiền; UI có đường kiểm tra/lịch sử/hỗ trợ |
| E7 | Callback lặp, đồng thời hoặc đến sai thứ tự | Unique/khóa Order/idempotency; không hạ thanh toán đã xác nhận thành thất bại do callback cũ |
| E8 | Lỗi ghi Payment hoặc điểm | Rollback transaction; callback có thể được gửi lại và xử lý an toàn |
| E9 | Hai attempt đều thu thành công | Một khoản áp dụng cho đơn, khoản còn lại có REVIEW/paidAt và UC-10 xử lý hoàn thủ công |
| E10 | Tiền về sau khi đơn đã đóng/không còn nguyên liệu giữ hợp lệ | Không tự pha/trừ kho lại; giữ khoản thu và hồ sơ hỗ trợ |
| E11 | Ngrok/Return cấu hình sai hoặc cảnh báo trình duyệt | Return có thể chưa về UI; kết quả phải kiểm tra từ backend; không thanh toán lại chỉ vì chưa chuyển trang |

## 5. Use-case hỗ trợ cần phân biệt

- UC-09 — Đổi món sau thanh toán: xem BR-14–19, FR-14/15. Yêu cầu chưa duyệt có thể rút; yêu cầu đã duyệt chuyển tín dụng sang đơn thay thế, thu chênh lệch và giữ lịch sử.
- UC-10 — Xử lý khoản thu dư: xem BR-11/12/20, FR-16/17. Nhân viên xác minh và hoàn bên ngoài hệ thống, sau đó ghi chứng từ; phần mềm chưa tự chuyển tiền.
- UC-08 — Cập nhật pha chế: chỉ các chuyển trạng thái hợp lệ và không có yêu cầu đổi đang chờ; không dùng API trạng thái để tự xác nhận tiền.

## 6. Bộ kịch bản nghiệm thu tối thiểu

| ID | Tiền đề / bước kiểm tra | Mong đợi | Yêu cầu |
| --- | --- | --- | --- |
| UC01-T01 | Menu → tùy chọn → giỏ → đăng nhập → tạo → mock thành công → xác nhận | Một đơn, giá đúng, PAID, có lịch sử | FR-01–07 |
| UC01-T02 | Hai yêu cầu đồng thời mua phần cuối | Một thành công, một thiếu hàng; kho không âm | FR-09, NFR-02 |
| UC01-T03 | Gửi lại tạo đơn và IPN nhiều lần | Một Order cho key, một Payment áp dụng, điểm một lần | FR-05/12 |
| UC01-T04 | Mock thất bại rồi retry; hủy đơn chưa trả nếu đủ điều kiện | Trạng thái/giữ kho/hoàn snapshot theo BR-06 | FR-06/09 |
| UC01-T05 | VNPay Return hợp lệ nhưng chưa IPN | Không tự PAID; giao diện chờ/kiểm tra | FR-12 |
| UC01-T06 | VNPay IPN sai chữ ký hoặc sai tiền | Không ghi nhận thanh toán | FR-12, NFR-01 |
| UC01-T07 | Mã cũ hết hạn, query lỗi, mã mới được cấp, cả hai IPN thành công | Một lần phục vụ, khoản dư có hồ sơ | FR-13/16 |
| UC01-T08 | Đổi 45.000đ sang 75.000đ, duyệt rồi thu thêm | UI nổi bật 30.000đ; backend chỉ thu 30.000đ; không trừ kho lần hai khi trả thêm | FR-14/15 |

Các ID này là kế hoạch truy vết; chỉ đánh dấu PASS sau khi ghi commit/môi trường/log cụ thể. API test hiện có không tự thay thế UC01-T01 chạy trình duyệt với backend/database thật.
