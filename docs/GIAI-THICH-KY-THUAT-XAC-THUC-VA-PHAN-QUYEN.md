# Giải thích đơn giản: xác thực và phân quyền

Đối chiếu source ngày 12/11/2026. Tài liệu đọc riêng, không có câu hỏi phản biện và không thay đổi code ứng dụng.

## 1. Ba lớp kiểm tra khác nhau

Ví dụ khách A gọi API hủy đơn số 100:

1. **Xác thực:** token có hợp lệ không, A là tài khoản nào?
2. **Phân quyền theo vai trò:** API này dành cho khách đã đăng nhập hay chỉ barista?
3. **Quyền trên đối tượng:** đơn 100 có thực sự thuộc A không, và trạng thái có cho hủy không?

Đăng nhập thành công không cho phép sửa mọi đơn. Là barista cũng không tự bỏ qua luật trạng thái/tiền/transaction.

## 2. Bảng User có những dữ liệu gì?

Xem [schema.prisma](../backend/prisma/schema.prisma).

| Trường | Mục đích |
|---|---|
| id | Định danh tài khoản; dùng liên kết Order và làm sub của JWT. |
| email unique | Địa chỉ đăng nhập, tránh hai tài khoản cùng email đã chuẩn hóa. |
| passwordHash | Kết quả băm mật khẩu; không phải mật khẩu gốc. |
| role | CUSTOMER hoặc BARISTA để kiểm quyền quầy. |
| loyaltyPoints | Dữ liệu điểm, không quyết định quyền truy cập. |

Không cần một bảng khách và một bảng barista riêng khi cùng cơ chế đăng nhập và chỉ khác vai trò. Nếu sau này một người có nhiều vai trò hoặc quyền chi tiết, mô hình có thể mở rộng; không nói role enum hiện tại là một hệ thống phân quyền tổng quát.

## 3. register() và login()

Xem [AuthService](../backend/src/auth/auth.service.ts).

Đăng ký trim và chuyển email thành chữ thường, kiểm email đã có, gọi `hash(password, 10)`, rồi tạo User. Role không lấy từ body khách gửi; User mặc định CUSTOMER. Việc cấp BARISTA nằm ở quy trình quản trị/seed, không cho khách chọn quyền ở form.

Login tìm User theo email và dùng `compare(password, passwordHash)`. Không băm lại rồi so chuỗi bằng `===`, vì bcrypt có salt làm hai lần hash cùng mật khẩu có thể khác nhau. Compare biết cách kiểm theo hash đã lưu.

Cost 10 là tham số chi phí tính của bcrypt, không phải mật khẩu được băm đúng mười lần đơn giản. Băm không phải mã hóa có khóa để giải ngược; không có nghiệp vụ “giải mã passwordHash để lấy lại mật khẩu”.

Email sai và mật khẩu sai trả cùng thông báo đăng nhập. Điều này không đồng nghĩa toàn bộ hệ thống không lộ sự tồn tại email: API đăng ký vẫn có thông báo trùng email theo thiết kế.

DTO đăng ký kiểm email và độ dài password 6–72 ký tự theo decorator hiện có. Không diễn giải giới hạn ký tự đó như đã kiểm đầy đủ giới hạn byte UTF-8 của bcrypt cho mọi đầu vào Unicode; hai khái niệm khác nhau.

## 4. Tại sao có UsersService và PUBLIC_FIELDS?

[UsersService](../backend/src/users/users.service.ts) tách truy cập User khỏi xử lý đăng nhập.

- `findByEmail()` lấy dữ liệu cần để kiểm password trong nội bộ backend.
- `findById()` và `create()` chọn id/email/role/loyaltyPoints để trả dữ liệu công khai.

Nếu trả thẳng toàn bộ dòng User cho browser, có thể đưa cả passwordHash ra ngoài. Select trường cần thiết giảm nguy cơ này. Không gọi “public” là ai trên internet đều đọc được; nó chỉ là tập trường an toàn hơn để trả khi API cho phép.

## 5. JWT dùng như thẻ xác nhận danh tính

[AuthModule](../backend/src/auth/auth.module.ts) cấu hình secret và token 7 ngày. `buildResponse()` ký payload có `sub=user.id`, `email`; thư viện thêm/quản lý các trường thời gian theo cấu hình.

Frontend nhận accessToken và user, rồi gửi:

```http
Authorization: Bearer <access-token>
```

