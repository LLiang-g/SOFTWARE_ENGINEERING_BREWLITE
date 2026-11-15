# Sao lưu và phục hồi dữ liệu BrewLite

Volume Docker giữ dữ liệu khi thay container, nhưng vẫn ghi nhận việc xóa nhầm hoặc cập nhật sai. Backup giữ một bản tại thời điểm trước sự cố để có thể lấy lại dữ liệu đó.

## Backup đi qua những bước nào?

`scripts/database/backup.ps1` xác định container db qua Compose, gọi pg_dump bên trong container và yêu cầu ghi custom archive vào file tạm. Dùng công cụ trong PostgreSQL 16 tránh phải cài client trên Windows và tránh khác phiên bản.

Archive là dữ liệu nhị phân. Script dùng docker cp để chép file, không dùng dấu chuyển hướng PowerShell để ghi các byte từ stdout. File host có đuôi partial trong khi chép; chỉ đổi thành dump khi hoàn tất. Manifest JSON chứa kích thước, hash SHA-256 và danh sách bảng lấy từ archive.

Dump bao gồm cấu trúc và dữ liệu của database, kể cả sequence, index, constraint và các schema bổ sung. Nó không chứa file .env, cấu hình merchant ở VNPay hoặc các PostgreSQL role toàn cluster. Các cấu hình đó cần được lưu riêng có kiểm soát.

## SHA-256 giúp gì?

Hash là giá trị tính từ toàn bộ byte của file. Restore tính lại và so với manifest; khác nhau thì dừng trước khi gọi Docker. Cách này phát hiện file sao chép hỏng hoặc đã bị thay đổi. Nó không xác thực người tạo nếu có người sửa cả file dump và manifest.

## Vì sao restore sang database mới?

Nếu khôi phục thẳng vào database đang phục vụ khách, một lỗi thao tác có thể phá dữ liệu còn tốt. Script tự sinh tên brewlite_restore kèm thời gian và chuỗi ngẫu nhiên, tạo database mới, rồi mới nạp archive. Không có tham số chọn tùy ý database đích, không có lệnh tự xóa database hoặc volume.

pg_restore dùng single-transaction và exit-on-error: toàn bộ phần restore phải thành công mới commit. Database mới vẫn được giữ nếu có lỗi để xem xét; một lần lỗi không tạo kết quả PASS. Kết nối backend không tự thay đổi.

## Kiểm tra sau phục hồi

`verify-restore.sql` đọc và đếm dòng các bảng, kiểm các ràng buộc đã được xác thực. Function hỗ trợ được tạo trong schema tạm và transaction được rollback sau khi đọc. Script kiểm bảng trong manifest có mặt, sau đó ghi verification JSON.

Số dòng trong báo cáo là số của bản phục hồi. Không so sánh trực tiếp với database nguồn đang tiếp tục nhận đơn rồi kết luận sai: hai bên có thể ở hai thời điểm khác nhau. Các phép kiểm tra này cũng không thay thế test chức năng web.

## Các kết quả đã có

Đã quan sát file backup thực tế 65.191 byte, manifest ghi 18 bảng và phiên bản pg_dump 16.15; hash tính lại khớp. Chưa chạy restore database thực tế trong lần cập nhật báo cáo này.

Bài thử độc lập dùng dữ liệu giả chứng minh archive đọc được, checksum phát hiện byte thay đổi và SQL phục hồi giữ đúng payment/stock. Do môi trường công cụ có client PostgreSQL 18, server 16, bài thử dùng archive dạng INSERT xuất ra SQL và bỏ thiết lập transaction_timeout không tương thích. Không coi đây là lần chạy pg_restore trong Docker; các script bàn giao dùng client 16 trong container 16.

## Vận hành

Giữ dump và manifest cùng nhau trong thư mục backups đã được Git bỏ qua. File không mã hóa và có dữ liệu riêng tư, nên giới hạn quyền truy cập và giữ thêm một bản ngoài ổ máy vận hành. Không chạy seed sau restore để tránh đặt lại dữ liệu.

Khi cần chuyển ứng dụng sang bản phục hồi thật, phải đối chiếu trước và chủ động đổi cấu hình. Database backup không hoàn tác giao dịch tại VNPay; các khoản tiền phát sinh sau thời điểm snapshot cần kiểm tra riêng.
