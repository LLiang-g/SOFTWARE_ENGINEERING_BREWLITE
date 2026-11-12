# SRS rút gọn — BrewLite

Baseline 1.0, ngày 12/11/2026. Phạm vi và stakeholder: [context-and-scope.md](context-and-scope.md). Quy tắc tiền/kho: [business-rules.md](business-rules.md). Đặc tả trọng tâm: [UC-01](use-case-checkout.md).

## 1. Cách đọc và tiêu chí hoàn thành

Must là bắt buộc trong baseline; Should là mở rộng ưu tiên cao đã thống nhất; Could là tùy điều kiện; Won't là không thực hiện ở lần bàn giao này. Nhãn ưu tiên không phải xác nhận đã xong.

Trạng thái **Có mã** nghĩa là đã thấy code tương ứng, chưa thay thế kết quả nghiệm thu trên commit bàn giao. **Một phần** nghĩa là có nền tảng nhưng thiếu điều kiện hoặc minh chứng. **Chưa có** nghĩa là chưa thấy tạo phẩm cần thiết trong bản local ngày rà soát. Test trên bản sao trong các bản vá không được tự coi là CI đã chạy trên PR.

## 2. Yêu cầu chức năng

| Mã | Yêu cầu / nguồn | MoSCoW | Tiêu chí chấp nhận có thể kiểm chứng | Hiện trạng |
| --- | --- | --- | --- | --- |
| FR-01 | Xem menu — đề Task 4.3 | Must | AC-01: GET /products trả danh sách có id, tên, giá, ảnh; UI có loading, empty và error; lỗi tải không làm mất điều hướng | Có mã; một số URL ảnh mẫu đang 404 |
| FR-02 | Xem chi tiết và tùy chọn — đề Task 5.1 | Must | AC-02: GET /products/:id trả chi tiết/options; chọn S/M/L, topping cập nhật giá; id không tồn tại có trạng thái không tìm thấy | Có mã |
| FR-03 | Giỏ hàng — đề Task 5.1 | Must | AC-03: thêm/gộp đúng tùy chọn, đổi số lượng, xóa; tổng bằng tổng dòng; reload còn giỏ; giỏ rỗng không gửi đơn | Có mã |
| FR-04 | Đăng ký, đăng nhập và JWT — đề Task 5.1 | Must | AC-04: đăng ký email duy nhất; sai mật khẩu không cấp token; API bảo vệ thiếu/sai JWT trả 401; response không lộ passwordHash | Có mã; chính sách phiên nhiều tab còn mở |
| FR-05 | Tạo đơn và tính giá ở backend — đề Task 5.1 | Must | AC-05: input hợp lệ trả Order PENDING; tiền từ quy tắc backend; sai size/topping/qty bị từ chối không đổi database; cùng key/nội dung không tạo thêm đơn | Có mã |
| FR-06 | Thanh toán Ví/Thẻ mô phỏng — đề Task 5.1 | Must | AC-06: khi chỉ bật mock, thành công ghi Payment/PAID; lỗi có kết quả PAYMENT_FAILED; mock bị chặn khi VNPay bật để không bỏ qua cổng | Có mã, cần cấu hình đúng chế độ nghiệm thu |
| FR-07 | Xác nhận, theo dõi và lịch sử — đề Task 5.1 | Must | AC-07: chủ đơn xem đúng mã/trạng thái/món/tiền; GET /orders/me không trả đơn người khác; refresh/realtime không nhân đôi dữ liệu | Có mã |
| FR-08 | Barista quản lý trạng thái — đề Task 1.2 và 5.1 | Must | AC-08: chỉ BARISTA gọi staff API; chuyển trạng thái đúng BR-21; không pha đơn thiếu tiền hoặc có REQUESTED; trạng thái cũ bị từ chối khi thao tác đồng thời | Có mã |
| FR-09 | Giữ kho đồng thời và hủy an toàn — mở rộng độ đúng nghiệp vụ | Should | AC-09: hai khách tranh phần cuối chỉ một đơn giữ thành công; kho không âm; hủy hợp lệ hoàn snapshot một lần dù Recipe đã đổi; đơn đã pha không được tự hủy | Có mã |
| FR-10 | Voucher và điểm thưởng — mở rộng | Should | AC-10: mã hết hạn/inactive bị từ chối; giảm và điểm theo BR-03/13; callback lặp không cộng lại điểm | Có mã |
| FR-11 | VNPay URL và QR — mở rộng | Should | AC-11: backend tạo URL ký đúng số tiền còn phải trả; QR mở cùng URL và có nút mở trang; URL hết hạn/đơn không payable không hiển thị QR khả dụng | Có mã; cần nghiệm thu merchant thực của nhóm |
| FR-12 | Kết quả cổng an toàn — mở rộng | Should | AC-12: sai chữ ký/merchant/amount không đổi PAID; Return chỉ chuyển hướng; IPN/QueryDr hợp lệ cập nhật đúng một lần trong transaction | Có mã |
| FR-13 | Thanh toán lại, kết quả muộn và thu trùng — mở rộng | Should | AC-13: cùng key trả cùng lần; mã còn hạn tái dùng; sau hết hạn có thể cấp lần mới, không xóa lần cũ; hai lần thành công chỉ một lần áp dụng cho đơn và khoản dư có hồ sơ xử lý | Có mã; chưa có đối soát nền |
| FR-14 | Khách yêu cầu đổi món — mở rộng | Should | AC-14: liên kết hỗ trợ nhỏ trên đơn PAID mở menu/giỏ riêng; chọn size/topping bình thường; báo giá từ backend; cùng key không tạo trùng; REQUESTED có thể rút bằng version | Có mã |
| FR-15 | Quầy duyệt đổi và thu chênh lệch — mở rộng | Should | AC-15: giá đã xác nhận giữ theo snapshot; duyệt chuyển credit/đổi giữ kho nguyên tử; tiền thu mới = total − credit; thấp hơn giá trị cũ bị từ chối; hai người cùng duyệt chỉ một thành công | Có mã |
| FR-16 | Theo dõi hoàn khoản thu không áp dụng — mở rộng | Should | AC-16: thu dư mở một hồ sơ theo attempt; BARISTA nhận xử lý, nhập chứng từ rồi hoàn tất theo version; chứng từ trùng trả lỗi; khách không tự xác nhận hoàn | Có mã cho hoàn thủ công, chưa chuyển tiền tự động |
| FR-17 | Hàng đợi hỗ trợ tại quầy — mở rộng | Should | AC-17: queue lọc trạng thái, tìm mã/email, phân trang 20 dòng; xem món cũ/mới, tiền và ghi chú; thiếu quyền 403; page/status sai 400 | Có mã |
| FR-18 | Đóng gói và chạy local — đề Task 5.2 | Must | AC-18: clone sạch, điền biến mẫu, một lệnh Compose chạy web/API/DB; migration+seed trên DB sạch tạo được dữ liệu; health endpoint phản ánh tình trạng dịch vụ | Chưa đủ: Compose chỉ có DB, Dockerfile trống, thiếu health |
| FR-19 | CI/CD và bàn giao — đề Task 4.4, 5.3–5.4 | Must | AC-19: PR tự install/lint/test/build; failed check không merge; release tạo image có version/SHA, deploy, migrate an toàn, smoke test; có cách rollback và URL HTTPS frontend/API/health | Chưa có minh chứng/pipeline trong bản local |
| FR-20 | Giao hàng | Won't | AC-20: phạm vi lần nộp ghi rõ chưa có UI tài xế/điều phối/tracking; không quảng bá trạng thái hiện tại là vòng đời giao hàng đầy đủ | Ghi nhận roadmap, không nghiệm thu ở lần này |