Payload JWT có thể đọc được; chữ ký giúp backend kiểm nội dung chưa bị thay bằng dữ liệu tự chế, không làm payload thành bí mật đã mã hóa. Không nhét mật khẩu hay secret vào payload.

[getJwtSecret()](../backend/src/auth/jwt.config.ts) đọc JWT_SECRET của backend và báo lỗi nếu thiếu. Secret không gửi cho frontend. Token phải được bảo vệ khi truyền/lưu vì ai có bearer token hợp lệ có thể sử dụng nó trong phạm vi quyền của tài khoản.

## 6. JwtAuthGuard và JwtStrategy khác nhau thế nào?

[JwtAuthGuard](../backend/src/auth/jwt-auth.guard.ts) kích hoạt strategy `jwt` của Passport.

[JwtStrategy](../backend/src/auth/jwt.strategy.ts):

1. Lấy token từ Bearer header.
2. Passport kiểm chữ ký và hạn, vì `ignoreExpiration=false`.
3. `validate()` đọc User theo payload.sub.
4. Không có User thì 401.
5. Trả `{id,email,role}` làm `request.user`.

Role được lấy từ database ở mỗi lần validate, không tin role do browser tự sửa hoặc một role cũ nằm trong token. Ví dụ hạ tài khoản từ BARISTA về CUSTOMER thì request tiếp theo bị chặn ở staff API dù token chưa hết hạn.

Sự thay đổi có hiệu lực ở lần xác thực tiếp theo; không có nghĩa mọi transaction đã chạy trước đó tự bị hủy giữa chừng. Đổi role cũng không đồng nghĩa token bị thu hồi hoàn toàn: token vẫn có thể dùng các quyền còn được phép.

Trade-off là mỗi request xác thực có lần đọc User; nhóm chấp nhận để role hiện hành được kiểm tra. Không mô tả kiến trúc hiện tại là xác thực hoàn toàn không cần database.

## 7. CurrentUser chỉ giúp lấy dữ liệu đã xác minh

[CurrentUser](../backend/src/common/decorators/current-user.decorator.ts) đọc `request.user` để controller nhận qua tham số.

Nó không tự kiểm JWT, không tự truy vấn User và không cấp quyền. Route phải dùng Guard phù hợp trước. Tách decorator giúp controller không lặp thao tác đọc request ở nhiều nơi.

## 8. Roles decorator và RolesGuard

Route quầy khai báo:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('BARISTA')
```

[RolesGuard](../backend/src/auth/roles.guard.ts) dùng Reflector đọc metadata từ method/class, lấy user của request rồi kiểm role có trong danh sách được yêu cầu.

Thứ tự có ý nghĩa: xác thực trước để có user, kiểm role sau. Không có metadata yêu cầu role thì RolesGuard cho qua; nó không tự đặt mọi route thành BARISTA. Vì vậy phải khai báo Guard/metadata ở đúng controller/handler.

Ví dụ [StaffOrdersController](../backend/src/orders/staff-orders.controller.ts) kiểm BARISTA cho danh sách và cập nhật trạng thái quầy. Các staff API xử lý đổi món/thanh toán cũng có lớp guard tương ứng.

## 9. Kiểm chủ đơn vẫn cần sau guard

Token của A hợp lệ nhưng Order thuộc B. [OrdersService.findOne()/cancel()](../backend/src/orders/orders.service.ts) vẫn đối chiếu `order.userId` với id từ CurrentUser.

Không lấy userId từ body do client gửi để quyết định chủ thể. Nếu không, A có thể sửa request thành userId của B.

Một số truy vấn lọc ngay bằng `{id,userId}`, một số đọc rồi so sánh. Đơn cá nhân không thuộc người gọi được xử lý như không tìm thấy. Sau kiểm quyền còn kiểm trạng thái, credit và giao dịch; quyền đọc không đồng nghĩa quyền hủy trong mọi hoàn cảnh.

Các route cá nhân dùng JWT không nhất thiết khai báo Roles(CUSTOMER). Barista có token vẫn có thể gọi API cá nhân với tài nguyên của chính tài khoản đó nếu luật cho phép. Không tự viết ma trận rằng BARISTA tuyệt đối bị cấm mua hàng khi code không có điều kiện này.

## 10. Frontend lưu và dùng trạng thái thế nào?

[auth.store.ts](../frontend/src/features/auth/auth.store.ts) dùng Zustand persist, hiện lưu token/user vào localStorage với tên brewlite-auth.

- `setAuth()`: cập nhật sau login/register thành công.
- `updateUser()`: cập nhật thông tin công khai, ví dụ điểm.
- `logout()`: xóa token/user khỏi state lưu của trình duyệt.

Role ở store giúp chọn giao diện và điều hướng, không cấp quyền thật cho API. Sửa localStorage thành BARISTA không thay User.role trong database.

LocalStorage cùng origin được dùng chung giữa tab; tài liệu này không khẳng định đã tách hai phiên khách/barista độc lập theo tab. Nó cũng không phải cookie HttpOnly. Đây là mô tả lựa chọn lưu hiện tại, không phải lời khẳng định token đã miễn nhiễm XSS.

Logout phía client không tự vô hiệu mọi bản sao accessToken đã phát. Code hiện được mô tả là xóa trạng thái trình duyệt, không thêm cơ chế refresh token/blacklist/revoke nếu source chưa có.

## 11. AuthForm và safeNext()

[AuthForm](../frontend/src/features/auth/AuthForm.tsx) kiểm nhập lại password ở form đăng ký, gọi API, lưu response rồi chuyển trang.

Nếu có `next`, safeNext chỉ nhận đường dẫn bắt đầu `/` nhưng không `//`; không cho người khác đưa một URL bên ngoài trực tiếp làm đích quay lại. Không có next thì BARISTA về `/barista`, tài khoản thường về menu.

