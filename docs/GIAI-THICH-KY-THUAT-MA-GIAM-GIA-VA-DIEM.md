# Giải thích đơn giản: mã giảm giá và điểm thưởng

Đối chiếu source ngày 12/11/2026. Tài liệu riêng, giải thích hành vi đang có; không có câu hỏi phản biện, không sửa code hoặc tạo kết quả test mới.

## 1. Ví dụ xuyên suốt

Khách mua ba ly 40.000đ, tổng trước giảm 120.000đ. Mã BREW10 giảm 10%, còn 108.000đ. Backend giữ nguyên liệu và tạo đơn với số tiền này. Khi thanh toán được xác minh thành công, khách nhận `floor(108000 / 10000) = 10` điểm.

Chỉ nhập mã hoặc tạo đơn chưa được cộng điểm. Nếu khách không trả tiền rồi đơn hết hạn, không có một lần EARN cho đơn đó.

## 2. Vì sao có bảng Voucher?

Xem [schema.prisma](../backend/prisma/schema.prisma).

| Trường | Ý nghĩa |
|---|---|
| code unique | Tìm đúng mã khách nhập và tránh hai cấu hình cùng mã. |
| discountPercent | Phần trăm giảm theo chính sách hiện tại. |
| expiresAt | Thời điểm ngừng hiệu lực. |
| active | Cho phép quầy/quản trị tắt mã trước hạn. |

Voucher là cấu hình khuyến mãi; Order là giao dịch đã chốt. Chúng có vòng đời khác nhau.

Thiết kế hiện tại không tự đồng nghĩa có giới hạn một lần mỗi khách, số lượt toàn quán, hạng thành viên hoặc số tiền giảm tối đa riêng. Chỉ giải thích các quy tắc thật sự có trong findValid/calcDiscount.

## 3. Tại sao Order lưu cả voucherId, discount và total?

- voucherId giúp truy vết đã dùng mã nào.
- discount ghi số tiền thực sự giảm ở lần đặt.
- total ghi nghĩa vụ tiền sau giảm của đơn.

Nếu chỉ lưu voucherId rồi mỗi lần đọc lại tính theo discountPercent hiện tại, đổi mã từ 10% thành 20% có thể làm số tiền đơn cũ thay đổi. Payment cần đối chiếu giá trị đơn đã lưu, không phải tự thay tiền theo cấu hình voucher mới.

Không gọi đây là lưu đầy đủ mọi thuộc tính lịch sử của voucher: schema không có một bản sao tất cả các trường voucher trong Order. Phần số tiền giao dịch được giữ bằng discount/total.

## 4. findValid() làm gì?

[PromotionsService.findValid()](../backend/src/promotions/promotions.service.ts) thực hiện:

```text
trim + uppercase code
→ Tìm Voucher
→ Không có: từ chối
→ active=false: từ chối
→ expiresAt <= thời điểm kiểm: từ chối
→ Trả cấu hình hợp lệ
```

Chuẩn hóa để ` brew10 ` và `BREW10` được tìm theo cùng mã đã quy ước lưu. Unique index của chuỗi trong database không tự biến mọi cách viết thành cùng một mã nếu đường ghi không tuân chuẩn hóa.

Hàm nhận một đối tượng `db` có khả năng truy cập voucher. Khi xem trước có thể dùng PrismaService; khi tạo đơn truyền TransactionClient để kiểm trong cùng transaction nghiệp vụ.

## 5. Đã có API validate, sao tạo đơn vẫn phải kiểm?

Khách có thể xem trước lúc 10:00 nhưng tới 10:05 mới đặt, trong khi mã vừa hết hạn hoặc bị tắt. Client cũng có thể bỏ qua màn hình validate và tự gửi request.

Do đó [PromotionsController](../backend/src/promotions/promotions.controller.ts) trả phần trăm/hạn để UI hiển thị, còn [OrdersService.create()](../backend/src/orders/orders.service.ts) kiểm lại mã trước khi reserve nguyên liệu.

