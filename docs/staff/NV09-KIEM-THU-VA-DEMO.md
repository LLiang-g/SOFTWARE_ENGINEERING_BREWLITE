# NV-09 — Kiểm thử và demo trang nhân viên

Ngày kiểm tra 06/11/2026. Phần frontend của Lâm tại `0c4f659`, ghép khi chạy với backend của Nhật tại `8813102`. Hai phần được chạy từ hai thư mục riêng. Backend của Nhật hiện chưa được merge vào `lam`.

## 1. Kết quả đã kiểm tra

Môi trường Windows, Node.js 24, PostgreSQL 16 trong Docker/WSL 2. Database kiểm thử riêng là `brewlite_nv09_20261106`. Frontend thử nghiệm ở cổng 3118, backend ở 3318. Các bước demo bên dưới dùng cổng mặc định 3000/3001.

| Ca kiểm tra | Kết quả thực tế |
|---|---|
| Mở trực tiếp `/nhanvien` | Vào được, có navbar nhân viên và liên kết về trang khách |
| Danh sách rỗng | Bốn cột đều có thông báo chưa có đơn |
| Khách tạo đơn rồi thanh toán | Đơn `PENDING` được ẩn ở quầy. Sau thanh toán, cả hai quầy tự hiện đơn `PAID` |
| Thẻ đơn | Đúng mã đơn, thời gian, tên món, size, topping, số lượng và tổng tiền |
| Bấm Duyệt đơn hai lần liên tiếp | Nút chuyển thành Đang cập nhật và bị khóa. Tab đó chỉ gửi một PATCH |
| Hai tab cùng duyệt một đơn | Một PATCH trả 200, một PATCH trả 409. Bên nhận 409 có thông báo và tự tải trạng thái mới |
| Pha xong và Đã giao khách | Đơn đi đúng `PREPARING → READY → COMPLETED`. Đơn hoàn tất hết nút thao tác |
| Khách theo dõi | Trang chi tiết và lịch sử đơn tự đổi theo các thao tác tại quầy |
| GET danh sách trả 503 | Hiện lỗi, giữ danh sách cũ, khóa nút thao tác. Bấm Tải lại thành công thì dùng tiếp được |
| PATCH cập nhật trả 503 | Hiện lỗi, giữ trạng thái trước đó và mở lại nút để thử lại |
| Chỉ ngắt WebSocket của quầy B | B báo chưa kết nối. A và khách vẫn cập nhật được |
| Tải lại khi WebSocket của B bị ngắt | B vẫn lấy được đơn mới qua HTTP |
| B kết nối lại sau khi bỏ lỡ thay đổi | Tự tải trạng thái COMPLETED dù sự kiện đã phát lúc B mất kết nối |
| Phản hồi GET cũ bị giữ chậm 3,5 giây | Sau sự kiện mới, đơn vẫn ở PREPARING. Phản hồi cũ không kéo về PAID |
| Màn hình 1280 px | Bốn cột nằm cạnh nhau |
| Màn hình 768 px | Hai cột trên một hàng, không tràn ngang |
| Màn hình 390 px và 320 px | Một cột, đọc và bấm nút được, không tràn ngang |
| Tiền, kho và điểm sau thao tác quầy | Mỗi đơn thử chỉ có một Payment. Kho và điểm đúng số lượng mua, không bị trừ/cộng thêm bởi các bước duyệt/pha/giao |

Lỗi 503, độ trễ và ngắt WebSocket được tạo bằng công cụ kiểm thử local trong bản sao backend, ngoài repo sản phẩm. Trong ca mất kết nối riêng B, HTTP vẫn hoạt động. Mobile được kiểm tra bằng kích thước trình duyệt, chưa thử trên điện thoại vật lý. Sự kiện realtime là WebSocket thật của backend Nhật.

Các kiểm tra tự động và build đã đạt trong lần chạy này

- Backend `npm run lint`, `npm run build`, 19 unit test và 31 e2e test.
- Frontend `npm run lint`, `npm run build`.
- Build Next.js 16.4.0 hiện cảnh báo bảo mật của phiên bản hiện tại. Lần build đầu dừng vì nhắc nâng cấp, chạy lại hoàn tất. Việc cập nhật phiên bản cần được nhóm thống nhất.

## 2. Cách chạy trên máy Lâm

Phần này dùng hai thư mục vì `lam` hiện chỉ chứa frontend nhân viên. Nếu backend nhân viên đã được ghép vào nhánh đang chạy sau này, dùng ngay thư mục `backend` của repo đó.

**Chuẩn bị backend Nhật một lần trong CMD**

```cmd
cd /d D:\CNPM\SOFTWARE_ENGINEERING_BREWLITE
git fetch origin nhat
git worktree add --detach ..\BrewLite-backend-NV09 8813102
cd /d D:\CNPM\BrewLite-backend-NV09\backend
npm ci
```

