# Giải thích dễ hiểu: đổi món đã thanh toán và thu chênh lệch

Đối chiếu code ngày 12/11/2026. Tài liệu riêng để đọc kỹ; không phải nội dung phải chép nguyên vào báo cáo. Không có phần câu hỏi phản biện.

## 1. Hình dung toàn bộ luồng

Khách đã trả 45.000đ cho đơn A nhưng muốn đổi trước khi pha. Khách mở menu đổi, chọn món mới tổng 75.000đ, xem tiền cũ 45.000đ và tiền thêm 30.000đ, rồi gửi yêu cầu. Barista duyệt mới thực sự thay đơn và thay phần nguyên liệu giữ. Đơn B nhận 45.000đ giá trị từ A, còn 30.000đ trả qua VNPay.

```text
Đơn A PAID
→ Chọn lại món trong menu/giỏ đổi riêng
→ Backend báo giá
→ Gửi REQUESTED, đơn A vẫn được giữ
→ Quầy duyệt
→ Hoàn kho A + giữ kho B + chuyển tiền cũ, cùng một transaction
→ Đóng A, tạo B
→ B PAID nếu bằng giá, PENDING nếu phải trả thêm
```

Đây là thay thế món theo chính sách cửa hàng. Hoàn kho, chuyển credit và hoàn tiền ngân hàng là ba việc khác nhau.

## 2. Tại sao tạo Order mới, không sửa món trên Order cũ?

Đơn cũ đã có lịch sử thanh toán, giữ kho và thao tác quầy. Nếu ghi đè món/tiền, sau này khó biết khách đã mua gì trước lúc đổi và vì sao cần thu thêm.

Giữ hai Order và liên kết bằng OrderExchange giúp lần theo:

- A: món cũ, Payment đã nhận, snapshot nguyên liệu cũ.
- Yêu cầu đổi: lý do, báo giá, người quyết định, thời gian, trạng thái.
- B: món khách sẽ nhận, tiền được chuyển vào và phần còn phải thu.

Đơn A chỉ CANCELLED khi quyết định duyệt đã thành công; không đóng chỉ vì khách mở menu hoặc gửi yêu cầu.

## 3. OrderExchange dùng để làm gì?

Xem [schema.prisma](../backend/prisma/schema.prisma).

| Nhóm trường | Ý nghĩa |
|---|---|
| `sourceOrderId` | Đơn đã trả tiền muốn thay. |
| `replacementOrderId` | Đơn thay thế sau duyệt; trước đó có thể null. Unique để không gắn cùng một đơn thay thế cho nhiều hồ sơ. |
| `items` | Lựa chọn món/size/topping/số lượng khách gửi. |
| `quotedLines`, `quotedTotal` | Báo giá đã nhận ở lúc tạo yêu cầu, để không thay tiền ngoài ý muốn lúc quầy duyệt. |
| `key`, `requestHash` | Nhận diện gửi lại cùng yêu cầu và phát hiện cùng key nhưng khác nội dung. |
| `reason` | Lý do khách muốn đổi. |
| `status` | Chờ, duyệt, từ chối hoặc khách rút. |
| `version` | Phát hiện ai đó đã xử lý dữ liệu trước màn hình đang mở. |
| `decisionNote`, `decidedBy`, `decidedAt` | Ghi nhận quyết định và thời điểm xử lý. `decidedBy` hiện là ID dạng số trong model, không nên tự mô tả là một quan hệ User có khóa ngoại nếu chưa kiểm schema. |

`@@unique([sourceOrderId, key])` cho cùng một key trong cùng đơn chỉ có một hồ sơ. Đây không phải unique riêng trên sourceOrderId: một đơn có thể có các yêu cầu lịch sử đã rút/từ chối. Logic kiểm REQUESTED và index có điều kiện trong SQL kiểm soát yêu cầu còn chờ.

## 4. Tại sao phải có bước quote trước request?

[ExchangeService.quote()/quoteIn()](../backend/src/orders/exchange.service.ts) đọc đơn nguồn, tiền đã áp dụng và sản phẩm để tính báo giá. Frontend cần biết số tiền thật trước khi khách đồng ý, thay vì tự lấy tổng từ giỏ rồi yêu cầu khách tin đó là số backend sẽ thu.

Quote trả:

- `credit`: giá trị đã trả có thể chuyển.
- `lines`, `total`: tiền món mới do backend tính.
- `difference`: total trừ credit.
- `allowed`, `message`: điều kiện và thông báo của bước báo giá.
- `fingerprint`: dấu vân tay để đối chiếu báo giá.