Thông báo giảm ở giỏ là xem trước; total trả từ backend khi tạo đơn mới là giá trị đã lưu của giao dịch. Frontend không gửi một số tiền giảm rồi yêu cầu backend tin tuyệt đối.

## 6. calcDiscount(): tính giảm theo tiền nguyên

[discount.ts](../backend/src/promotions/discount.ts):

```text
p = giới hạn percent trong 0..100
discount = floor(subtotal × p / 100)
discount không vượt subtotal
total = subtotal - discount
```

Ví dụ 45.555đ giảm 10% thì giảm 4.555đ, không lưu số lẻ đồng. Đây là quy tắc nhóm chọn.

Giới hạn phần trăm hỗ trợ tránh tiền giảm vượt tổng ở phép tính. Nó không tự chứng minh mọi luồng tài chính chấp nhận đơn có total=0; cổng thanh toán còn có điều kiện amount riêng. Không lấy khả năng của hàm thuần làm bằng chứng toàn bộ nghiệp vụ checkout đã xử lý mọi cấu hình khuyến mãi.

## 7. Voucher và kho nằm chung luồng ra sao?

```text
Tính các dòng món theo giá backend
→ Tính subtotal
→ Kiểm voucher và tính discount
→ Reserve nguyên liệu
→ Lưu Order + items + snapshot + total/discount
```

Mã sai bị từ chối trước reserve nên không cần thực hiện các lệnh kho rồi mới báo mã lỗi. Dù vậy, transaction vẫn cần cho lỗi phát sinh ở các bước sau.

Giảm giá thay nghĩa vụ tiền, không thay số nguyên liệu của món. Một ly đang khuyến mãi vẫn dùng lượng nguyên liệu theo công thức/size/topping của ly đó.

## 8. Vì sao có User.loyaltyPoints và LoyaltyTransaction?

User.loyaltyPoints giúp đọc số dư nhanh để hiển thị tài khoản. LoyaltyTransaction lưu lịch sử vì sao số dư đổi.

| Trường sổ điểm | Vai trò |
|---|---|
| userId | Điểm của tài khoản nào. |
| orderId | Đơn nào tạo lần biến động. |
| type | Loại giao dịch; code đang cộng điểm bằng EARN. |
| points | Lượng điểm của lần này. |
| balanceAfter | Số dư sau khi cập nhật. |
| createdAt | Thời điểm ghi sổ. |

Ví dụ số dư đang 3, thanh toán thêm được 10: User lên 13; dòng sổ ghi points=10, balanceAfter=13. Chỉ có số dư 13 thì không biết tăng từ đơn nào.

Enum có REDEEM không có nghĩa đã có đầy đủ chức năng đổi điểm. Phải xem API/service thực sự thực hiện; award hiện chỉ ghi EARN.

## 9. calcPoints() và quy tắc làm tròn

```text
points = max(0, floor(amount / 10000))
```

amount là tiền mới đã được áp dụng cho thanh toán, tính sau giảm ở đơn mua thường. 108.000đ được 10 điểm, 9.999đ được 0.

Điểm tính từng khoản/đơn, không tích lũy phần tiền lẻ chưa đủ điểm giữa các đơn. Ví dụ một đơn 49.000đ được 4 điểm; một đơn sau 6.000đ được 0. Tổng 55.000đ qua hai lần này vẫn là 4 theo cách làm tròn hiện tại, không tự tính lại thành 5.

## 10. award() cập nhật số dư và sổ điểm thế nào?

[LoyaltyService.award()](../backend/src/promotions/loyalty.service.ts) nhận TransactionClient của settlement:

1. Tính points.
2. Nếu bằng 0, không ghi dòng EARN 0.
3. Dùng UPDATE increment để cộng vào User.loyaltyPoints.
4. Lấy số dư mới vừa cập nhật.
5. Tạo LoyaltyTransaction EARN với points và balanceAfter.

