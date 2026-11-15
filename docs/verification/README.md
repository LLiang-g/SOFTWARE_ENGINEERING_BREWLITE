# Hồ sơ kiểm chứng bổ sung

`unit-results.json` là báo cáo Vitest chạy trên mã backend hiện tại. Số ca và thời gian được lấy trực tiếp từ báo cáo, không nhập tay. `unit-evidence.html` và ảnh tương ứng là bản trình bày số liệu gốc, không phải ảnh GitHub Actions.

Chạy lại từ thư mục `backend`:

```powershell
npm.cmd run test -- --reporter=json --outputFile=../docs/verification/unit-results.json
```

Kiểm thử API dùng database tạm trên PostgreSQL local:

```powershell
node docs/verification/run-api.cjs
```

Script tạo database có tên riêng, chạy migration khởi tạo và test hiện tại, sau đó xóa chính database tạm. Không chạy migration lên database ứng dụng. Cần PostgreSQL hoạt động và tài khoản local có quyền tạo database. Lần thử bổ sung không kết nối được PostgreSQL (`ECONNREFUSED`), vì vậy không công bố kết quả API mới. Kết quả API trong báo cáo tiếp tục tham chiếu lần CI đã ghi nhận.

Bảng nghiệm thu trong PDF phân biệt kết quả thực thi và tiêu chí cần kiểm chứng. Các ca trình duyệt không được tự gán PASS từ việc đọc code hoặc chụp một màn hình. Hồ sơ từng lần chạy cần: mã ca, thời gian, commit, môi trường, kết quả quan sát, ảnh/log gốc. CD không nằm trong đợt cập nhật này.
