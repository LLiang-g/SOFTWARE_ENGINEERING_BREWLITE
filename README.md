# BrewLite

Ứng dụng đặt đồ uống dành cho quán nhỏ và vừa: khách chọn món, thanh toán online và nhận tại quầy; barista tiếp nhận đơn, cập nhật pha chế và xử lý yêu cầu đổi món.

Backend dùng NestJS và PostgreSQL/Prisma; frontend dùng Next.js. Thanh toán tích hợp **VNPay Sandbox**, phục vụ thử nghiệm, không thu tiền thật.

## Mục lục

- [Chức năng](#chức-năng)
- [Công nghệ và cấu trúc](#công-nghệ-và-cấu-trúc)
- [Chuẩn bị](#chuẩn-bị)
- [Chạy lần đầu bằng Docker](#chạy-lần-đầu-bằng-docker)
- [Chạy lại và cập nhật](#chạy-lại-và-cập-nhật)
- [Chạy chế độ phát triển](#chạy-chế-độ-phát-triển)
- [Thiết lập VNPay Sandbox](#thiết-lập-vnpay-sandbox)
- [Kiểm thử và build](#kiểm-thử-và-build)
- [Sao lưu và thử khôi phục](#sao-lưu-và-thử-khôi-phục)
- [CI/CD](#cicd)
- [Xử lý lỗi thường gặp](#xử-lý-lỗi-thường-gặp)
- [Tài liệu và đóng góp](#tài-liệu-và-đóng-góp)

## Chức năng

- Menu, size, topping, giỏ hàng lưu trên trình duyệt.
- Đăng ký, đăng nhập JWT; phân quyền CUSTOMER và BARISTA.
- Backend tính giá, kiểm tra voucher, ghi nhận điểm thưởng.
- Tạo đơn có idempotency; giữ nguyên liệu trong transaction, kiểm soát đặt đồng thời.
- Định lượng theo size/topping; hoàn nguyên liệu theo snapshot; tự giải phóng đơn hết hạn giữ món.
- VNPay URL/QR, IPN/Return, thanh toán lại và theo dõi khoản thu không áp dụng cho đơn.
- Đổi món sau thanh toán: chọn qua menu, barista duyệt, chuyển giá trị đã trả và thu thêm chênh lệch.
- Hàng đợi quầy, trạng thái pha chế và cập nhật realtime.
- Docker Compose, backup/restore, CI và phát hành Docker image.

Phạm vi hiện tại tập trung đặt và nhận món tại quầy. Giao diện tài xế/điều phối giao hàng và chuyển tiền ngân hàng thật tự động chưa thuộc phạm vi bàn giao.

## Công nghệ và cấu trúc

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, Zustand |
| Backend | NestJS 12, TypeScript, JWT, Socket.IO |
| Database | PostgreSQL 16, Prisma 7 |
| Kiểm thử | Vitest, Supertest |
| Vận hành | Docker Compose, GitHub Actions, GHCR, PowerShell |

```text
.
├── backend/                 # API, schema/migration/seed Prisma, test
├── frontend/                # Website khách hàng và quầy barista
├── scripts/database/        # Backup và thử khôi phục database
├── scripts/deploy/          # Triển khai và rollback ứng dụng
├── deploy/                  # Compose dùng image phát hành
├── .github/                 # Workflow CI/CD và Dependabot
├── docs/                    # Thiết kế, sơ đồ, tài liệu và bằng chứng kiểm thử
├── Assignment-report/       # Mã LaTeX và PDF báo cáo
├── docker-compose.yml       # Môi trường local đầy đủ
└── vnpay.postman_collection.json
```

## Chuẩn bị

**Chạy bằng Docker:** cài Git và Docker Desktop, mở Docker Desktop và chọn Linux containers. Không cần cài Node.js hay PostgreSQL riêng trên máy host.

**Chạy phát triển ngoài Docker:** cần thêm Node.js 24 và npm; PostgreSQL 16 có thể chạy bằng Docker như hướng dẫn bên dưới. Dùng phiên bản dependency trong `package-lock.json`.

Các lệnh dưới dùng **PowerShell trên Windows**. Với Bash, dùng `npm`/`npx` thay `npm.cmd`/`npx.cmd` và tạo file môi trường bằng trình soạn thảo.

```powershell
git clone https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE.git
cd SOFTWARE_ENGINEERING_BREWLITE
docker version
docker compose version
```

Lệnh `docker version` phải có cả Client và Server. Các lệnh Compose chạy tại **thư mục gốc**, nơi có `docker-compose.yml`.

## Chạy lần đầu bằng Docker

### 1. Tạo hai file môi trường

Repo hiện chưa có `.env.docker.example`. Tạo `.env.docker` tại thư mục gốc bằng nội dung mẫu sau:

```dotenv
POSTGRES_USER=brewlite
POSTGRES_PASSWORD=brewlite_local_dev
POSTGRES_DB=brewlite
DB_PORT=5432
API_PORT=3001
WEB_PORT=3000
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Tạo `backend/.env`:

```powershell
Copy-Item backend/.env.example backend/.env
```

Mở file vừa tạo và điền đầy đủ:

```dotenv
DATABASE_URL="postgresql://brewlite:brewlite_local_dev@localhost:5432/brewlite?schema=public"
JWT_SECRET="thay-bang-chuoi-ngau-nhien-dai-rieng-cua-ban"
PORT=3001
FRONTEND_URL=http://localhost:3000

# Chạy thử local chưa cần tài khoản VNPay
VNPAY_ENABLED=false
PAYMENT_MOCK_ENABLED=true

ORDER_RESERVATION_MINUTES=30
ORDER_EXPIRY_WORKER_ENABLED=true

BARISTA_EMAIL=barista@brewlite.local
BARISTA_PASSWORD=barista123
```

Mật khẩu ở trên là dữ liệu mẫu cho local. Đổi `JWT_SECRET` và mật khẩu khi chia sẻ môi trường. Có thể tạo chuỗi ngẫu nhiên bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` nếu máy có Node.js.

`.env.docker` dùng cho Compose; `backend/.env` dùng cho ứng dụng và Prisma CLI. Khi chạy container, Compose thay `DATABASE_URL` bằng địa chỉ nội bộ `db:5432`; khi chạy backend trực tiếp, dùng `localhost` và cổng DB đã cấu hình. Mật khẩu có ký tự đặc biệt cần URL-encode khi đặt vào connection URL.

Không commit file môi trường thật. Hai file này đã được `.gitignore` loại trừ.

### 2. Khởi tạo schema và dữ liệu mẫu

Chỉ thực hiện trên **database mới, trống**:

```powershell
docker compose --env-file .env.docker --profile setup run --build --rm migrate
docker compose --env-file .env.docker --profile setup run --build --rm seed
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

Chạy từng lệnh, chỉ tiếp tục khi lệnh trước thành công. `migrate` và `seed` tự khởi động DB cần thiết. Lần build đầu cần Internet để tải image, package và tài nguyên font.

**Không chạy lại seed trên dữ liệu đang sử dụng:** seed cập nhật sản phẩm, công thức và đặt lại tồn kho một số nguyên liệu. Không dùng `prisma migrate reset` hoặc `docker compose down -v` để sửa lỗi trên database cần giữ dữ liệu.

### 3. Truy cập

| Dịch vụ | Địa chỉ mặc định |
| --- | --- |
| Website | http://localhost:3000 |
| Quầy barista | http://localhost:3000/barista |
| API danh sách sản phẩm | http://localhost:3001/products |
| Cấu hình chế độ thanh toán công khai | http://localhost:3001/payments/vnpay/config |
| PostgreSQL | `localhost:5432`, database/user `brewlite` |

Đăng nhập quầy bằng `barista@brewlite.local` / `barista123` nếu giữ cấu hình mẫu khi seed. Khách hàng tự đăng ký trên website; seed không tạo sẵn tài khoản khách.

Seed tạo bốn sản phẩm và voucher `BREW10` giảm 10%. Hai nguyên liệu topping được khởi tạo với **stock = 0**; muốn thử món có topping, cần nhập tồn kho cho chúng. Khi seed lại, `BARISTA_PASSWORD` chỉ dùng cho tài khoản mới, không thay mật khẩu tài khoản barista đã tồn tại.

Trong pgAdmin, đăng ký server bằng host `localhost`, port `5432`, database/user/mật khẩu theo `.env.docker`. Đây là DB trong Docker nếu cổng đó được container ánh xạ; cài pgAdmin không yêu cầu cài thêm một PostgreSQL server.

## Chạy lại và cập nhật

Sau khi đã khởi tạo lần đầu, khởi động bằng:

```powershell
docker compose --env-file .env.docker up -d
```

Sau khi sửa/pull mã nguồn cần build lại:

```powershell
git pull
docker compose --env-file .env.docker up -d --build
```

Nếu bản cập nhật có migration mới, sao lưu trước, chạy service `migrate`, sau đó khởi động ứng dụng. Migration đã áp dụng không được sửa để buộc chạy lại; với database cũ đã tạo bảng thủ công, cần đối chiếu schema và lịch sử migration trước khi áp dụng.

Các lệnh vận hành:

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail 100 backend frontend
docker compose --env-file .env.docker logs -f backend
docker compose --env-file .env.docker stop
docker compose --env-file .env.docker down
```

`down` không kèm `-v` giữ named volume database. Giữ cùng thư mục/tên project Compose để tiếp tục dùng đúng volume cũ.

## Chạy chế độ phát triển

Không chạy đồng thời frontend/backend Docker và tiến trình Node trên cùng cổng.

### 1. Chạy riêng database

Tạo hai file môi trường như trên. Nếu đã chạy cả stack, dừng ứng dụng container trước:

```powershell
docker compose --env-file .env.docker stop frontend backend
docker compose --env-file .env.docker up -d db
```

### 2. Backend — terminal thứ nhất

```powershell
cd backend
npm.cmd ci --ignore-scripts
npx.cmd prisma generate
# Hai lệnh dưới dành cho database mới
npx.cmd prisma migrate deploy
npx.cmd prisma db seed
npm.cmd run start:dev
```

Nếu database đã có schema/dữ liệu phù hợp, bỏ bước seed; không reset. `prisma generate` sinh client TypeScript từ schema, không tạo bảng database. Sau khi đổi schema/pull cập nhật Prisma, chạy lại generate. Không sửa tay `backend/src/generated/prisma`.

Backend mặc định chạy cổng `3001`. Lệnh Prisma phải chạy trong `backend`, nơi có `prisma.config.ts` và dependency Prisma của project.

### 3. Frontend — terminal thứ hai

Từ thư mục gốc, tạo `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
SERVER_API_URL=http://localhost:3001
```

Sau đó:

```powershell
cd frontend
npm.cmd ci --ignore-scripts
npm.cmd run dev
```

Truy cập http://localhost:3000. Nếu thay biến môi trường, khởi động lại tiến trình tương ứng. `NEXT_PUBLIC_API_URL` được nhúng khi build production; cần build lại frontend khi đổi địa chỉ API.

## Thiết lập VNPay Sandbox

Phần này tùy chọn; có thể chạy luồng thanh toán mock trước. Dùng merchant Sandbox của nhóm và giữ bí mật hash secret.

1. Backend phải truy cập được ở cổng `3001`. Mở terminal riêng chạy `ngrok http 3001` sau khi đã cài và cấu hình ngrok.
2. Trong `backend/.env`, thay cấu hình thanh toán:

```dotenv
VNPAY_ENABLED=true
PAYMENT_MOCK_ENABLED=false
VNPAY_TMN_CODE=merchant_sandbox_cua_ban
VNPAY_HASH_SECRET=hash_secret_sandbox_cua_ban
PUBLIC_BASE_URL=https://ten-mien-ngrok-cua-ban
FRONTEND_URL=http://localhost:3000
VNPAY_PAYMENT_MINUTES=10
```

3. Cấu hình IPN với phía VNPay/đầu mối quản lý merchant thành `https://ten-mien-ngrok-cua-ban/payments/vnpay/ipn`. Backend cũng hỗ trợ alias `/api/payments/vnpay/ipn` cho merchant đang dùng đường dẫn đó.
4. Khởi động lại backend. Nếu dùng Docker, chạy `docker compose --env-file .env.docker up -d --force-recreate backend` để nhận env mới.
5. Đăng nhập khách, tạo đơn và mở thanh toán. QR và nút chuyển trang dùng cùng URL VNPay. Return URL do backend tạo là `PUBLIC_BASE_URL/payments/vnpay/return`.

`PUBLIC_BASE_URL` là origin HTTPS của **backend**, không thêm `/api` hay đường dẫn phía sau. `FRONTEND_URL` là origin website; dùng local chỉ khi khách thử nghiệm trên cùng máy. Đổi domain ngrok thì cập nhật cả env và IPN của merchant. Domain callback phải truy cập được từ bên ngoài.

Return chuyển hướng khách về website bằng HTTP `303`; IPN dùng để xác minh và ghi nhận giao dịch. HTTP `200` ở ngrok chỉ phản ánh phản hồi HTTP, cần đọc nội dung IPN và trạng thái backend để biết kết quả thanh toán. Trang cảnh báo ngrok trên trình duyệt có thể cần bấm **Visit Site**.

Thời hạn QR mặc định 10 phút, thời hạn giữ món mặc định 30 phút. QR hết hạn và đơn hết thời gian giữ món là hai điều kiện khác nhau. Không coi timeout hoặc việc khách đóng trang là bằng chứng thanh toán thất bại.

## Kiểm thử và build

Backend:

```powershell
cd backend
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Unit test không cần DB. API test đọc `DATABASE_URL` và có ghi dữ liệu/fixture: **chỉ chạy với database kiểm thử riêng**. Ví dụ tạo DB mới bằng pgAdmin, rồi trong terminal `backend`:

```powershell
$env:DATABASE_URL = 'postgresql://brewlite:brewlite_local_dev@localhost:5432/brewlite_test?schema=public'
$env:JWT_SECRET = 'chuoi-bi-mat-rieng-cho-test-local'
$env:ORDER_EXPIRY_WORKER_ENABLED = 'false'
npx.cmd prisma migrate deploy
npm.cmd run test:e2e
Remove-Item Env:DATABASE_URL
Remove-Item Env:JWT_SECRET
Remove-Item Env:ORDER_EXPIRY_WORKER_ENABLED
```

Thay thông tin kết nối theo máy. DB `brewlite_test` phải tồn tại trước khi migrate; dọn dữ liệu thử sau khi kiểm tra. Các biến PowerShell chỉ áp dụng trong terminal đó và ưu tiên hơn `.env`.

Frontend, trong terminal khác từ thư mục gốc:

```powershell
cd frontend
npm.cmd run lint
npm.cmd run build
npm.cmd run start
```

`start` chạy bản build production, không thay cho `dev`. Xem bộ đo hiệu năng tại [docs/performance/method.md](docs/performance/method.md) và kiểm chứng bổ sung tại [docs/verification/README.md](docs/verification/README.md). Import [VNPay Postman collection](vnpay.postman_collection.json) khi cần kiểm tra API; đối chiếu URL/token với môi trường đang chạy.

## Sao lưu và thử khôi phục

Từ thư mục gốc khi container DB đang chạy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/database/backup.ps1
```

Kết quả nằm trong `backups/`: file `.dump` và manifest `.json` cùng tên. Giữ cả hai file. Thử khôi phục bằng đường dẫn file vừa tạo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/database/restore-test.ps1 -BackupFile 'backups/ten-file-backup.dump'
```

Script kiểm tra hash, tạo **database phục hồi riêng** và lưu kết quả kiểm tra; không tự ghi đè database vận hành. Xem [hướng dẫn kỹ thuật backup/restore](docs/GIAI-THICH-KY-THUAT-BACKUP-RESTORE.md) trước khi thực hiện chuyển đổi dữ liệu thật.

## CI/CD

Workflow [`.github/workflows/brewlite.yml`](.github/workflows/brewlite.yml) chạy backend lint/unit/API/build, frontend lint/build và Docker smoke/backup-restore. Image phát hành lên GHCR được gắn với phiên bản/digest.

Deploy cần cấu hình riêng: Windows self-hosted runner mang label `brewlite-deploy`, environment `production`, biến `DEPLOY_ROOT` trỏ đến thư mục triển khai trên máy runner và các env ứng dụng tại máy đó. Có thể kích hoạt qua `workflow_dispatch` với `deploy=true`; deploy tự động trên push dùng biến `DEPLOY_ENABLED=true`. Nếu environment yêu cầu reviewer, cần duyệt trước khi job chạy.

Clone và chạy local không cần thiết lập runner/CD. Job CI xanh hoặc publish thành công không đồng nghĩa đã triển khai máy đích. Xem [tài liệu CI/CD](docs/GIAI-THICH-KY-THUAT-CICD.md) và script trong `scripts/deploy/` để vận hành bản phát hành.

## Xử lý lỗi thường gặp

| Hiện tượng | Kiểm tra / cách xử lý |
| --- | --- |
| Không tìm thấy `dockerDesktopLinuxEngine` | Mở Docker Desktop, đợi engine sẵn sàng, kiểm tra Linux containers và `docker version`. |
| Cổng 5432/3000/3001 đã được dùng | Dừng tiến trình trùng hoặc đổi cổng trong `.env.docker`. Đổi API/Web port thì đồng bộ URL frontend, CORS và ngrok. |
| Prisma P2021, thiếu bảng `Recipe`/snapshot | Kiểm tra đúng DB, schema và migration. Generate chỉ tạo client; cần migrate DB mới. Không reset DB đang dùng. |
| Prisma báo thiếu model trong TypeScript | Chạy `npx.cmd prisma generate` trong `backend`, rồi build lại; kiểm tra model có trong schema. |
| `npx` đề nghị tải Prisma phiên bản khác | Kiểm tra đang đứng trong `backend` và đã cài dependency. Không cài bản Prisma mới tùy ý để bỏ qua lỗi. |
| Không đăng nhập PostgreSQL sau khi đổi env | Volume cũ giữ tài khoản/mật khẩu đã khởi tạo. Đổi env không tự đổi mật khẩu PostgreSQL trong volume. |
| API không kết nối DB | Chạy `docker compose --env-file .env.docker ps`; kiểm tra host `db` bên trong container, `localhost` khi chạy Node trực tiếp. |
| Không chọn được topping | Seed tạo kho topping bằng 0. Nhập nguyên liệu phù hợp rồi tải lại menu. |
| VNPay IPN 404 | Ngrok phải trỏ backend; kiểm tra domain và đường dẫn `/payments/vnpay/ipn` hoặc alias `/api/payments/vnpay/ipn`. |
| Thanh toán xong chưa về website | Kiểm tra `PUBLIC_BASE_URL`, `FRONTEND_URL`, ngrok còn chạy và trang cảnh báo ngrok. Đọc log backend và trạng thái giao dịch. |
| Frontend không gọi được API/CORS | Đồng bộ `NEXT_PUBLIC_API_URL` với cổng host và `FRONTEND_URL` với origin website; rebuild khi đổi biến public. |
| PowerShell chặn `npm.ps1` | Dùng `npm.cmd` và `npx.cmd` như các lệnh hướng dẫn. |

Nếu vẫn lỗi, gửi lệnh đã chạy, thư mục hiện tại, phiên bản Node/Docker và log liên quan; che token, mật khẩu và hash secret trước khi chia sẻ.

## Tài liệu và đóng góp

- [Báo cáo PDF](Assignment-report/Assignment_report.pdf) · [Nguồn LaTeX](Assignment-report/Assignment_report.tex).
- [Product Backlog](docs/product-backlog.md) · [Đối chiếu yêu cầu](docs/traceability-matrix.md).
- [Đặt hàng và kho](docs/GIAI-THICH-KY-THUAT-DAT-HANG-VA-KHO.md).
- [Thanh toán VNPay](docs/GIAI-THICH-KY-THUAT-THANH-TOAN-VNPAY.md).
- [Đổi món và chênh lệch](docs/GIAI-THICH-KY-THUAT-DOI-MON-VA-CHENH-LECH.md).
- [Docker và database](docs/GIAI-THICH-KY-THUAT-DOCKER-VA-KHOI-TAO-DATABASE.md).
- [Sơ đồ hệ thống](docs/diagrams/).

Nhóm phát triển gồm Cao Cát Lượng (PO), Dương Văn Khánh (SM), Dương Trung Lâm, Đinh Văn Thanh Sơn, Nguyễn Hồng An và Phạm Nguyễn Minh Nhật.

Khi đóng góp: tạo nhánh riêng, mô tả thay đổi, cập nhật test/tài liệu liên quan và gửi Pull Request. Với thay đổi schema, bổ sung migration mới; không sửa migration đã áp dụng trên môi trường dùng chung. Không commit `.env`, bản backup hoặc thông tin merchant thật. Báo lỗi và đề xuất tại [GitHub Issues](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/issues).

**Giấy phép:** repo hiện chưa công bố file LICENSE. Liên hệ nhóm trước khi phân phối hoặc tái sử dụng ngoài phạm vi được cho phép.
