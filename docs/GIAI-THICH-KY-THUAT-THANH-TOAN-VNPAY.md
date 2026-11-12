# Ôn phản biện kỹ thuật: thanh toán VNPay trong BrewLite

Đối chiếu source ngày 12/11/2026. Tài liệu đọc riêng, bổ trợ phần VNPay trong báo cáo. Các chính sách mô tả dưới đây là hành vi của code hiện tại; không đồng nhất mọi lựa chọn của ứng dụng với yêu cầu bắt buộc của cổng.

## 1. Trình bày trong một phút

> Order và nguyên liệu đã được giữ trước khi bắt đầu thanh toán. Backend kiểm tra đơn, tính khoản còn thu, tạo tham chiếu riêng cho từng lần và ký URL VNPay. Khách có thể quét QR mở URL hoặc bấm liên kết. Return chỉ đưa khách về website; backend xác minh IPN hoặc kết quả tra cứu rồi mới ghi Payment, PAID và điểm trong transaction. Khi có nhiều lần thử/callback lặp, khóa Order và ràng buộc dữ liệu giúp không phục vụ hoặc cộng điểm hai lần. Tiền thu trùng hoặc về sau khi đơn không còn hiệu lực vẫn được giữ bằng chứng và đưa vào hồ sơ xử lý.

## 2. Bản đồ source

| File | Trách nhiệm |
|---|---|
| [vnpay.gateway.ts](../backend/src/payments/vnpay.gateway.ts) | Cấu hình, build URL và request QueryDr, xác minh response tra cứu. |
| [vnpay.crypto.ts](../backend/src/payments/vnpay.crypto.ts) | HMAC, canonical query, kiểm hash, định dạng thời gian và chuỗi ký QueryDr. |
| [vnpay.service.ts](../backend/src/payments/vnpay.service.ts) | Start/replay, IPN/Return, apply, check, nhật ký và quyền xem giao dịch. |
| [vnpay.controller.ts](../backend/src/payments/vnpay.controller.ts) | Route khách/quầy, guard, DTO, 303 và IPN ACK. |
| [schema.prisma](../backend/prisma/schema.prisma) | Quan hệ, unique và trạng thái Order/attempt/Payment. |
| [PaymentQr.tsx](../frontend/src/features/payments/PaymentQr.tsx) | QR chứa URL và nút mở trang thanh toán. |
| [VnpayPanel.tsx](../frontend/src/features/payments/VnpayPanel.tsx) | Hiển thị thời hạn, lần thử, check và start; không quyết định đã thu tiền. |
| [vnpay.crypto.spec.ts](../backend/src/payments/vnpay.crypto.spec.ts) | Vector HMAC và test encoding/callback/QueryDr. |
| [vnpay.e2e-spec.ts](../backend/test/vnpay.e2e-spec.ts) | Các ca tích hợp với gateway giả lập và PostgreSQL. |

## 3. Vì sao không chỉ thêm paid=true vào Order?

Một đơn có thể có nhiều lần thanh toán: A hết hạn, khách tạo B; A lại có kết quả muộn. Nếu chỉ lưu một cờ hoặc ghi đè một txnRef trên Order, lịch sử A có thể mất và không phân biệt được thu trùng với một callback bị lặp.

Tách ba khái niệm:

- **Order:** cửa hàng có nghĩa vụ phục vụ món nào, giá trị bao nhiêu.
- **Attempt:** một lần bắt đầu giao dịch với cổng, có thể chờ/thất bại/thành công/cần kiểm tra.
- **Payment:** khoản đã xác minh và áp dụng cho Order.

Không phải mỗi attempt đều tạo Payment; thậm chí attempt có bằng chứng đã thu tiền vẫn có thể không được áp dụng nếu đơn đã đóng hoặc đã có khoản khác thanh toán.

## 4. Tại sao cần từng bảng và trường?

### VnpayAttempt