Nếu đã có thư mục worktree này, dùng lại thư mục đó. Lệnh worktree tạo một bản checkout riêng của backend đã kiểm thử, frontend trên `lam` vẫn dùng thư mục cũ.

**Bật database trong Ubuntu**

```bash
cd /mnt/d/CNPM/SOFTWARE_ENGINEERING_BREWLITE
sudo systemctl start docker
sudo docker compose up -d db
sudo docker compose exec db pg_isready -U brewlite -d brewlite
sudo docker compose exec db createdb -U brewlite brewlite_nv09_demo
```

Chờ `accepting connections` rồi mới tạo database. Database demo chỉ tạo một lần, nếu báo đã tồn tại thì dùng tiếp. Giữ Ubuntu mở khi chạy demo.

**Chạy backend trong CMD thứ nhất**

```cmd
cd /d D:\CNPM\BrewLite-backend-NV09\backend
set "DATABASE_URL=postgresql://brewlite:brewlite@localhost:5432/brewlite_nv09_demo?schema=public"
set "JWT_SECRET=brewlite-nv09-local-demo-only"
set "FRONTEND_URL=http://localhost:3000"
set "PORT=3001"
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Các biến trên dùng trong cửa sổ CMD hiện tại và phục vụ demo local. Khi mở CMD mới, đặt lại chúng. Mở `http://localhost:3001/staff/orders` để kiểm tra API, danh sách `[]` cũng là kết quả hợp lệ.

**Chạy frontend trong CMD thứ hai**

```cmd
cd /d D:\CNPM\SOFTWARE_ENGINEERING_BREWLITE\frontend
npm ci
set "NEXT_PUBLIC_STAFF_API_ENABLED=true"
set "NEXT_PUBLIC_API_URL=http://localhost:3001"
npm run dev
```

Frontend cần chạy ở cổng 3000 để khớp cấu hình CORS. Giữ hai cửa sổ CMD mở. Nếu thấy dòng Đang dùng đơn mẫu, đặt lại biến `NEXT_PUBLIC_STAFF_API_ENABLED` rồi khởi động lại frontend trong cùng CMD.

## 3. Demo bằng ba cửa sổ

1. Mở A và B ở `http://localhost:3000/nhanvien`. Cả hai hiện Đang cập nhật trực tiếp.
2. Mở C ở `http://localhost:3000`. Đăng ký tài khoản thử, chọn món, thêm giỏ và đặt đơn. Đơn chưa thanh toán chưa hiện ở quầy.
3. Thanh toán ở C. A và B tự hiện đơn trong Chờ duyệt.
4. A bấm Duyệt đơn. A/B sang Đang pha chế, C tự đổi trạng thái.
5. B bấm Pha xong. Cả ba thấy Sẵn sàng nhận.
6. A bấm Đã giao khách. Cả ba thấy Đã hoàn tất. Mở thêm `/orders` để xem lịch sử tự cập nhật.
7. Với một đơn mới đã thanh toán, mở DevTools của riêng B, vào Network, chọn Offline. Đổi trạng thái ở A. Đưa B về No throttling/Online, B phải tự đồng bộ mà không bấm F5. Kết thúc phải đưa trình duyệt về Online.
8. Nếu muốn thử hai người cùng duyệt, dùng đơn mới và bấm Duyệt gần như cùng lúc trên A/B. Khi tab thứ hai đã kịp nhận trạng thái mới và ẩn nút, tạo đơn khác để thử lại. Ca race tự động của backend kiểm tra chắc chắn một bên 200 và bên kia 409.

Khi demo có thể giải thích ngắn gọn như sau.

> Nhân viên chỉ nhận đơn đã thanh toán. Duyệt đơn là bắt đầu pha, pha xong là sẵn sàng nhận, giao cho khách mới là hoàn tất. HTTP lưu và đọc đơn trong database. WebSocket báo có thay đổi để các màn hình gọi lại API. Khi nối lại, màn hình tự tải đơn mới để bù những thay đổi bị bỏ lỡ.

## 4. Ảnh kiểm thử

- [Bảng quầy desktop](desktop.jpg)
- [Bảng quầy mobile](mobile.jpg)
- [Quầy B mất kết nối](disconnected.jpg)
- [Quầy B tự đồng bộ sau khi nối lại](reconnected.jpg)
- [Dữ liệu mới được giữ sau phản hồi cũ đến chậm](latest-response.jpg)

Phần NV-09 được bàn giao để Nhật kiểm tra chéo. Nhánh `lam` vẫn cần ghép với backend nhân viên và được nhóm trưởng review theo quy trình của nhóm.
