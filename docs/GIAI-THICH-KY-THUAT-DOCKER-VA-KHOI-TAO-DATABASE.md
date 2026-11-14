# Docker và khởi tạo database trong BrewLite

## Một lệnh thực sự làm gì?

`docker compose --env-file .env.docker up -d --build` build image nếu cần, tạo container và bật ba dịch vụ: database, backend, frontend. Container là môi trường chạy; image là gói chứa chương trình cùng thư viện. Docker không yêu cầu người nhận tự cài đúng Node để chạy ứng dụng trong container.

Lệnh này không tự thêm dữ liệu mẫu. Database mới cần migrate/seed một lần; những lần sau giữ dữ liệu trong volume. Vì vậy bật lại ứng dụng không đặt lại kho hoặc tạo lại tài khoản.

## Vì sao có ba địa chỉ khác nhau?

- Trình duyệt Windows gọi `localhost:3000` để mở web và `localhost:3001` để gọi API.
- Frontend server ở trong container gọi `backend:3001`.
- Backend trong container kết nối database qua `db:5432`.

`localhost` luôn có nghĩa là nơi chương trình đang chạy. Nếu frontend container gọi localhost:3001 thì nó tìm backend trong chính container frontend. Compose cho phép tìm container khác bằng tên service, nên phải dùng `backend` và `db` cho mạng nội bộ.

Hàm `catalogApiUrl()` trong `frontend/src/lib/api.ts` chọn URL theo nơi thực thi. URL public vẫn được dùng cho trình duyệt/realtime; URL nội bộ phục vụ các hàm đọc menu, chi tiết chạy phía server. Đây là chọn đường gọi API, không phải cho frontend truy cập PostgreSQL.

## Vì sao Dockerfile backend có nhiều stage?

Stage `tools` cài dependencies bằng lockfile, nhận source và tạo Prisma Client ngay trong Linux. Không đưa `node_modules` hoặc Client đã tạo trên Windows vào image. Bước `npm ci --ignore-scripts` bỏ các lifecycle script không cần cho đóng gói; `prisma generate` được gọi rõ ràng sau đó.

Stage `build` biên dịch TypeScript thành JavaScript rồi bỏ dependencies phát triển. Runtime chỉ cần `dist`, dependencies chạy ứng dụng và package.json; chạy `node dist/main.js` dưới user node.

Prisma CLI và tsx cần cho migrate/seed nhưng không cần trong runtime phục vụ khách. Hai service setup dùng stage tools, nên vẫn có đủ công cụ mà không phải đưa chúng vào image backend cuối.

## Frontend standalone là gì?

`output: "standalone"` yêu cầu Next.js gom server và những dependencies được phân tích là cần thiết. Runtime chạy `server.js`; phải copy thêm `public` và `.next/static` để đủ ảnh, JavaScript và CSS.

`NEXT_PUBLIC_API_URL` được đưa vào JavaScript của trình duyệt lúc build. Đổi nó cần build lại image frontend. `SERVER_API_URL` được server đọc lúc chạy, nên không phải địa chỉ mà trình duyệt phải phân giải.

## Volume giữ dữ liệu như thế nào?

PostgreSQL ghi vào volume `brewlite-data`. Xóa/tạo lại container không đồng nghĩa xóa volume. Tuy nhiên volume thực tế có tiền tố tên Compose project; đổi thư mục hoặc dùng tên project khác có thể khiến Compose tạo một volume mới. Khi đó dữ liệu cũ vẫn có thể còn trong volume cũ, chỉ là container đang dùng nơi khác.

Biến `POSTGRES_PASSWORD` dùng khi PostgreSQL khởi tạo database mới. Sửa biến này không đổi mật khẩu của database trong volume cũ. Backend phải dùng credentials khớp với database thực tế.

## Migration, generate và seed khác nhau ở đâu?

- Migration: tạo hoặc thay đổi cấu trúc database.
- Generate: sinh mã Prisma Client để TypeScript gọi các model đúng kiểu; không tạo bảng.
- Seed: thêm/cập nhật dữ liệu mẫu.

File init đầy đủ tạo enum trước, bảng tiếp theo, rồi index và khóa ngoại theo quan hệ phụ thuộc. Transaction giúp các bước khởi tạo cùng thành công hoặc rollback. CHECK và partial unique index bổ sung điều kiện database cần bảo vệ: kho không âm, định lượng dương, credit hợp lệ và chỉ một yêu cầu đổi đang chờ cho mỗi đơn.

Chỉ chạy init trên database mới. Không lấy việc sửa file init làm cách cập nhật database đã chạy; các lần nâng cấp vận hành sau cần migration mới. Không tự tạo snapshot cho đơn cũ bằng công thức hiện tại.

Seed hiện tại có thể đặt lại tồn kho mẫu. Vì vậy service seed nằm trong profile setup và chỉ chạy khi người vận hành chủ động yêu cầu. Không chạy seed mỗi lần container bật.

## Healthcheck và thứ tự khởi động

Database dùng `pg_isready`. Backend đọc `/products`, kiểm tra được đường API tới cấu trúc dữ liệu. Frontend chờ backend healthy trước khi bật, rồi tự kiểm tra HTTP trang chủ.

`health: starting` ngay sau lúc tạo container là trạng thái đang chờ kiểm tra, không phải kết luận lỗi. HTTP 200/healthy không chứng minh thao tác đổi món hoặc thanh toán đúng; những việc đó vẫn cần kiểm thử nghiệp vụ riêng. `restart: unless-stopped` không tự restart chỉ vì healthcheck chuyển unhealthy.

## Phần nào đã được kiểm chứng?

Init đã chạy trên PostgreSQL thử nghiệm riêng; Prisma diff không còn khác biệt trong phạm vi schema được Prisma quản lý. Seed tạo 4 món, 12 dòng công thức và 2 công thức topping; thử stock âm bị từ chối.

Hai ứng dụng đã build và đường gọi URL đã được kiểm tra. Người triển khai cung cấp log hai image Built, database/backend healthy, frontend Started và health đang starting ở lần đọc ngay sau đó. Lần kiểm tra local sau triển khai nhận HTTP 200 ở web và API; ảnh menu chụp từ trang đang phục vụ. Những kết quả này không thay thế một bộ browser E2E hoàn chỉnh hay chứng minh triển khai public HTTPS.

Ảnh log trong báo cáo là bản trình bày lại phần log người triển khai gửi, không phải ảnh chụp Docker Desktop. Các hình code lấy từ file hiện tại và sơ đồ có source tại `docs/diagrams/docker-local.puml`.