| Trường | Lý do |
|---|---|
| `txnRef` unique | Merchant nhận diện chính xác từng lần thử; không dùng orderId làm tham chiếu chung cho mọi lần. |
| `orderId` | Nối lần thử về nghĩa vụ phục vụ. |
| `amount` | Snapshot khoản được yêu cầu ở lần này, đối chiếu callback. |
| `merchantCode` | Kiểm kết quả thuộc merchant đã tạo yêu cầu. |
| `paymentUrl`, `createDate`, `expiresAt` | Tái dùng mã còn hiệu lực, đối soát đúng lần và kiểm thời hạn. |
| `status` | Trạng thái xử lý của lần thử; khác trạng thái pha chế của Order. |
| `providerTxnNo` unique | Chống gán một mã giao dịch nhà cung cấp cho hai attempt khác nhau. |
| `paidAt` | Backend đã ghi nhận bằng chứng thu thành công; không mặc định cùng nghĩa với Order PAID. Giá trị được code ghi tại lúc áp dụng kết quả, không nên gọi nó là nguyên bản thời gian ngân hàng trừ tiền. |
| `responseCode`, `transactionStatus` | Giữ mã kết quả để đối chiếu, không chỉ giữ câu thông báo chung. |
| `reviewReason` | Lý do cần quầy xử lý: thu trùng, lệch tiền hoặc đơn không còn phù hợp. |
| `lastCheckedAt` | Điều tiết QueryDr, không phải chứng từ thanh toán. |

### PaymentStartRequest

Unique theo `(userId, key)`, liên kết `attemptId`. Nó trả lời “yêu cầu bắt đầu thanh toán này đã được ánh xạ tới lần nào?”.

Cùng key đúng đơn → replay attempt. Cùng key cho đơn khác → xung đột. Key mới khi còn mã phù hợp có thể ánh xạ vào attempt đang tồn tại, nên không phải mỗi lần bấm đều tạo QR mới.

Đây là idempotency của **start payment**, khác OrderCreateRequest chống tạo Order trùng và khác idempotency khi **ghi nhận kết quả**.

### Payment

Ghi khoản áp dụng cho Order. `vnpayAttemptId` unique liên kết một lần; `idempotencyKey` dạng `vnpay:<txnRef>` là khóa ghi nhận của VNPay.

Không nói “có unique orderId trên Payment” vì schema hiện không khai báo như vậy. Việc tránh áp dụng nhiều khoản cho một đơn còn dựa vào mọi luồng settlement lấy khóa Order rồi kiểm Payment đã có, kết hợp unique theo attempt/key.

### PaymentAudit

Ghi ai làm gì, lúc nào, trên attempt nào: tạo mã, retry, QueryDr chưa rõ, IPN và ghi chú quầy. Nó hỗ trợ truy vết; không được đọc một dòng ghi chú thành bằng chứng ngân hàng đã thu tiền.

### PaymentRefundCase

Một hồ sơ theo attempt đã thu nhưng không áp dụng. Unique theo attempt và upsert tránh callback lặp tạo nhiều hồ sơ cho cùng khoản.

OPEN → PROCESSING → COMPLETED là quy trình quầy ghi nhận xử lý, chứng từ và version. Phần mềm theo dõi thao tác chuyển trả bên ngoài, không tự can thiệp số dư tài khoản chủ quán. Không trình bày đây là đã tích hợp API refund tự động.

## 5. start(): tại sao phải kiểm nhiều điều kiện?

Luồng rút gọn:

```text
Kiểm cấu hình và chủ đơn
→ Kiểm deadline giữ món, tìm replay
→ Nếu có attempt hết hạn: thử QueryDr bên ngoài transaction
→ Transaction: khóa Order
→ Đọc lại chủ đơn/trạng thái/deadline/Payment/snapshot/bằng chứng tiền
→ Tái dùng hoặc tạo attempt
→ Ánh xạ request key tới attempt
→ Commit và trả dữ liệu an toàn cho UI
```

Kiểm lại bên trong transaction vì trong lúc chờ QueryDr, IPN khác có thể vừa ghi tiền hoặc worker đã đóng đơn. Kết quả kiểm trước khi chờ mạng không được tin là còn mới.

Snapshot chưa hoàn là điều kiện tài nguyên: không được tạo link trả tiền cho một đơn đã giải phóng nguyên liệu.

Tổng thu mới là `order.total - order.creditApplied`; không tin total hay merchant từ frontend. Ví dụ đơn mới 75.000đ, chuyển từ đơn cũ 45.000đ thì attempt thu 30.000đ.

## 6. URL, chữ ký và QR

### 6.1. Vì sao amount nhân 100?

