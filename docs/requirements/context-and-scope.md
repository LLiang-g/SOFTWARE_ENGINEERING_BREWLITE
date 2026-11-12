# Bối cảnh, stakeholder và phạm vi BrewLite

Phiên bản đặc tả: 1.0 — 12/11/2026. Nguồn: `Assignment2-BrewLite.pdf` bản 1.0 và các quyết định nghiệp vụ đã thống nhất trong quá trình phát triển. Tài liệu này là baseline yêu cầu; không phải biên bản xác nhận mọi yêu cầu đã được triển khai.

## 1. Vấn đề và mục tiêu

Quán cà phê nhỏ hoặc vừa cần nhận đơn trước, giảm thời gian khách chờ chọn món và trả tiền tại quầy. Nhận đơn thủ công dễ dẫn đến sai tùy chọn, tính tiền không thống nhất, nhận quá khả năng nguyên liệu và khó xác định kết quả thanh toán khi mất mạng.

BrewLite cho khách xem menu, chọn size/topping, tạo giỏ, đăng nhập, đặt và thanh toán, sau đó theo dõi đơn. Barista tiếp nhận đơn đã đủ tiền, cập nhật pha chế và xử lý yêu cầu đổi món/khoản thu bất thường. Quản lý là stakeholder nghiệp vụ; phiên bản hiện tại chưa có vai trò đăng nhập quản lý riêng.

Mục tiêu nghiệm thu Assignment 2: người ngoài nhóm có thể clone repository, làm theo README để chạy local, và mở frontend/API production qua URL được bàn giao. Chức năng phải đi kèm tài liệu, sơ đồ, test và minh chứng CI/CD; VNPay Sandbox không thay thế yêu cầu delivery.

## 2. Stakeholder

| Mã | Stakeholder | Mục tiêu / kỳ vọng | Trách nhiệm và mức tham gia |
| --- | --- | --- | --- |
| ST-01 | Khách hàng | Chọn đúng món, biết rõ giá và số tiền phải trả; không bị thu lặp; biết trạng thái đơn | Actor sử dụng menu, giỏ, đơn và yêu cầu hỗ trợ; phản hồi trải nghiệm |
| ST-02 | Barista / nhân viên quầy | Chỉ pha đơn đủ điều kiện, không bỏ sót yêu cầu đổi, tra cứu và xử lý khoản thu dư | Actor cập nhật trạng thái, duyệt/từ chối đổi, ghi nhận hoàn thủ công; đồng thời làm nghiệp vụ thanh toán tại quán nhỏ |
| ST-03 | Quản lý / người đại diện cửa hàng | Kiểm soát chính sách giá, nguyên liệu, đổi món và thu tiền | Chốt quy tắc và ưu tiên backlog; không mặc định có dashboard hay role ADMIN trong bản hiện tại |
| ST-04 | Giảng viên / khách hàng nghiệm thu | Đánh giá đủ 5 task, tính nhất quán, lịch sử thay đổi và sản phẩm triển khai được | Đối chiếu tiêu chí, sơ đồ, code, test, CI/CD, demo và tài liệu |
| ST-05 | Nhóm phát triển | Mã nguồn tái tạo được, dễ kiểm thử và bàn giao | Phân tích, thiết kế, phát triển, review, kiểm thử và triển khai; xác nhận phân công PO/SM bằng minh chứng thực tế |
| ST-06 | Dịch vụ thanh toán | Nhận yêu cầu hợp lệ, phản hồi kết quả và được merchant xác nhận | Mock Ví/Thẻ trong yêu cầu tối thiểu; VNPay Sandbox trong phần mở rộng; ngân hàng thật không thuộc môi trường Sandbox |
| ST-07 | Người vận hành / nền tảng triển khai | Dịch vụ có health check, secret, log, migration và rollback rõ ràng | Chuẩn bị môi trường CI/production và tài khoản triển khai; chưa có nền tảng production được nghiệm thu |

## 3. In-scope

### Bắt buộc theo Assignment 2

- Next.js mobile-first, NestJS và PostgreSQL; luồng menu → tùy chọn → giỏ → xác thực → đặt → thanh toán → theo dõi.
- API sản phẩm, xác thực JWT, tạo đơn, thanh toán Ví/Thẻ mô phỏng, lịch sử và quản lý trạng thái; loading/empty/error và validation.
- Tài liệu bối cảnh, SRS, use-case; activity/sequence/class/deployment diagram; ADR và ma trận truy vết.
- Unit, integration và ít nhất một E2E từ menu tới xác nhận đơn; migration/seed tái tạo database sạch.
- Docker Compose chạy đủ web/API/database; health endpoint; CI chặn merge lỗi; CD, production HTTPS, release, README/deploy/rollback và minh chứng Scrum.

### Mở rộng đã thống nhất

