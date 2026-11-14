# CI và phát hành image trong BrewLite

CI là quá trình GitHub tự kiểm tra thay đổi. Trong project, CI chạy lint, test, build ứng dụng và kiểm tra Docker trên môi trường tạm. CD nhận các bản đã kiểm tra để phát hành và có thể triển khai sang môi trường đích. Phát hành image thành công chưa đồng nghĩa máy chạy ứng dụng đã cập nhật image đó.

## Vì sao chia nhiều job?

Backend và frontend có dependencies và cách kiểm tra khác nhau nên chạy song song. Backend cần PostgreSQL riêng để chạy test transaction/tồn kho; frontend cần lint và production build. Khi hai job này đạt, job Docker mới kiểm tra cách ba dịch vụ thực sự phối hợp.

Job Docker còn chạy chính script backup/restore của project trên database CI. Việc này kiểm tra cả cách truyền file nhị phân, manifest và khôi phục database riêng trong môi trường container, thay vì chỉ kiểm tra cú pháp PowerShell.

## CI passed làm gì?

Job này đọc trạng thái các job trước. Chỉ cần một job failed, cancelled hoặc skipped thì nó không báo đạt. Publish phụ thuộc vào nó nên không phát hành khi test lỗi. Nếu muốn GitHub chặn merge, phải cấu hình ruleset yêu cầu check CI passed; chỉ có file YAML chưa tự tạo quy tắc đó.

Database CI dùng mật khẩu giả và được hủy sau lần chạy. Các test chủ động tạo fixture; không trỏ CI vào database quán. Fixture topping được bổ sung để các bài test cũ thực sự đi qua quy tắc định lượng mới, không phải tắt kiểm tra kho.

## Ba image có nhiệm vụ gì?

- Backend runtime: code NestJS đã build và thư viện chạy ứng dụng.
- Frontend: Next.js standalone và tài nguyên tĩnh.
- Tools: Prisma CLI và tsx để migrate/seed khi được yêu cầu.

Tools tách riêng vì runtime phục vụ khách không cần mang toàn bộ công cụ phát triển. Trong CD, tools chạy migration của cùng commit đã phát hành; deploy không seed database vận hành.

## Tag, commit và digest khác nhau thế nào?

Commit cho biết phiên bản mã nguồn. Tag image là tên dễ dùng, chẳng hạn sha-... hoặc v1.0.0. Digest sha256 nhận diện nội dung image cụ thể; nếu nội dung khác thì digest khác.

Workflow xuất ba digest sau khi publish xong. Deploy dùng digest đó để lấy chính xác image, không lấy một latest có thể đã trỏ sang nội dung khác. Artifact release-images.env giúp người vận hành biết bộ ba image đi cùng nhau.

## Vì sao push khanh không publish?

Mọi nhánh/PR có thể chạy CI. Publish giới hạn ở nhánh mặc định hoặc tag phiên bản để không phát hành mọi thử nghiệm. Deploy có điều kiện chặt hơn: nhánh mặc định, đã publish và được bật theo cấu hình hoặc ô deploy khi Run workflow.

Re-run dùng lại input của lần chạy cũ. Nếu lần trước không chọn deploy, re-run không tự biến lựa chọn đó thành true. Trạng thái Success toàn workflow vẫn có thể đi cùng job Deploy skipped; cần đọc trạng thái từng job.

## Runner và môi trường đích

Runner GitHub chạy các kiểm tra trên máy tạm. Runner Windows tự quản lý nhận riêng job triển khai và thực thi trên máy đã đăng ký; vì vậy DEPLOY_ROOT phải là đường dẫn trên chính máy đó. Listening for Jobs chỉ chứng minh runner online, không chứng minh ứng dụng đã deploy.

Các label trong workflow phải khớp runner, gồm brewlite-deploy. Máy đích cần có Docker đang chạy, file môi trường riêng và database đã khởi tạo. Đăng nhập GitHub không làm các file .env vốn bị Git bỏ qua xuất hiện trên máy khác.

## Backup và rollback trong deploy

Script pull image trước, lưu tham chiếu image cũ, dừng ứng dụng rồi backup trước khi migrate. Nếu backup lỗi thì không chạy migration. Nếu migration hoặc bản mới lỗi, script cố bật image app cũ nhưng vẫn báo job failed.

Rollback image không khôi phục database. Schema mới phải tương thích với app cũ; nếu không, cần đối chiếu backup và phục hồi có kiểm soát. Không tự restore đè database vì có thể mất đơn/giao dịch mới. File active-images.env và overlay giúp bật lại đúng image phát hành sau này.

## Bằng chứng hiện có

Ảnh Actions nhóm cung cấp ghi nhận backend, frontend, Docker smoke backup restore, CI passed và Publish đều Success trên main, commit 761803c. Deploy trong lần minh họa là Skipped. Báo cáo ghi đúng phạm vi này, không coi phát hành image là bằng chứng deploy thành công.

Ảnh tổng hợp trong báo cáo được trình bày lại từ screenshot nhóm cung cấp và ghi rõ nguồn; ảnh code lấy từ workflow thực tế. Khi có kết quả deploy thực tế có thể bổ sung minh chứng riêng sau.