Quote không tạo Order mới, không giữ nguyên liệu mới và không hủy đơn cũ. Dữ liệu có thể đổi sau khi quote nên đây không phải cam kết giữ hàng.

## 5. fingerprint và quotedLines khác nhau thế nào?

Ví dụ backend báo món mới 50.000đ. Trong lúc khách đang đọc, menu đổi thành 55.000đ.

Frontend gửi `expectedQuote` của báo giá 50.000đ khi gửi yêu cầu. Backend tính lại; nếu dấu vân tay không khớp thì yêu cầu khách đọc báo giá mới trước khi gửi tiếp.

Sau khi request đã được chấp nhận ở giá 55.000đ, backend lưu `quotedLines`/`quotedTotal`. Nếu menu đổi tiếp thành 80.000đ trước khi barista duyệt, quyết định vẫn dùng tiền 55.000đ đã lưu.

Hai vai trò:

| Thành phần | Bảo vệ giai đoạn |
|---|---|
| fingerprint + expectedQuote | Phát hiện báo giá đã đổi giữa lúc xem và gửi. |
| quotedLines/quotedTotal | Giữ tiền đã chấp nhận trong thời gian chờ duyệt. |

Fingerprint là SHA-256 của dữ liệu, không phải HMAC với secret như VNPay, không phải token phân quyền. API vẫn kiểm chủ đơn và mọi điều kiện. DTO hiện cho expectedQuote tùy chọn; code so khớp khi trường này được cung cấp, frontend hiện gửi trường đó. Không nói backend bắt buộc mọi client phải gửi nếu code chưa quy định như vậy.

## 6. request(): tại sao không giữ kho mới ngay lúc gửi?

Request khóa Order nguồn, kiểm chủ đơn, key/nội dung, nguồn còn PAID và chưa có yêu cầu REQUESTED khác. Backend kiểm báo giá rồi tạo hồ sơ.

Trong thời gian chờ, đơn A vẫn giữ nguyên liệu cũ. Nếu giữ thêm cả món B ngay ở đây, một khách có thể chiếm hai phần kho trước khi quầy đồng ý. Thiết kế hiện tại chỉ thực hiện chuyển giữ kho khi duyệt.

Vì chưa giữ món mới, có thể lúc gửi còn hàng nhưng lúc quầy duyệt đã hết. Bước duyệt phải kiểm lại và rollback nếu không đủ.

Không áp voucher mới trong request đổi theo controller hiện tại; giá trị credit đã chuyển phản ánh tiền thực sự đã trả cho đơn nguồn, bao gồm tác động của lần mua trước.

## 7. Các trạng thái yêu cầu

| Trạng thái | Điều đang diễn ra |
|---|---|
| REQUESTED | Khách đã gửi, quầy chưa chốt. A vẫn giữ, bắt đầu pha bị chặn. |
| APPROVED | Thay đơn/kho/credit đã commit. Có B liên kết. |
| REJECTED | Quầy từ chối. A vẫn là đơn khách sẽ nhận. |
| WITHDRAWN | Khách rút khi còn chờ. Tiếp tục A. |

Trạng thái yêu cầu không thay thế Order.status. Ví dụ hồ sơ REQUESTED và Order PAID cùng tồn tại là đúng: một cái biểu diễn chờ xử lý hỗ trợ, cái còn lại biểu diễn đơn đã có tiền nhưng chưa pha.

## 8. Tại sao chặn pha khi có REQUESTED?

Nếu quầy đang chuẩn bị món cũ trong khi một người khác duyệt trả nguyên liệu cũ để đổi, dữ liệu có thể nói nguyên liệu còn nhưng thực tế đã dùng.

[OrdersService.updateStaffStatus()](../backend/src/orders/orders.service.ts) khóa Order rồi kiểm yêu cầu chờ trước khi PREPARING. `decide()` cũng khóa Order và kiểm nguồn còn PAID.

Thứ tự request/pha/duyệt quyết định thao tác nào còn đủ điều kiện. Khi đã có REQUESTED, quầy cần duyệt hoặc từ chối trước pha. Khi PREPARING đã được ghi trước, yêu cầu đổi mới không được chấp nhận theo trạng thái cũ.

## 9. decide(): vì sao nhiều bước nằm chung transaction?