Đây là cách biểu diễn trường tiền của giao thức; database vẫn lưu VND nguyên. 30.000đ được gửi bằng `vnp_Amount=3000000`, không phải thu ba triệu đồng. Khi nhận callback phải so đúng cùng biểu diễn. Tham khảo [FAQ chính thức VNPay](https://sandbox.vnpayment.vn/apis/docs/faqs/).

### 6.2. canonical(), hmac(), validHash() khác nhau thế nào?

- `canonical`: loại trường hash, sắp khóa và encode tên/giá trị thành chuỗi ổn định.
- `hmac`: tạo HMAC-SHA512 từ chuỗi đó và secret.
- `validHash`: kiểm định dạng/độ dài rồi dùng timingSafeEqual so hai buffer.
- `readCallback`: chỉ nhận các trường vnp_ có kiểu chuỗi hợp lệ rồi kiểm hash.

Encoding khoảng trắng và `&` phải nhất quán, không encode hai lần. `timingSafeEqual` giảm việc so sánh phụ thuộc vị trí byte khác nhau; không có nghĩa mọi rủi ro bảo mật của ứng dụng đã được giải quyết.

HMAC là mã xác thực tính toàn vẹn và nguồn có chung secret, **không phải mã hóa**: tham số URL vẫn đọc được. Không đưa hash secret vào frontend, ảnh hoặc báo cáo. Mẫu giao thức được đối chiếu với [tài liệu kết nối VNPay](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).

### 6.3. Hash hợp lệ có đủ để cho pha không?

Chưa. Còn phải kiểm merchant, txnRef tồn tại, amount, trạng thái kết quả và điều kiện Order hiện tại. Một thông báo có chữ ký đúng vẫn có thể là thông báo lặp hoặc tiền của đơn đã hết thời hạn.

### 6.4. QR ở đây là loại gì?

QR mã hóa URL có chữ ký để camera mở trang VNPay, không phải QR chuyển khoản trực tiếp của ngân hàng. Nút bên dưới mở cùng URL, không tạo thêm giao dịch khác.

### 6.5. Tại sao không gia hạn giữ kho mỗi khi tạo QR?

Nếu mỗi lần retry tự thêm thời gian, khách có thể giữ hàng vô hạn. Deadline đơn cố định; QR mới chỉ được cấp khi đơn còn đủ điều kiện và hạn không vượt deadline đơn. Chi tiết giữ/hoàn kho xem [tài liệu luồng kho](GIAI-THICH-KY-THUAT-DAT-HANG-VA-KHO.md).

## 7. Return, IPN và QueryDr

### Return

Browser quay về backend; returnUrl kiểm chữ ký/merchant/txnRef/amount rồi controller trả 303 tới trang Order. Không ghi Payment/PAID ở đây. Trình duyệt có thể đóng, mất mạng hoặc quay lại nhiều lần nên không dùng điều hướng làm trigger duy nhất để phục vụ đơn.

### IPN

Cổng gọi server-to-server, backend kiểm hash rồi apply và trả JSON ACK. Không yêu cầu JWT của khách cho callback cổng; cơ chế tin cậy của kênh này là dữ liệu giao thức được xác minh, không phải mở endpoint là chấp nhận mọi request.

### QueryDr

Backend chủ động hỏi kết quả bằng tham chiếu và ngày tạo. Request/response có cấu trúc ký theo chuỗi trường và dấu phân cách riêng; không tái dùng canonical query của pay URL. Code kiểm cả hash response, merchant, txnRef và command. Xem [đặc tả QueryDr](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html).

Phân biệt kết quả truy vấn được trả thành công về mặt giao thức với trạng thái giao dịch tài chính bên trong response. Một phản hồi query hợp lệ chưa chắc cho biết khách đã trả thành công.

## 8. apply(): trung tâm bảo đảm tính đúng

Code xác định thành công theo cặp response/transaction status phù hợp, rồi mở transaction và khóa Order.

### 8.1. Vì sao khóa Order, không chỉ khóa attempt?

Hai attempt A và B khác nhau có thể cùng thu cho một Order. Nếu mỗi bên chỉ khóa attempt riêng, cả hai có thể đồng thời thấy “chưa có Payment”. Khóa cùng Order làm chúng xếp hàng trước khi quyết định khoản nào được áp dụng.

### 8.2. Những lớp chống lặp

1. Kiểm attempt đã có `paidAt` để nhận diện kết quả thành công đã ghi.
2. Kiểm providerTxnNo không bị gắn sang attempt khác.
3. Kiểm Order đã có Payment chưa dưới khóa Order.
4. Unique Payment key/attempt và unique hồ sơ khoản dư theo attempt.
5. Ghi Payment, PAID, điểm và audit trong cùng transaction.

Không tuyên bố mạng cung cấp “exactly once delivery”. Thông báo vẫn có thể gửi nhiều lần; ứng dụng làm cho **hiệu ứng ghi nhận** không bị nhân đôi trong các luồng tuân cơ chế đã thiết kế.

### 8.3. canFulfill nghĩa là gì?

Không chỉ “ngân hàng báo thành công”. Nó kiểm đơn còn payable/chưa quá deadline, chưa có khoản áp dụng, số tiền khớp và snapshot còn giữ. Có tiền nhưng không thỏa điều kiện phục vụ thì giữ bằng chứng, REVIEW và mở hồ sơ xử lý.

### 8.4. Lỗi cộng điểm sau khi đã tạo Payment?

Vì cùng transaction, lỗi làm rollback cả Payment/PAID và dấu xử lý attempt liên quan. IPN gửi lại có thể xử lý lại thay vì gặp trạng thái đã trả tiền nhưng mất điểm do commit một phần.

### 8.5. Thất bại tới sau thành công?

Attempt đã có bằng chứng thành công được bảo vệ; thông báo cũ không được hạ trạng thái đã xác minh. Thứ tự callback tới server không được giả định giống thứ tự người dùng nhìn trên màn hình.

## 9. Vì sao QueryDr không đặt trong transaction?

Lời gọi mạng có thể mất nhiều giây. Nếu giữ khóa Order suốt thời gian đó, IPN, hủy và worker cùng đơn có thể bị chặn. QueryDr được gọi trước; khi kết quả về, apply lấy khóa ngắn và kiểm lại dữ liệu.

Code đặt timeout fetch 8 giây. Timeout chỉ giới hạn thời gian backend chờ, không chứng minh ngân hàng chưa nhận tiền.

`lastCheckedAt` được claim bằng update có điều kiện để hạn chế nhiều request tra cứu dồn trong 15 giây. Nó không khóa tài khoản khách, không thay bằng chứng tài chính và không phải một scheduler đối soát chạy liên tục.

## 10. Retry và tiền về muộn: ví dụ cụ thể

### A hết hạn, QueryDr timeout, khách tạo B

Nếu đơn còn thời gian giữ và chưa có bằng chứng nhận tiền chặn retry, backend có thể cấp B. Attempt A và audit vẫn còn. Đây là chính sách cân bằng trải nghiệm với khả năng thu trùng; không giả vờ A đã thất bại chắc chắn.

### B thành công rồi A cũng thành công

B được áp dụng trước dưới khóa Order. Khi A tới, backend thấy đã có khoản áp dụng nên A được ghi REVIEW và hồ sơ xử lý. Không tạo Order thứ hai, không cộng điểm hai lần hoặc gửi quầy pha hai lần.

### A thành công nhưng đơn đã hết hạn giữ món

Không tự lấy lại kho đã trả cho đơn khác. Backend ghi nhận tiền và hồ sơ; Order cũ không được tự mở lại. Thời điểm quyết định của code dựa điều kiện khi áp dụng kết quả, không mặc định ưu tiên vnp_PayDate để bỏ qua deadline.

### Khách tự đổi query thành mã thành công

Hash phải khớp với dữ liệu; thêm/sửa amount, merchant hoặc status mà không có secret sẽ không tạo được callback hợp lệ. Dù hash đúng, điều kiện nghiệp vụ và reference còn được kiểm thêm.

## 11. Các mã dễ nhầm

| Giá trị | Ý nghĩa cần phân biệt |
|---|---|
| HTTP 200 của IPN | Kênh HTTP có response; chưa chứng minh settlement thành công. |
| JSON `RspCode` | ACK nghiệp vụ mà backend trả cổng, phải đọc cùng nội dung và bản ghi database. |
| `vnp_ResponseCode` | Một trường kết quả từ nhà cung cấp. |
| `vnp_TransactionStatus` | Trường trạng thái giao dịch; ứng dụng kiểm cùng response code. |
| HTTP 303 ở Return | Trình duyệt được chuyển tới trang khác, không phải lỗi và không phải chứng từ đã thu. |
| `VnpayAttempt.status` | Trạng thái xử lý nội bộ của lần giao dịch. |
| `Order.status` | Trạng thái phục vụ đơn hàng. |

Không dùng một chữ “00” để giải thích tất cả các lớp trên như cùng một mã.

## 12. Quyền của khách và barista

Khách chỉ đọc/check attempt của đơn mình. Staff route dùng JWT và BARISTA guard. Barista có thể xem lịch sử, yêu cầu tra cứu và ghi chú; ghi chú không có quyền tự biến đơn chưa có chứng cứ thành PAID.

Endpoint thanh toán giả lập bị chặn khi VNPay bật, kể cả biến bật mock cũng true, để tránh trả tiền qua đường mô phỏng trong lúc đang kiểm cổng.

Client chỉ đọc trạng thái backend để hiển thị. Không nhận số tiền client tự tính là nguồn thật và không cấp database credential cho trình duyệt.

## 13. Minh chứng nên chuẩn bị khi phản biện

| Ca | Quan sát |
|---|---|
| Gửi start lặp cùng key | Cùng attempt; không thêm giao dịch ngoài ý định. |
| IPN thành công đồng thời | Một Payment/điểm, trạng thái nhất quán. |
| Return hợp lệ | 303 nhưng chưa tự có Payment nếu chưa apply kết quả. |
| Sửa amount/merchant/hash | Không PAID. |
| A/B cùng thành công | Một khoản áp dụng, khoản còn lại REVIEW/case. |
| QueryDr timeout | Audit có lý do, không tự kết luận thất bại. |
| Gây lỗi cộng điểm | Settlement rollback, retry có thể thành công. |
| Tiền về sau đóng đơn | Không trừ kho lại/không pha, vẫn giữ bằng chứng khoản thu. |

Test giao thức dùng HMAC vector và request/response test; integration dùng gateway giả lập với PostgreSQL riêng. Giao diện fixture kiểm trình bày, không chứng minh tiền thật. Bộ kết quả đã xác minh được tham chiếu ở VALIDATION của bản vá 13; tài liệu này không tạo ra một kết quả chạy mới.

## 14. Câu trả lời nhanh khi thầy hỏi

**Tại sao không PAID ngay khi khách quay về?** Vì điều hướng qua browser không đủ tin cậy để ghi nhận nghiệp vụ; dự án xác minh IPN/QueryDr tại backend.

**Có chữ ký thì cần khóa làm gì?** Chữ ký kiểm nguồn/toàn vẹn dữ liệu. Khóa giải quyết hai thông báo hợp lệ cùng tranh quyền áp dụng cho một Order.

**Có unique attempt là đủ chưa?** Chưa: hai attempt khác nhau vẫn có thể cùng thu cho một đơn; còn phải phối hợp tại Order và kiểm khoản đã áp dụng.

**Thêm key khác có thu tiền hai lần không?** Start có thể tái dùng mã hiệu lực; khi tạo lần mới vẫn có rủi ro cả hai lần thực sự thu. Dự án không giấu rủi ro đó mà giữ attempt và tách khoản dư để xử lý.

**Tại sao không xóa attempt thất bại?** Để đối soát, truy vết và xử lý kết quả muộn; xóa mất tham chiếu sẽ làm khó chứng minh khoản tiền thuộc đâu.

**Tại sao không nhận amount từ frontend?** Vì client có thể sửa request; backend lấy nghĩa vụ còn thu từ Order đã lưu.

**Nhân 100 có làm tăng tiền thật không?** Không, đó là biểu diễn tham số giao thức, database và giao diện vẫn dùng giá trị VND nghiệp vụ.

**QR có quét thẳng bằng ứng dụng ngân hàng không?** QR của giao diện hiện tại mở URL VNPay qua camera; không gọi nó là mã chuyển khoản ngân hàng.

**Đối soát chưa có kết quả thì có giam khách không?** UI thông báo trạng thái; khi mã hết hạn và đơn còn phù hợp, chính sách cho tạo lần mới dù kết quả cũ chưa rõ, giữ cơ chế xử lý thu trùng.

**Đã có Payment thì có bảo đảm không bao giờ xảy ra sai lệch tiền không?** Không khẳng định tuyệt đối. Đây là mô hình và cơ chế đã thiết kế/kiểm thử; vận hành thực cần đối soát, giám sát và xử lý ngoại lệ theo bằng chứng.

## 15. Cách đọc báo cáo và tài liệu này

Báo cáo giữ luồng, vai trò bảng, quyết định bảo vệ dữ liệu và một số ảnh code/sơ đồ. File này là phần giải thích để trả lời “vì sao”, các tình huống thứ tự/mất mạng và giới hạn của từng cơ chế. Không học thuộc câu trả lời mà bỏ qua việc mở đúng hàm và chứng minh bằng dữ liệu.