- Giữ nguyên liệu theo công thức trong transaction, khóa dòng và lưu snapshot; hủy hợp lệ hoàn đúng snapshot một lần.
- Idempotency khi tạo đơn và tạo lần thanh toán; ghi nhận kết quả thanh toán một lần.
- VNPay Sandbox: URL/QR mở trang thanh toán, IPN, Return, QueryDr, retry sau khi mã hết hạn và đối soát khoản thu muộn/trùng.
- Voucher, cộng điểm theo tiền mới thực trả; không cộng lại điểm cho tiền chuyển giữa các đơn đổi.
- Đổi toàn bộ đơn đã trả nhưng chưa pha: menu/giỏ riêng, báo giá backend, barista duyệt, chuyển tín dụng và thu chênh lệch.
- Theo dõi khoản thu dư và hoàn thủ công có chứng từ; không coi thao tác đánh dấu hoàn là lệnh chuyển tiền.

## 4. Out-of-scope trong lần nghiệm thu này

- Thanh toán tiền thật/merchant production, tự thực hiện refund VNPay, ví nội bộ và lưu số thẻ/OTP.
- Ứng dụng tài xế, điều phối tuyến giao, theo dõi GPS và tích hợp hãng vận chuyển. Nhu cầu giao hàng được ghi nhận cho roadmap; schema và state machine hiện tại chưa đại diện đầy đủ vòng đời giao hàng.
- Đổi một phần, đổi sau khi pha, rút lại lần đổi đã duyệt, thanh toán chênh lệch dưới 5.000đ bằng phương thức riêng.
- POS hoàn chỉnh, dashboard quản lý, mua hàng nhà cung cấp, kế toán/thuế và hóa đơn điện tử.

Các phần tự hết hạn giữ kho, đối soát nền và xử lý đơn đổi bỏ thanh toán là backlog vận hành còn mở. Không mô tả chúng là đã có.

## 5. Giả định và ràng buộc

| Mã | Nội dung |
| --- | --- |
| AS-01 | Một quán nhỏ/vừa; BARISTA vừa pha chế vừa xử lý thanh toán và hỗ trợ, không tách cashier |
| AS-02 | Tiền VND lưu bằng số nguyên; frontend không truy cập PostgreSQL trực tiếp và không quyết định giá chính thức |
| AS-03 | Giỏ không giữ hàng. Tạo Order hợp lệ mới trừ/giữ nguyên liệu; thao tác thanh toán không trừ kho lần nữa |
| AS-04 | Thanh toán qua VNPay là Sandbox; QR trên website chứa URL mở cổng, không phải QR chuyển khoản ngân hàng |
| AS-05 | Không suy ra thất bại hay đã được ngân hàng hoàn tiền chỉ từ timeout. Retry sau hết hạn có thể gây thu dư; phải giữ giao dịch cũ và hồ sơ xử lý |
| AS-06 | Frontend public phải truy cập được trên thiết bị khách. localhost/ngrok thay đổi không phải bằng chứng production ổn định |
| CON-01 | Bắt buộc Next.js, NestJS, PostgreSQL; dùng Docker cho đóng gói/triển khai theo đề |
| CON-02 | Tạo phẩm 5 task theo thứ tự và lưu trong Git. Không tạo lịch sử Sprint/PR/CI giả để bù phần thiếu |
| CON-03 | Secret không đưa vào tài liệu, ảnh, Git hoặc log CI. File .env.example chỉ chứa mẫu |
| CON-04 | Không reset database đang dùng để sửa migration. Kiểm thử clean database và migration tăng dần là hai kiểm tra riêng |
| CON-05 | Hai tab cùng origin hiện dùng chung localStorage auth. Cần quyết định chính sách phiên; chưa được coi là hỗ trợ đăng nhập độc lập mỗi tab |

## 6. Rủi ro và cách kiểm soát dự kiến

| Mã | Rủi ro | Kiểm soát / trạng thái |
| --- | --- | --- |
| R-01 | Hai khách cùng mua phần cuối | Transaction, khóa Ingredient có thứ tự, test cạnh tranh; cần nghiệm thu lại commit nộp |
| R-02 | Gửi lại tạo đơn hoặc IPN gây lặp | Unique key, khóa Order, transaction và kiểm tra bằng test |
| R-03 | Timeout nhưng tiền đã về / thu trùng | Giữ lịch sử attempt, IPN/QueryDr, REVIEW và hồ sơ hoàn; đối soát nền còn thiếu |
| R-04 | Đơn bỏ thanh toán giữ kho lâu | Chưa có scheduler thu hồi; phải bổ sung chính sách trước vận hành thật |
| R-05 | Hai nhân viên cùng duyệt/hoàn | Version CAS và transaction, ghi nhật ký |
| R-06 | Báo cáo mô tả khác code / đề cũ | Baseline FR/NFR, bảng trạng thái và cập nhật report cùng thay đổi |
| R-07 | Init bị sửa sau khi đã áp dụng | Kiểm tra drift/lịch sử; không tự đánh dấu migration thành công khi chưa đối chiếu |
| R-08 | Chưa có CI/CD và production | Chưa nghiệm thu Task 4/5 cho tới khi có pipeline, URL và minh chứng |

## 7. Quản lý thay đổi

Thay đổi nghiệp vụ cần cập nhật SRS, use-case, quy tắc nghiệp vụ, ma trận truy vết và báo cáo cùng commit/PR. Mỗi thay đổi ghi lý do, tác động tiền/kho, test liên quan và trạng thái nghiệm thu. Nhóm bổ sung thông tin phê duyệt thực tế khi review; ngày lập đặc tả không được dùng thay ngày hoàn thành Sprint.