## 3. Yêu cầu phi chức năng

Các ngưỡng dưới đây là mục tiêu để nhóm kiểm chứng, không phải số liệu đo đã đạt.

| Mã | Yêu cầu | MoSCoW | Tiêu chí chấp nhận / phép đo | Hiện trạng |
| --- | --- | --- | --- | --- |
| NFR-01 | Bảo mật xác thực/phân quyền | Must | Mật khẩu băm; khách không đọc đơn người khác/gọi staff; 401/403/404 đúng hợp đồng; không có secret trong Git/log/ảnh | Có cơ chế; còn phải scan bản nộp và kiểm tra chính sách phiên |
| NFR-02 | Toàn vẹn tiền và kho | Must | Chạy test cạnh tranh/idempotency/rollback: không kho âm, không nhân đôi settlement/điểm, không chuyển credit vượt tổng; mọi lỗi giữa transaction không để dữ liệu dở dang | Có test API; phải chạy lại trên commit nộp |
| NFR-03 | Hiệu năng API nội bộ | Should | Với 50 sản phẩm, 20 người dùng đồng thời, sau warm-up: p95 GET sản phẩm và GET đơn ≤500ms trên môi trường ghi rõ CPU/RAM/DB; tách độ trễ gateway khỏi số liệu; ghi tỷ lệ lỗi và lệnh đo | Chưa có báo cáo tải |
| NFR-04 | Mobile-first và khả năng truy cập | Must | Ở 390px và 1440px không tràn ngang; nhãn form, focus bàn phím, thông báo lỗi và trạng thái chờ rõ; nút chính tối thiểu 44px; xác nhận tiền không chỉ dựa màu sắc | Có UI; cần checklist nghiệm thu toàn bộ luồng |
| NFR-05 | Tính khả dụng và phục hồi | Must | Có loading/empty/error, retry có kiểm soát; mất Return không mất kết quả đã ghi; không treo UI vô hạn; health check production dùng cho smoke | Một phần; thiếu health/đối soát nền |
| NFR-06 | Tái tạo và triển khai | Must | Install từ lockfile; build frontend/backend; migration+seed trên database mới; Compose đủ 3 dịch vụ; HTTPS và DB production không public trực tiếp | Chưa đủ cấu hình và minh chứng |
| NFR-07 | Quan sát và hỗ trợ | Must | Log có thời gian và tham chiếu lỗi, không lộ token/secret; phân biệt Order/attempt/refund; có hướng dẫn xử lý lỗi thanh toán; health không trả cấu hình nhạy cảm | Audit có mã; health/log vận hành còn thiếu |
| NFR-08 | Bảo trì và truy vết | Must | Mỗi FR/NFR liên kết use-case, thiết kế, code/test; sơ đồ có nguồn+render; quyết định có ADR; không có đường dẫn/file minh chứng giả | Đang thiết lập baseline, chưa đủ Task 2/3 |
| NFR-09 | Quality gate | Must | CI tự chạy trên PR, branch protection yêu cầu checks; lưu link/log một lần thành công và một lần phát hiện lỗi; test không dùng database production | Chưa nghiệm thu |
| NFR-10 | Sao lưu, migration và khôi phục | Must | Backup trước migration; thử khôi phục DB riêng; script deploy không reset hoặc seed đè DB đang dùng; runbook rollback nêu phần app và phần dữ liệu | Chưa có runbook và bằng chứng |
| NFR-11 | Phiên đăng nhập nhất quán | Should | Chính sách một tài khoản/origin hoặc phiên riêng/tab được chốt; đổi tài khoản/logout không để response cũ ghi đè user/token mới; có test hai tab và reload | Lỗi dùng chung localStorage đã ghi nhận, chưa sửa |
| NFR-12 | Cài đặt PWA | Could | Có manifest, icon và kiểm tra cài đặt nếu nhóm chọn triển khai PWA; không coi hỗ trợ mobile là bằng chứng đã có offline/PWA | Chưa có manifest/service worker; đề định hướng mobile-first/PWA |

## 4. Điều kiện chấp nhận Task 1

- Có bảng stakeholder, in/out-of-scope, giả định, ràng buộc và rủi ro.
- Mỗi FR/NFR có mã, ưu tiên và phép kiểm chứng; trạng thái không trộn với mức ưu tiên.
- Có use-case tổng quát và UC-01 với actor/trigger/pre/post/main/alternative/exception cùng liên kết FR.
- Tài liệu và report nhất quán về thời điểm giữ kho, Return/IPN, đổi món, tiền chuyển và hoàn thủ công.
- Nhóm review baseline bằng commit/PR thực tế. Tài liệu này không tự chứng minh đã hoàn thành thứ tự task trong lịch sử Git trước đây.

## 5. Mẫu nghiệm thu cho từng tiêu chí

Mỗi lần chạy ghi: mã AC/NFR, commit SHA, ngày giờ, người chạy, môi trường, dữ liệu đầu vào, bước thực hiện, kết quả mong đợi/thực tế, log/ảnh và kết luận đạt/chưa đạt. Link test có sẵn không thay kết quả chạy; link proposal không chứng minh thay đổi đã được ghép vào mã gốc.