Không dùng cách đọc số dư vào JavaScript rồi ghi `old + points` một cách tách rời. Hai thanh toán cùng tài khoản có thể đều đọc số dư cũ và ghi đè nhau. Increment nguyên tử tại database tránh kiểu mất cập nhật đó.

## 11. Tại sao cộng điểm nằm cùng transaction thanh toán?

Nếu Payment đã commit nhưng cộng điểm thất bại, đơn đã nhận tiền nhưng quyền lợi khách bị lệch. Nếu cộng điểm commit trước mà Payment rollback, khách được điểm dù giao dịch không thành công.

Code settlement gọi award bằng cùng tx, nên Payment, PAID, số dư và EARN hoặc cùng commit, hoặc cùng rollback. Thông báo frontend đến sau không phải nơi quyết định cộng điểm.

## 12. Chống cộng hai lần

- Mock payment replay trả kết quả đã có, không gọi award lại cho cùng một hiệu ứng.
- VNPay apply kiểm attempt/Payment dưới khóa Order trước khi award.
- Unique `(orderId, type)` chặn tạo EARN thứ hai cho cùng Order có orderId cụ thể.

Unique là lớp cuối: nếu một đường gọi sai đã increment rồi chạm unique khi ghi EARN, cần để lỗi làm rollback cả transaction. Không bắt lỗi unique rồi commit số dư đã tăng.

orderId của sổ cho phép null trong schema; không suy ra unique này bảo vệ mọi bản ghi không gắn Order theo cùng cách PostgreSQL xử lý một orderId xác định.

## 13. Điểm khi đổi món

Khách đã có điểm trên tiền A. Duyệt đổi chuyển giá trị cũ sang B bằng credit, không phải thu thêm lần nữa:

- B bằng giá: không tạo Payment giả, không gọi award trên toàn total B.
- B cao hơn: VNPay thu delta, award tính trên delta.
- Khoản thu trùng/không áp dụng đi REVIEW không được xem là một lần trả tiền mới để cộng điểm.

Vì làm tròn trên từng khoản, điểm sau đổi không nhất thiết bằng `floor(tổng tiền cuối / 10000)` trong mọi ví dụ. Điều phải giữ là không cộng lại tiền cũ và áp dụng nhất quán chính sách đã chọn.

## 14. Frontend hiển thị gì?

[CartView](../frontend/src/features/cart/CartView.tsx) gọi validate mã, hiển thị subtotal/discount/total để khách biết trước. Khi gửi đặt chỉ gửi mã cùng lựa chọn, backend tính lại.

[OrderConfirmation](../frontend/src/features/orders/OrderConfirmation.tsx) tải lại thông tin User sau kết quả thanh toán để cập nhật điểm. Giá trị response pointsEarned là thông tin hiển thị tính theo chính sách; muốn kiểm lịch sử cộng thật phải đối chiếu User và LoyaltyTransaction, không chỉ nhìn một nhãn trên UI.

## 15. Các test có thể mở đọc

- [discount.spec.ts](../backend/src/promotions/discount.spec.ts): phần trăm, làm tròn, giới hạn và ngưỡng điểm.
- [promotions.e2e-spec.ts](../backend/test/promotions.e2e-spec.ts): chuẩn hóa mã, hết hạn/tắt mã, total sau giảm, mã sai không đổi kho.
- [loyalty.e2e-spec.ts](../backend/test/loyalty.e2e-spec.ts): số dư và EARN khớp, nhiều đơn, đơn dưới ngưỡng, chặn EARN trùng.
- [staff-orders.e2e-spec.ts](../backend/test/staff-orders.e2e-spec.ts): tình huống lỗi điểm trong settlement và bảo toàn dữ liệu.
- [payment-exchange.e2e-spec.ts](../backend/test/payment-exchange.e2e-spec.ts): không cộng lại credit, chỉ cộng trên chênh lệch.

Ảnh giỏ áp mã trong báo cáo dùng API fixture để minh họa UI. Số liệu chạy toàn bộ bộ test theo hồ sơ kiểm chứng trước đó; việc viết tài liệu không tự tạo thêm lần chạy.