Luồng duyệt nằm trong [exchange.service.ts](../backend/src/orders/exchange.service.ts):

```text
BEGIN
→ Khóa Order nguồn
→ Đọc lại yêu cầu, version và trạng thái
→ Kiểm nguồn PAID, tiền cũ đủ tổng
→ Tạo dòng đơn mới theo báo giá snapshot
→ Khóa hợp nguyên liệu cũ và mới
→ Hoàn snapshot A
→ Reserve lựa chọn B
→ Tạo B + snapshot B + credit
→ Đóng A
→ APPROVED, gắn B và tăng version
COMMIT
```

Nếu reserve B không đủ, bước hoàn A cũng rollback. Không để mất đơn cũ khi chưa có đơn mới hợp lệ.

Không tách thành hai API “hủy A” và “đặt B” độc lập, vì mỗi API có thể commit riêng; B thất bại sẽ để khách đã trả tiền nhưng không còn đơn giữ nguyên liệu như trước.

## 10. Tại sao khóa hợp nguyên liệu cũ và mới trước?

Giả sử đơn A dùng cà phê, B dùng sữa; một yêu cầu khác đổi theo chiều ngược lại. Nếu một luồng giữ khóa cà phê rồi chờ sữa, luồng kia giữ sữa rồi chờ cà phê, có thể deadlock.

Code lấy ingredientId từ snapshot cũ, Recipe món mới và ToppingRecipe món mới, gộp trùng, sort rồi khóa. Nhờ vậy phần hoàn và giữ diễn ra với thứ tự nguyên liệu thống nhất hơn.

Đây là biện pháp giảm loại vòng chờ đã nêu, không phải bằng chứng mọi luồng toàn hệ thống tuyệt đối không thể deadlock.

Phần hoàn dùng lượng lịch sử; phần giữ B dùng định lượng mới theo size/topping. Giá đã lưu trong quote không đồng nghĩa đã lưu snapshot nguyên liệu của B: B chỉ có snapshot khi được reserve lúc duyệt.

## 11. Credit không phải thanh toán thêm

Tiền cũ có thể chuyển được tính từ:

```text
sum(Payment.amount của A) + A.creditApplied
```

Code yêu cầu số này bằng A.total trước duyệt. Cộng cả creditApplied giúp đơn A vốn là đơn thay thế trước đó vẫn có thể xác định giá trị đã được trả, không chỉ nhìn Payment mới phát sinh.

Khi tạo B:

```text
B.total         = giá trị món mới
B.creditApplied = giá trị chuyển từ A
B.amountDue     = B.total - B.creditApplied   // tính khi trả response
```

`amountDue` là giá trị tính ra trong response, không phải thêm một cột tiền phải được đồng bộ riêng ở database hiện tại.

Credit là giá trị của quan hệ thay đơn; không có chức năng ví cho khách chuyển credit tùy ý sang mọi đơn.

## 12. Ba ví dụ tiền

| Món mới | Tiền cũ | Kết quả |
|---|---|---|
| 45.000đ | 45.000đ | B PAID, không gọi thu mới, không tạo Payment giả. |
| 75.000đ | 45.000đ | B PENDING, VNPay thu 30.000đ, chỉ nhận pha sau khi đủ tiền. |
| 40.000đ | 45.000đ | Chọn lại theo chính sách hiện tại; không tự biến 5.000đ thành số dư ví hoặc hoàn tự động. |

Chênh lệch dương dưới 5.000đ hiện bị chặn theo quy tắc tích hợp của ứng dụng. Không “làm tròn lên” để thu nhiều hơn giá khách đã đồng ý.

Nếu B đã dùng credit thì tự hủy hoặc worker hết hạn như đơn chưa trả tiền sẽ làm mất chỗ ghi nhận tiền khách. Vì vậy luồng hiện tại loại các đơn có credit khỏi tự hủy/hết hạn thông thường; việc kết thúc trường hợp này cần quầy xử lý theo giá trị đã chuyển.

## 13. Tại sao không tạo Payment 45.000đ mới cho B?

45.000đ là khoản đã thu ở A, không phải một lần thu mới. Tạo Payment mới có thể làm báo cáo doanh thu/dòng tiền hiểu quán nhận hai lần, và có nguy cơ cộng điểm lần nữa.

Khi đổi bằng giá không có giao dịch mới. Khi đổi cao hơn, chỉ phần chênh lệch tạo Payment mới qua VNPay và cộng điểm theo phần tiền đó. Lịch sử Payment của A vẫn tồn tại để đối chiếu khoản ban đầu.

