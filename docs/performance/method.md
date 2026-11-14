# Phương pháp đo NFR-03

Kết quả chính thức của lần đo local ngày 13/11/2026 nằm ở [bộ số liệu và minh chứng](2026-11-12T18-13-27-801Z/README.md). Tên thư mục dùng UTC, còn ngày giờ hiển thị trong minh chứng là Asia/Saigon.

Tái lập từ thư mục gốc project, sau khi cài dependencies backend và bật PostgreSQL local:

```powershell
node docs/performance/tools/run.cjs
```

Script dùng kết nối trong backend/.env để tạo database tạm riêng, yêu cầu quyền CREATE DATABASE. Nó không sửa các bảng vận hành. Source được copy vào tmp, Prisma Client sinh lại và NestJS build lại; API dùng cổng trống riêng và bị dừng sau khi đo. Chỉ database có tiền tố/tên duy nhất do lần chạy đó tạo mới được xóa.

Fixture gồm 50 sản phẩm, 100 công thức, 20 tài khoản, 100 đơn và 300 dòng món. Tài khoản và đơn được tạo qua API trước phép đo. Các API đơn dùng JWT đúng chủ sở hữu. Worker hết hạn giữ món được tắt để giữ tập dữ liệu ổn định; phép đo chỉ gồm GET, không tính tốc độ tạo đơn hoặc thanh toán.

Mỗi endpoint chạy riêng 20 worker closed-loop, không think time. Warm-up 10 giây, sau đó nhận mẫu trong cửa sổ 30 giây và đợi request cuối hoàn tất. Độ trễ gồm fetch tới khi đọc hết body HTTP, không chỉ thời gian chạy SQL. Percentile dùng nearest rank trên toàn bộ mẫu; timeout hoặc sai response vẫn là mẫu lỗi, không bị loại để làm đẹp kết quả. Đạt khi p95 ≤ 500 ms và lỗi bằng 0 ở mỗi endpoint.

File results.json ghi môi trường, phiên bản database, cấu hình tải, commit và fingerprint source. CSV của từng endpoint lưu duration/status/kết quả kiểm tra. Bảng evidence.html và ảnh evidence.png được sinh từ JSON, không tự nhập số liệu khác.

Kết quả là một lần đo local: API production build chạy trực tiếp trên Windows, không phải benchmark Docker Linux; bộ phát tải dùng chung CPU và background workloads chưa được cô lập. Không suy ra hiệu năng Internet, browser, cổng VNPay hoặc sức chịu tải tối đa từ kết quả này. Không chạy lại phép đo trên database vận hành để tạo fixture.
