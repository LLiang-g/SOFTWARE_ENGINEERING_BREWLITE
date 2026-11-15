# Kiểm chứng bố cục và form — 14/11/2026

Đã chạy trên Microsoft Edge, một stack Docker/database thử riêng, không dùng dữ liệu ứng dụng. Stack thử được dọn sau khi kiểm tra.

## Kết quả

- 5 màn hình: menu, chi tiết Cà phê sữa, giỏ rỗng, đăng nhập, đăng ký.
- 2 viewport: **390 × 950** và **1440 × 950**.
- **10/10 lượt không tràn ngang**: document/body scrollWidth không vượt chiều rộng viewport.
- Ở cả hai độ rộng, trường Email/Mật khẩu của hai form có label truy cập được qua Playwright; từ Email bấm Tab đưa focus sang input password.
- Mỗi lượt lưu ảnh PNG thực tế, dữ liệu đo nằm trong `results.json`.

## Phạm vi kết luận

Đây là kiểm tra bố cục và label/focus cơ bản, không phải kiểm toán accessibility toàn bộ. Giỏ ở trạng thái rỗng; các trang yêu cầu đăng nhập, mọi trạng thái nhiều tab, mọi kích thước nút 44px và mọi tổ hợp size/topping không được bao phủ bởi phép thử này. Browser E2E 16 ca có hồ sơ riêng tại `../browser-e2e-2026-11-14/`.

Script tái hiện trong phiên làm việc: `tmp/check-responsive-evidence.cjs`; môi trường thử Docker dùng web 4100 và API 4101. Không thay code ứng dụng hoặc file env gốc.