## 14. version bảo vệ những thao tác nào?

Duyệt, từ chối và rút đều dựa version và trạng thái REQUESTED. Cập nhật dùng điều kiện ngay trong UPDATE:

```ts
where: { id, version, status: 'REQUESTED' }
data: { status: 'APPROVED', version: { increment: 1 } }
```

Nếu không thay đúng một dòng thì báo xung đột. Kiểm bằng JavaScript trước UPDATE hỗ trợ phát hiện sớm, nhưng điều kiện UPDATE mới là chốt không cho ghi theo phiên bản cũ.

Khóa Order phối hợp giữa các nghiệp vụ pha/hủy/đổi; version phát hiện người dùng đang thao tác từ dữ liệu cũ. Khóa có thể được nhả lâu trước khi người dùng bấm một quyết định, vì vậy hai lớp có mục đích khác nhau.

`withdraw()` không xóa hồ sơ: ghi WITHDRAWN và quyết định để còn lịch sử. Sau rút, nguồn không bị thay món hoặc hoàn kho chỉ vì từng có yêu cầu.

## 15. Giao diện hỗ trợ luồng như thế nào?

[ExchangeWorkspace](../frontend/src/features/orders/ExchangeWorkspace.tsx) sử dụng menu/chi tiết món quen thuộc và một giỏ riêng. Bản nháp theo tài khoản/đơn được lưu ở sessionStorage, tránh trộn vào giỏ mua thường.

Khách thấy tổng món mới, tiền cũ và chênh lệch trước khi gửi, cùng lý do và xác nhận. Link đổi món trên đơn PAID được trình bày như hỗ trợ, không thành nút mua chính khuyến khích đổi liên tục.

[StaffPaymentCases](../frontend/src/features/staff/StaffPaymentCases.tsx) giúp barista xem yêu cầu, món cũ/mới, tiền và ghi chú trước quyết định. UI gửi version hiện đang xem; backend vẫn kiểm lại, không tin việc nút đang hiện là đủ quyền.

Quyết định commit xong phát thông báo để khách/quầy tải trạng thái mới. Đơn B có tiền thêm sẽ dùng lại màn hình QR, không cần một cổng thanh toán riêng cho đổi món.

## 16. Các test tương ứng

[payment-exchange.e2e-spec.ts](../backend/test/payment-exchange.e2e-spec.ts) có các ca bằng giá/cao hơn, thiếu kho rollback, quyền, tranh chấp duyệt–pha, thay giá và rút yêu cầu bằng version. Test kiểm bản ghi Order/Payment/credit/snapshot và điểm, không chỉ dựa thông báo UI.

Ảnh giao diện bản vá 08 dùng fixture để kiểm trình bày và điều khiển; không xem ảnh đó là chứng từ thu tiền hay bằng chứng một lần chạy API test mới. Việc viết tài liệu này không tự tạo ra kết quả kiểm thử mới.

## 17. Ghi chú riêng về bước kiểm kho báo giá

Source hiện tại của quoteIn cộng nhu cầu từ `recipe.quantity * item.qty`; nó chưa dùng cùng ingredientDemand có hệ số size/topping như reserve sau bản vá 13. Bước decide đã gọi reserve mới nên vẫn kiểm lượng đầy đủ tại transaction duyệt; báo giá không được coi là cam kết giữ hàng.

Điểm nên đồng bộ sau là dùng bộ tính demand chung cho phần kiểm khả năng nguyên liệu ở quote, đồng thời cộng lại lượng snapshot cũ khi tính khả năng đổi. Đây là ghi chú kỹ thuật riêng để hoàn thiện code, không đưa thành danh sách lỗi trong báo cáo. Tài liệu này không sửa source ứng dụng.

## 18. Nối với hai tài liệu trước

- [Đặt hàng và kho](GIAI-THICH-KY-THUAT-DAT-HANG-VA-KHO.md): cách tính định lượng, reserve/release và snapshot.
- [Thanh toán VNPay](GIAI-THICH-KY-THUAT-THANH-TOAN-VNPAY.md): nhận tiền chênh lệch, IPN và khoản thu không áp dụng.

Ba phần dùng chung một nguyên tắc: không thay lịch sử bằng dữ liệu hiện tại, không ghi nhận cùng hiệu ứng nhiều lần và không commit một nửa nghiệp vụ liên quan tiền/kho.