Kiểm form giúp phản hồi nhanh. DTO/backend mới là lớp bắt buộc vì người dùng có thể bỏ qua form và gọi API trực tiếp.

## 12. 401, 403, 404 khác nhau

| Mã | Cách hiểu trong các route đang xét |
|---|---|
| 401 | Chưa có danh tính hợp lệ: thiếu/sai/hết hạn token, hoặc User không còn tồn tại. |
| 403 | Đã có danh tính nhưng không có vai trò/thẩm quyền route đó. |
| 404 | Không tìm thấy tài nguyên trong phạm vi chủ thể được phép, ví dụ đọc/hủy Order của người khác. |
| 409 | Xung đột nghiệp vụ/trạng thái, ví dụ có quyền trên đơn nhưng đơn không còn được hủy. |

Không gộp mọi lỗi thành “token sai”. Cũng không nói tất cả service đều bắt buộc dùng cùng một mã che tài nguyên; cần nhìn route/hợp đồng cụ thể.

## 13. Vì sao IPN không dùng JWT của khách?

VNPay gọi callback từ server của cổng, không phải browser đang giữ token khách. Kênh này kiểm dữ liệu có chữ ký merchant, tham chiếu, số tiền và trạng thái theo giao thức.

Các API khách bắt đầu thanh toán hoặc xem attempt vẫn cần JWT/chủ đơn. Không vì IPN không có JWT mà gọi toàn bộ module thanh toán là public hoặc không phân quyền.

## 14. Các test đang liên quan

[auth-roles.e2e-spec.ts](../backend/test/auth-roles.e2e-spec.ts) có ba ca:

1. Gửi role BARISTA khi đăng ký vẫn tạo CUSTOMER.
2. Login và auth/me trả role đúng, không trả passwordHash.
3. Đổi role database làm cùng token được/bị chặn ở staff API trên request tiếp theo.

Các bộ staff-orders, inventory-snapshot và VNPay kiểm thêm quyền staff, chủ đơn, giao dịch người khác. Tiêu chí JWT sai chữ ký/hết hạn xuất phát từ cấu hình strategy; cần phân biệt tiêu chí thiết kế với một ca test có assertion/log cụ thể.

Tài liệu này không thực hiện một lần chạy test mới và không tạo thêm số liệu nghiệm thu. Không lấy ảnh form đăng nhập làm bằng chứng guard backend đã qua test.

## 15. Tóm tắt các thành phần

```text
AuthForm → AuthController → AuthService → UsersService
                                        → bcrypt compare/hash
                                        → JwtService ký token

API được bảo vệ → JwtAuthGuard → JwtStrategy + User trong DB
                              → request.user
                              → RolesGuard nếu route yêu cầu role
                              → CurrentUser tại controller
                              → service kiểm chủ đơn và luật nghiệp vụ
```

Điểm cốt lõi: frontend giúp sử dụng đúng luồng; backend kiểm danh tính, vai trò và dữ liệu cụ thể trước khi thao tác. Những kiểm tra đó bổ sung cho transaction/khóa/version, không thay thế chúng.
