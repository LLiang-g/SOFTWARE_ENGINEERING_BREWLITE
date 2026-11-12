# Tài liệu ôn phản biện: đặt hàng, giữ nguyên liệu và hoàn kho

Ngày đối chiếu source: 12/11/2026. Tài liệu đọc riêng, không thay thế báo cáo và không tự cập nhật file `.tex`.

Phạm vi là luồng đã triển khai sau bản vá 13: lựa chọn size/topping, tạo đơn, giữ kho, chống request lặp, hủy, hết thời hạn giữ món và phối hợp với thanh toán/đổi món. Những đoạn code ngắn dưới đây trích lược cơ chế; muốn xem đầy đủ hãy mở các file được liên kết.

## 1. Cách trình bày trong một phút

> Nhóm quản lý tồn theo nguyên liệu, vì nhiều món có thể dùng chung cà phê, sữa hoặc topping. Khi khách chọn món vào giỏ, hệ thống chưa giữ kho. Khi tạo đơn hợp lệ, backend tính tổng nguyên liệu theo size/topping, khóa những dòng nguyên liệu liên quan, kiểm tra rồi trừ trong cùng transaction tạo đơn. Lượng thực tế vừa trừ được lưu thành snapshot của đơn. Khi hủy hợp lệ hoặc hết thời hạn giữ món, backend hoàn theo snapshot đó nên công thức thay đổi không làm sai kho. Idempotency bảo vệ khi request bị gửi lại; khóa dòng bảo vệ nhiều request tranh cùng nguyên liệu. Thanh toán chỉ xác nhận đơn đã giữ, không trừ thêm lần nữa.

Các từ cần phân biệt:

| Khái niệm | Ý nghĩa trong dự án |
|---|---|
| Tồn có thể bán | `Ingredient.stock`: đã trừ lượng dành cho đơn chờ, không phải phép đo vật lý riêng biệt của toàn bộ nguyên liệu còn nằm trong quán. |
| Giữ nguyên liệu | Giảm tồn có thể bán và lưu lượng đã giữ theo đơn. Chưa có nghĩa đã mang nguyên liệu đi pha. |
| Khóa dòng | Khóa database trong transaction ngắn để các thao tác cập nhật phối hợp với nhau. |
| Snapshot | Bản ghi lượng thực tế đã giữ trong lịch sử của một đơn. |
| Hoàn kho | Trả lại lượng đã giữ khi đủ điều kiện; khác với hoàn tiền. |
| Idempotency | Một yêu cầu nghiệp vụ được gửi lại vẫn chỉ tạo một hiệu ứng. |

**Điểm dễ nói nhầm:** nguyên liệu được giữ lúc tạo Order, không phải lúc vừa mở món hoặc lúc thanh toán thành công. Khóa database không kéo dài suốt 30 phút giữ món.

## 2. Bản đồ đọc source

| File | Đọc để hiểu |
|---|---|
| [schema.prisma](../backend/prisma/schema.prisma) | Các bảng, quan hệ và unique/index. |
| [ingredient-demand.ts](../backend/src/products/ingredient-demand.ts) | Tính lượng theo size/topping và số phần có thể bán. |
| [inventory.service.ts](../backend/src/products/inventory.service.ts) | `reserve()` và `release()`, khóa nguyên liệu/snapshot. |
| [orders.service.ts](../backend/src/orders/orders.service.ts) | Transaction tạo đơn, request hash, replay, hủy và response cho UI. |
| [reservation-policy.ts](../backend/src/orders/reservation-policy.ts) | Cấu hình deadline và kiểm tra hết hạn. |
| [reservation-expiry.service.ts](../backend/src/orders/reservation-expiry.service.ts) | Quét, khóa và đóng đơn hết hạn. |
| [products.service.ts](../backend/src/products/products.service.ts) | Availability theo tổ hợp lựa chọn và ảnh chụp đọc nhất quán. |
| [vnpay.gateway.ts](../backend/src/payments/vnpay.gateway.ts) | Ký URL, chặn QR vượt deadline đơn. |
| [vnpay.service.ts](../backend/src/payments/vnpay.service.ts) | Chặn thanh toán quá hạn, IPN và khoản tiền về muộn. |
| [exchange.service.ts](../backend/src/orders/exchange.service.ts) | Hoàn kho cũ/giữ kho mới, chuyển credit và kiểm tra version. |
| [useOrdersLive.ts](../frontend/src/features/orders/useOrdersLive.ts) | WebSocket và polling tải trạng thái backend. |

## 3. Tại sao cần từng bảng?

### 3.1. Product: thứ khách mua

Product có tên, giá, ảnh và liên kết công thức. Nó trả lời “quán đang bán món gì?”.

Không lưu tồn độc lập cho mỗi món vì tài nguyên thật có thể dùng chung. Nếu chỉ còn 20g cà phê, không thể đồng thời nói cà phê sữa còn một phần và Americano còn một phần rồi cho cả hai đơn cùng mua thành công. Hai con số hiển thị đều là khả năng dựa trên cùng tài nguyên, không phải hai phần nguyên liệu riêng.

**Khi được hỏi tại sao không dùng Product.stock:** quản lý theo thành phẩm phù hợp hàng đóng gói; quán pha chế cần kiểm tra nguyên liệu dùng chung và tùy chọn nên nhóm chọn Ingredient/Recipe.

### 3.2. Ingredient: tài nguyên thật được kiểm soát

Các trường chính: `id`, `name`, `unit`, `stock`.

`stock` dùng số nguyên theo đơn vị nhỏ nhất được chọn, ví dụ g/ml/cái. Nhờ đó phép cộng/trừ kho có kết quả xác định. Nếu cần chính xác dưới 1g, có thể đổi đơn vị sang mg; dùng Int không có nghĩa hệ thống biểu diễn được mọi độ chia mà không đổi đơn vị.

Trong thiết kế hiện tại, stock giảm ngay khi giữ món. Nguyên liệu có thể vẫn ở quầy nhưng không còn được bán cho đơn khác. Nếu sau này cần phân biệt `onHand`, `reserved`, `consumed`, phải mở rộng mô hình; không gọi stock hiện tại là một sổ kiểm kê vật lý đầy đủ.

### 3.3. Recipe: nối món với lượng nguyên liệu

Mỗi dòng ghi `productId`, `ingredientId`, `quantity`, `scalesWithSize`.

Ví dụ một món có ba dòng: cà phê 20g, sữa đặc 30ml, ly nhựa một cái. Product và Ingredient có quan hệ nhiều–nhiều; Recipe không chỉ là bảng nối vì nó còn mang định lượng.

`@@unique([productId, ingredientId])` ngăn cùng món khai báo hai dòng cùng nguyên liệu một cách vô ý. Nếu muốn tăng lượng cà phê, sửa quantity của dòng đó, không tạo thêm dòng trùng.

### 3.4. scalesWithSize: vì sao chỉ nhân số ly là chưa đủ?

Một ly L thường cần nhiều chất lỏng hơn S, nhưng vẫn dùng một ly nhựa. Nếu nhân mọi nguyên liệu theo 1,5, hệ thống có thể trừ hai ly nhựa sau khi làm tròn, dù chỉ bán một ly.

- `true`: lượng tăng theo hệ số size.
- `false`: lượng giữ nguyên trên mỗi ly, vẫn nhân số ly đặt.

Đây là thuộc tính của **dòng công thức**, không nhất thiết là thuộc tính cố định của Ingredient trong mọi món. Cùng một nguyên liệu có thể được dùng theo cách khác nhau trong các công thức khác nhau.

### 3.5. ToppingRecipe: topping cũng tiêu hao kho

Một dòng chứa `toppingCode`, `ingredientId`, `quantity`. Topping hiện được nhận diện bằng mã trong danh mục giá của backend; bảng này quản lý công thức, không thay thế toàn bộ danh mục bán hàng.

Lý do tách riêng:

- Một topping có thể dùng nhiều nguyên liệu.
- Một nguyên liệu có thể dùng cho món cơ bản và topping.
- Không cần sao chép công thức topping cho từng Product.
- Có thể thay định lượng topping cho các đơn đặt mới ở một nơi.

Hiện một phần topping được tính trên mỗi ly và không nhân thêm hệ số size. Đây là chính sách nghiệp vụ của bản hiện tại. Nếu quán muốn topping L nhiều hơn S thì cần đặc tả và mở rộng công thức tương ứng.

### 3.6. Order và OrderItem: sự kiện mua hàng

Order lưu chủ đơn, trạng thái, tổng tiền, credit và deadline. OrderItem lưu Product, size, danh sách mã topping, số ly và thành tiền dòng.

OrderItem trả lời “khách mua gì?”. Snapshot nguyên liệu trả lời “hệ thống đã giữ bao nhiêu tài nguyên?”. Hai câu hỏi khác nhau nên không dùng một loại dữ liệu để thay thế loại còn lại.

### 3.7. OrderInventoryReservation: bằng chứng lượng đã giữ

Các trường quan trọng:

| Trường | Vai trò |
|---|---|
| `orderId` | Đơn nào đã giữ. |
| `ingredientId` | Giữ nguyên liệu nào. |
| `quantity` | Chính lượng đã trừ; bao gồm size và topping. |
| `releasedAt` | Null khi chưa hoàn; có thời điểm khi đã hoàn. |

Ví dụ: đặt giữ 20g; sau đó Recipe sửa thành 25g. Nếu hoàn theo Recipe mới, quán được cộng dư 5g không có thật. Hoàn theo snapshot chỉ trả 20g.

Không dùng version công thức để tự suy ra lượng cũ vì cách đó phải lưu đầy đủ lịch sử công thức, chính sách size và topping rồi dựng lại phép tính. Snapshot cuối cùng trực tiếp lưu số cần hoàn, đơn giản hơn cho nghiệp vụ hủy toàn đơn.

Unique `(orderId, ingredientId)` thể hiện việc cộng gộp tất cả nhu cầu trước khi lưu. Một đơn nhiều món dùng chung sữa chỉ cần một dòng tổng lượng sữa giữ.

Giữ nguyên snapshot sau khi hoàn giúp tra cứu. `releasedAt` vừa hỗ trợ kiểm tra đã hoàn vừa cho biết thời điểm; nó không tự bảo đảm chống tranh chấp nếu chỉ đọc/ghi ngoài transaction. Cần kết hợp khóa và kiểm tra như phần dưới.

Các khóa ngoại Restrict tới Order/Ingredient bảo vệ bằng chứng lịch sử khỏi việc xóa tùy tiện. Đây là bảo vệ quan hệ dữ liệu, không phải cơ chế lưu lịch sử cho mọi thuộc tính của sản phẩm.

### 3.8. OrderCreateRequest: tại sao chống trùng không nằm trong OrderItem?

Trường chính là `userId`, `idempotencyKey`, `requestHash`, `orderId` và `createdAt`.

Đây là bản ghi yêu cầu tạo đơn. Khóa duy nhất theo khách và key cho phép hai khách dùng cùng chuỗi key mà vẫn độc lập. `orderId` liên kết tới kết quả.

`requestHash` không phải hash để mã hóa giỏ hàng hoặc bảo vệ mật khẩu. Nó là dấu vân tay của nội dung đã chuẩn hóa nhằm phát hiện một key bị tái sử dụng cho yêu cầu khác.

Một key không đủ nếu không ràng buộc nội dung: khách có thể gửi key cũ nhưng đổi số lượng rồi vô tình nhận kết quả đơn khác với điều mình vừa gửi.

### 3.9. Hai timestamp trên Order: vì sao không chỉ dùng createdAt?

`reservationExpiresAt` lưu deadline cụ thể. Nếu cấu hình thời gian giữ đổi từ 30 sang 15 phút, đơn cũ vẫn có deadline đã ghi; không tự thay đổi do đọc cấu hình mới.

`reservationExpiredAt` ghi nhận đã kết thúc vì hết hạn, phân biệt với khách hủy hoặc đơn cũ được thay khi đổi món. Không chỉ nhìn thời gian hiện tại để suy ra đã hoàn kho: có thể deadline đã qua nhưng worker chưa commit.

Trạng thái vẫn dùng CANCELLED để tái sử dụng vòng đời hiện có; timestamp mang thêm nguyên nhân nghiệp vụ. Đây là lựa chọn thiết kế, không phải bắt buộc mọi hệ thống đều phải làm giống nhau.

Index `(status, reservationExpiresAt, id)` phục vụ lọc trạng thái, tìm deadline và thứ tự quét. Index giúp truy vấn, không tự thực thi quy tắc hết hạn hoặc bảo đảm tính đúng.

## 4. Tính nguyên liệu: đi từ lựa chọn đến một Map demand

### 4.1. Thuật toán hiện tại

`ingredientDemand()` nhận danh sách món, các Recipe và ToppingRecipe, trả `Map<ingredientId, quantity>`.

Với từng dòng món:

1. Kiểm tra tồn tại công thức.
2. Lấy hệ số S=100%, M=125%, L=150%.
3. Với từng thành phần tăng theo size, làm tròn lên lượng cho **một ly**.
4. Với vật tư cố định, giữ lượng cơ bản.
5. Cộng lượng từng phần topping.
6. Nhân số ly và cộng vào Map theo ingredientId.

Đây là cấu hình mẫu hiện tại, không phải định luật rằng mọi món L đều dùng đúng 150%. Khi bảo vệ nên nói rõ “nhóm chọn chính sách này”, không nói “size L bắt buộc là 1,5 lần”.

### 4.2. Ví dụ đầy đủ

Giả sử công thức minh họa có cà phê 18g, một ly nhựa; topping dùng thêm 5g cùng nguyên liệu cà phê. Khách đặt hai ly M có topping:

```text
Cà phê cơ bản mỗi ly M = ceil(18 × 125 / 100) = 23g
Thêm topping mỗi ly    = 5g
Hai ly                = (23 + 5) × 2 = 56g
Ly nhựa               = 1 × 2 = 2 cái
```

Ví dụ topping dùng cà phê ở đây chỉ nhằm minh họa nguyên liệu dùng chung; không phải khẳng định topping Kem mặc định dùng cà phê.

Không tính `ceil(18 × 1,25 × 2) = 45g` rồi chia đều, vì chính sách làm tròn được định nghĩa theo từng ly.

### 4.3. Vì sao phải cộng gộp trước khi kiểm kho?

Kho có 30g nguyên liệu. Món cơ bản cần 25g, topping cần 10g cùng nguyên liệu.

Nếu kiểm riêng: `30 >= 25` và `30 >= 10` đều đúng, nhưng nhu cầu thật 35g vượt kho. Map demand phải ghi 35g rồi so sánh một lần.

Nguyên tắc này áp dụng cho nhiều món khác nhau cùng dùng sữa, không chỉ một món và topping.

### 4.4. availableFor() và ProductsService.views()

Với demand cho **một ly theo lựa chọn**, số ly có thể bán là:

```text
min(floor(stock nguyên liệu / demand nguyên liệu))
```

Nguyên liệu giới hạn nhất quyết định số ly. `ProductsService.views()` sinh tổ hợp size/topping và dùng cùng bộ tính với reserve để giảm nguy cơ hiển thị một công thức nhưng trừ theo công thức khác.

Đọc bằng RepeatableRead giúp các truy vấn trong transaction nhìn một ảnh chụp nhất quán của dữ liệu đã commit. Nó không giữ chỗ nguyên liệu cho người xem menu và không ngăn khách khác đặt ngay sau đó.

Hiện danh mục có hai topping nên có bốn tập topping cho mỗi size. Cách sinh mọi tổ hợp tăng theo `2^n`; không nên khẳng định cách này tối ưu cho danh mục có hàng chục topping. Khi mở rộng, có thể tính theo lựa chọn gửi lên thay vì trả mọi tổ hợp.

## 5. OrdersService.create(): vì sao phải gom trong một transaction?

Luồng chính:

```text
Tạo hash nội dung và tìm replay
→ BEGIN
→ Tạo OrderCreateRequest để tranh quyền sở hữu key
→ Kiểm tra món, giá, voucher
→ reserve(tx, items)
→ Tạo Order + OrderItem + snapshot + deadline
→ Gắn Order vào request key
→ COMMIT
→ Trả response
```

Nếu trừ kho thành công nhưng tạo Order thất bại, toàn bộ phải rollback. Không để nguyên liệu bị giữ bởi một đơn không tồn tại.

Nếu tạo Order xong nhưng ghi snapshot thất bại, cũng rollback. Không để đơn không có bằng chứng lượng đã giữ.

`tx: Prisma.TransactionClient` được truyền vào reserve/release thay vì để chúng tự mở transaction độc lập. Nếu mỗi hàm tự commit, transaction ngoài thất bại sẽ không tự hoàn tác transaction con đã commit.

**Cách trả lời ngắn:** “Transaction bảo đảm các thay đổi cùng thành công hoặc cùng bị hoàn tác; khóa dòng giải quyết việc nhiều transaction cùng tranh một tài nguyên. Hai việc bổ sung cho nhau.”

## 6. reserve(): khóa gì, lúc nào, có khóa cả bảng không?

Đoạn trọng tâm:

```sql
SELECT id, stock FROM "Ingredient"
WHERE id IN (...)
ORDER BY id
FOR UPDATE;
```

Đây là khóa dòng các nguyên liệu được chọn, không phải khóa độc quyền cả bảng Ingredient. PostgreSQL còn có khóa mức bảng phục vụ phối hợp thao tác, nhưng không vì vậy mà mọi món trong quán đều bị khóa bán.

Các request dùng nguyên liệu khác nhau có thể xử lý song song. Nếu cùng dùng cà phê thì phải phối hợp trên dòng cà phê.

### 6.1. Hai khách tranh 20g cuối

| Thời điểm | Khách A | Khách B |
|---|---|---|
| 1 | Lấy khóa dòng, thấy stock=20g | Bắt đầu đặt cùng nguyên liệu. |
| 2 | Kiểm đủ, trừ 20g | Chờ khóa của A. |
| 3 | Lưu Order/snapshot, commit | Được tiếp tục khi khóa nhả. |
| 4 | Hoàn tất yêu cầu | Với mức cô lập mặc định Read Committed, đọc dòng cập nhật còn 0g, từ chối đơn. |

Nếu A rollback, B có thể thấy tồn chưa bị trừ và đặt thành công. Do đó không “trừ trước rồi sửa tay” nếu một request thua.

### 6.2. Vì sao khóa theo id tăng dần?

Nếu A giữ nguyên liệu 1 rồi đợi 2, còn B giữ 2 rồi đợi 1, có thể deadlock. Các luồng lấy cùng tập tài nguyên theo thứ tự thống nhất làm giảm nguy cơ vòng chờ này.

Không nói “sort id loại bỏ mọi deadlock”. Các bảng/luồng khác vẫn có thể tạo chu trình khóa, nên còn cần quy ước thứ tự khóa toàn luồng và xử lý lỗi phù hợp.

### 6.3. Vì sao kiểm toàn bộ trước khi trừ?

Đọc kho sau khóa, kiểm tất cả lượng cần trước, rồi mới cập nhật. Thiếu một thành phần có thể từ chối sớm, tránh các lệnh cập nhật không cần thiết. Nếu lỗi phát sinh sau một số cập nhật, transaction vẫn là lớp bảo vệ rollback toàn bộ.

### 6.4. reserve trả gì và vì sao không đọc Recipe lần nữa?

Nó trả chính các cặp ingredientId/quantity từ demand đã dùng để trừ. OrdersService dùng kết quả đó tạo snapshot.

Nếu đọc lại công thức để dựng snapshot, có thể tạo ra hai nguồn tính toán khác nhau. Ghi từ demand vừa áp dụng bảo đảm snapshot phản ánh lượng thực sự đã giữ trong transaction này.

### 6.5. Tại sao có CHECK stock không âm dù đã kiểm trong service?

Service đưa ra lỗi nghiệp vụ rõ ràng. CHECK là lớp bảo vệ cuối nếu đường ghi khác hoặc SQL nhập tay cố tạo stock âm. CHECK không tự bảo đảm snapshot/Order đúng, nên không thay thế transaction và cơ chế cạnh tranh.

## 7. Idempotency: khác khóa kho như thế nào?

Khóa kho bảo vệ **nhiều yêu cầu mua độc lập** tranh cùng tài nguyên. Idempotency bảo vệ **một yêu cầu bị gửi lại**.

Ví dụ backend đã tạo đơn và giữ 20g, nhưng response mất trên đường mạng. Frontend gửi lại cùng key. Nếu chỉ khóa kho, request mới vẫn có thể giữ thêm 20g khi kho còn đủ. Cần replay kết quả cũ.

### 7.1. Vì sao tìm replay trước rồi vẫn tạo unique key trong transaction?

Tìm trước giúp trả nhanh khi đã có kết quả. Nhưng hai request có thể cùng tìm thấy “chưa có” tại một thời điểm. Unique constraint mới là điểm phân xử khi cả hai cùng thử ghi key.

Key được tranh **trước** reserve, nên bên thua không tự tạo thêm một hiệu ứng kho đã commit. Transaction đầu rollback thì quyền sở hữu key cũng rollback, cho phép thử lại.

### 7.2. Vì sao bắt P2002 ngoài transaction?

P2002 là lỗi unique constraint trong Prisma. Sau lỗi SQL như vậy, transaction PostgreSQL có thể ở trạng thái lỗi; không tiếp tục đọc replay trong cùng transaction. Code để transaction rollback rồi mới truy vấn lại kết quả đã commit.

Không nói “mọi lỗi P2002 đều là replay”: code chỉ trả replay nếu thực sự tìm được bản ghi phù hợp; nếu không vẫn ném lỗi.

### 7.3. Nội dung chuẩn hóa gồm gì?

Code hiện sort mã topping trong từng dòng, chuẩn hóa voucher, lấy Product/size/qty để hash. Không hash tổng giá do client tự gửi.

Thứ tự các dòng items hiện vẫn là một phần nội dung hash; không khẳng định hệ thống đã chuẩn hóa mọi cách biểu diễn giỏ tương đương.

### 7.4. Đơn đã hủy dùng key cũ thì sao?

Vẫn trả đúng đơn cũ. Muốn mua lại phải bắt đầu yêu cầu mua mới/key mới. Nếu key cũ tự tạo đơn mới sau hủy, một retry rất muộn có thể tự phát sinh giao dịch khách không có ý định mua.

### 7.5. Tại sao nút chống bấm liên tục chưa đủ?

Nút không bảo vệ reload, nhiều tab, client tự gọi API, retry do mạng hoặc nhiều backend instance. UI hỗ trợ trải nghiệm; backend/database kiểm soát hiệu ứng nghiệp vụ.

## 8. cancel() và release(): tại sao hai hàm riêng?

`cancel()` biết người dùng và luật vòng đời đơn. `release()` biết cách trả tài nguyên theo snapshot. Tách riêng cho phép worker hết hạn và luồng duyệt đổi món tái sử dụng hoàn kho mà không giả làm một request khách hủy.

### 8.1. cancel() cần kiểm tra gì?

- Người gọi sở hữu đơn.
- Trạng thái PENDING hoặc PAYMENT_FAILED.
- Không có credit đã chuyển từ đơn trước.
- Khóa Order để phối hợp với thanh toán.
- Kiểm tra attempt PENDING/REVIEW theo luật hủy chủ động hiện tại.
- Chuyển CANCELLED bằng cập nhật có điều kiện theo trạng thái.
- Gọi release trong cùng transaction.

Kiểm tra ở ngoài transaction giúp phản hồi sớm; không được xem nó là bằng chứng dữ liệu sẽ giữ nguyên. Bên trong còn khóa và điều kiện cập nhật để chặn trạng thái vừa thay đổi.

### 8.2. release() làm gì?

```text
Khóa các dòng snapshot của Order
→ Không có snapshot: từ chối tự suy ngược
→ Có releasedAt: từ chối hoàn thêm
→ Cộng quantity vào đúng Ingredient
→ Ghi releasedAt
```

Các lệnh UPDATE Ingredient cũng lấy khóa ghi của PostgreSQL. SELECT FOR UPDATE trong release khóa các dòng snapshot; không nên nói nó trực tiếp khóa Ingredient ngay ở câu SELECT đó.

### 8.3. Hai khách/worker cùng hoàn một đơn

Luồng chuẩn khóa Order trước. Chỉ giao dịch chuyển trạng thái hợp lệ mới hoàn. release còn khóa snapshot và kiểm releasedAt để bảo vệ lượng lịch sử.

Nếu lỗi xảy ra sau khi cộng kho nhưng trước khi hoàn tất cập nhật trạng thái/dấu hoàn, transaction rollback. Không được bắt lỗi rồi commit phần còn lại.

### 8.4. Tại sao đơn thiếu snapshot không hoàn theo Recipe cho tiện?

Không có bằng chứng lượng đã trừ. Dùng công thức hiện tại là đoán lịch sử, có thể tạo dư hoặc thiếu hàng. Chuyển quầy đối soát là quyết định bảo toàn dữ liệu, không phải tùy tiện bỏ qua yêu cầu khách.

## 9. Giữ kho 30 phút nhưng khóa chỉ vài mili giây: có mâu thuẫn không?

Không. Có hai cơ chế khác nhau:

| Trong transaction | Sau commit |
|---|---|
| Khóa dòng để kiểm và ghi an toàn. | Stock đã giảm, snapshot và deadline đã lưu. |
| Request cạnh tranh có thể phải đợi. | Khóa được nhả, đơn khác tiếp tục dùng phần còn lại. |
| Rollback tự hoàn tác thay đổi. | Hủy/hết hạn dùng transaction mới để trả snapshot. |

Không mở một transaction suốt lúc người dùng trả tiền: điều đó giữ kết nối/khóa lâu và phụ thuộc tốc độ mạng/người dùng.

## 10. Deadline và worker: tại sao cần nhiều hàm nhỏ?

### 10.1. reservationDeadline()

Đọc `ORDER_RESERVATION_MINUTES`, mặc định 30, kiểm tra số nguyên từ 1 đến 1440, tạo Date khi tạo đơn. Cấu hình sai không âm thầm tạo thời hạn vô nghĩa.

### 10.2. holdHasExpired()

Dùng chung quy tắc timestamp đã đóng hoặc deadline đã tới. Các API start/apply cùng dựa quy tắc này để không mỗi nơi hiểu một kiểu.

Hàm này chỉ kiểm chính sách thời gian. Nó không tự truy vấn tiền, hoàn kho hoặc hủy mọi trạng thái; service phải kiểm thêm trạng thái, Payment và credit.

### 10.3. sweep()

Quét khi module khởi động và theo chu kỳ 30 giây, mỗi lượt tối đa 100 đơn, ưu tiên deadline sớm. Cờ `running` tránh tự quét chồng trong một process, được hạ lại trong finally.

Batch hữu hạn tránh mỗi lượt giữ một công việc quá lớn. Chu kỳ quét không phải cam kết mọi đơn được hoàn đúng giây deadline, nhất là backlog lớn hoặc backend tắt. API thanh toán vẫn chặn theo deadline ngay cả khi worker chưa chạy.

### 10.4. expireOne()

Mỗi đơn có transaction riêng:

```sql
SELECT id FROM "Order" WHERE id = ... FOR UPDATE SKIP LOCKED;
```

Sau khi lấy khóa phải đọc lại điều kiện. Danh sách sweep tìm được trước đó có thể đã cũ do khách vừa trả tiền.

SKIP LOCKED cho worker bỏ qua đơn đang bị luồng khác giữ khóa; đơn đó sẽ được xét ở lượt sau. Đây là lựa chọn phù hợp xử lý hàng đợi, không phải mặc định dùng cho mọi API khách cần kết quả ngay.

### 10.5. Vì sao cần cả running lẫn SKIP LOCKED?

`running` chỉ nằm trong bộ nhớ của một process. Hai backend có hai cờ khác nhau. Khóa database phối hợp được các transaction trên cùng database; không thay thế bằng một biến JavaScript nếu cần nhiều instance.

### 10.6. Vì sao dùng lifecycle hooks và unref()?

`onModuleInit()` đăng ký timer và quét ngay để xử lý đơn quá hạn sau restart. `onModuleDestroy()` dọn timer. `unref()` không để riêng timer này giữ Node process sống khi các tài nguyên khác đã kết thúc; nó không biến tác vụ thành một hàng đợi bền vững chạy ngoài backend.

## 11. Tại sao deadline giữ món phải ảnh hưởng QR?

```text
10:00 tạo đơn, giữ tới 10:30
10:10 QR đầu hết → vẫn có thể tạo QR mới
10:25 tạo QR mới → không được kéo dài quá 10:30
10:30 hết giữ món → không trả tiền tiếp vào đơn cũ
```

Nếu QR tới 10:35 trong khi kho đã trả lúc 10:30, khách có thể trả tiền cho đơn không còn nguyên liệu giữ. Vì vậy thời hạn QR là min(thời hạn QR cấu hình, deadline Order).

Trong 5 giây cuối, bản hiện tại không cấp QR mới để tránh đưa khách một mã gần như vừa hiện đã hết. Đây là chính sách ứng dụng, không khẳng định VNPay bắt buộc mọi merchant dùng ngưỡng 5 giây.

### 11.1. Worker chưa chạy nhưng khách gọi thẳng API thanh toán?

Backend kiểm deadline tại điểm tạo thanh toán. Không chỉ ẩn nút frontend, cũng không chỉ chờ worker cập nhật CANCELLED.

### 11.2. IPN đến sau deadline?

Code kiểm deadline khi áp dụng kết quả. Không tự PAID hoặc trừ lại kho đã giải phóng; ghi bằng chứng nhận tiền, REVIEW và hồ sơ khoản thu không áp dụng. Nếu callback đến trước worker, nhánh xử lý phù hợp đóng đơn/hoàn snapshot trong transaction.

Tình huống khách trả sát hạn nhưng callback muộn được đưa quầy xử lý theo bằng chứng. Không nói “ngân hàng chắc chắn tự hoàn” và không gọi timeout là thanh toán thất bại chắc chắn.

### 11.3. Tại sao worker có thể đóng attempt chưa rõ, nhưng khách tự hủy lại bị chặn?

Đây là hai luật khác nhau. Hủy chủ động đang kiểm PENDING/REVIEW để tránh đóng ngay giữa một lần thanh toán chưa rõ. Hết thời hạn giữ món có giới hạn tài nguyên: worker có thể kết thúc đơn chưa có bằng chứng đã thu dù attempt còn chưa rõ. Attempt không bị đổi thành FAILED để che mất khả năng tiền về; kết quả muộn đi qua hồ sơ xử lý.

### 11.4. Những đơn nào worker không tự đóng?

Đơn đã thanh toán, có Payment/bằng chứng `paidAt`, hoặc có `creditApplied > 0`. Đơn đổi món đã chuyển tiền cũ không phải đơn chưa từng trả tiền. Cần quy trình bảo toàn/chuyển trả giá trị đó, không áp dụng timer hủy như đơn bỏ giỏ thông thường.

## 12. Đổi món: vì sao không đơn giản hoàn cũ rồi tạo mới ở hai API?

Nếu hoàn đơn cũ đã commit, sau đó giữ món mới thất bại, hệ thống có thể mất chỗ nguyên liệu của đơn đã trả tiền mà chưa có đơn thay thế hợp lệ.

Trong `ExchangeService.decide()`:

1. Khóa Order nguồn và kiểm lại trạng thái/yêu cầu/version.
2. Tính tập hợp nguyên liệu từ snapshot cũ, Recipe mới và ToppingRecipe mới.
3. Khóa hợp của tập nguyên liệu theo id tăng dần.
4. Release snapshot cũ.
5. Reserve đầy đủ lựa chọn mới.
6. Tạo Order thay thế và snapshot mới, chuyển credit.
7. Đóng đơn cũ và ghi quyết định yêu cầu.
8. Commit toàn bộ.

Món mới thiếu hàng thì rollback cả bước hoàn cũ: đơn cũ và kho vẫn giữ như trước khi duyệt. Snapshot cũ lưu lượng lịch sử; món mới sử dụng công thức đang được đọc cho lần giữ mới.

## 13. Version đang được dùng ở đâu?

OrderExchange và PaymentRefundCase dùng cập nhật có điều kiện:

```ts
const changed = await tx.paymentRefundCase.updateMany({
  where: { id, version, status: row.status },
  data: { status, version: { increment: 1 } },
});
if (changed.count !== 1) throw new ConflictException(/* ... */);
```

Hai nhân viên cùng đọc version=0: người đầu ghi thành công và nâng lên 1, người sau không ghi khớp version=0 nữa. Dùng điều kiện ngay trong UPDATE mới là chốt bảo vệ; chỉ so sánh version bằng JavaScript trước UPDATE không đủ khi có tranh chấp.

Kho hiện dùng khóa dòng, không dùng Ingredient.version. Có thể giải thích lựa chọn khóa cho vùng ngắn có cạnh tranh tài nguyên, và version để phát hiện màn hình/hồ sơ đã cũ.

| Cơ chế | Giải quyết |
|---|---|
| Transaction | Tính nguyên tử của nhiều thay đổi. |
| Khóa dòng | Phối hợp các transaction tranh cùng dòng dữ liệu. |
| Version trong UPDATE | Phát hiện ghi dựa trên phiên bản đã cũ. |
| Unique key | Chặn một giá trị/quan hệ bị ghi trùng. |
| Snapshot | Bảo toàn lượng lịch sử để hoàn đúng. |
| Deadline/worker | Thu hồi lượng giữ không được sử dụng. |

**Lưu ý ôn phản biện:** Assignment 1 ghi transaction + optimistic locking cho tồn kho. Việc có version ở hồ sơ khác chứng minh hệ thống dùng optimistic concurrency, nhưng không chứng minh kho đã dùng đúng cơ chế được nêu trong câu đó. Trình bày trung thực đối tượng áp dụng; không gọi SELECT FOR UPDATE là optimistic locking.

## 14. Frontend có vai trò gì?

Frontend hiển thị giá/availability, gửi lựa chọn, nhận Order và thông báo trạng thái. Không kết nối PostgreSQL trực tiếp và không tự quyết định lượng hoàn/tiền đã nhận.

`OrderConfirmation`/`OrderHistory` đọc dữ liệu backend để phân biệt hết hạn với hủy thường. `useOrdersLive` nhận thông báo và tải lại; polling 15 giây khi tab hiển thị dự phòng WebSocket gián đoạn.

Sự kiện chỉ phát sau commit để người nhận đọc trạng thái đã ghi. WebSocket giúp cập nhật nhanh nhưng không phải nguồn dữ liệu duy nhất hoặc bằng chứng thanh toán. Khách đóng website không nhận thông báo trong ứng dụng ngay; khi mở lại sẽ đọc trạng thái đã lưu. Không mô tả đây là SMS/email/push.

## 15. Kịch bản nên dùng khi thầy yêu cầu chứng minh

| Tình huống | Dữ liệu cần quan sát |
|---|---|
| Hai khách tranh phần cuối | Số Order thành công, stock, tổng lượng snapshot; không chỉ nhìn hai thông báo UI. |
| Gửi lại cùng key | Cùng orderId, một lần trừ, không thêm snapshot hoặc Order. |
| Cùng key đổi nội dung | Lỗi xung đột, không đổi kho. |
| Hủy sau sửa Recipe | Quantity snapshot không đổi, lượng hoàn đúng nguyên liệu cũ. |
| Hai yêu cầu hủy | Một lần hoàn; lần sau bị chặn, stock không tăng tiếp. |
| Lỗi sau reserve/release | Kho, trạng thái và snapshot cùng rollback. |
| Hết hạn trước worker | API không tạo thanh toán mới; sau worker có dấu hết hạn và hoàn kho. |
| IPN muộn | REVIEW/hồ sơ xử lý; không PAID, không lấy kho lại để phục vụ đơn cũ. |
| QR cũ hết khi đơn còn hạn | Tạo attempt mới nhưng không giữ thêm kho, không gia hạn Order. |
| Đổi món thiếu kho mới | Đơn cũ, credit và lượng giữ cũ vẫn được bảo toàn nhờ rollback. |

Đọc test theo ba phần Arrange–Act–Assert: thiết lập điều kiện, thực hiện hành vi, kiểm tra hiệu ứng. Test concurrency phải gửi đồng thời và kiểm kết quả dữ liệu, không chỉ viết hai lệnh tuần tự.

Phân biệt unit, API integration PostgreSQL và UI fixture. Kết quả đã xác minh của bản vá 13 độc lập là 42 unit và 135 integration; lần kiểm tra source ghép ghi nhận 31 unit của bộ hiện có. Không dùng số của bộ test khác làm số nghiệm thu của một commit mới. Tài liệu này không thực hiện thêm một lần chạy test mới.

## 16. Câu hỏi phản biện thường gặp

### Có phải khách vừa chọn món đã khóa kho?

Không. Chọn trong giỏ chưa giữ. Khi tạo Order, transaction khóa ngắn để kiểm và trừ; sau commit việc giữ chỗ nằm trong stock/snapshot/deadline.

### Thanh toán xong mới trừ có đơn giản hơn không?

Có thể thiết kế như vậy, nhưng có nguy cơ nhận tiền rồi không còn nguyên liệu nếu không có cơ chế khác. Dự án chọn giữ trước có thời hạn để hạn chế tình huống đó, đổi lại phải xử lý đơn bỏ thanh toán.

### Một transaction có tự chống bán vượt không?

Không nên khẳng định như vậy ở mọi mức cô lập. Hai transaction có thể đọc cùng tồn nếu không phối hợp. Ở đây SELECT FOR UPDATE và việc kiểm sau khóa bảo vệ tài nguyên chung.

### Chỉ dùng phép decrement nguyên tử có đủ không?

Decrement tránh mất cập nhật nhưng nếu không có điều kiện/kiểm tra phù hợp vẫn có thể trừ xuống âm. Đồng thời còn phải bảo đảm Order/snapshot cùng ghi thành công. Dự án chọn đọc sau khóa, kiểm đủ rồi cập nhật trong transaction.

### Sao không cache kho ở frontend để nhanh hơn?

Có thể cache để hiển thị, nhưng số hiển thị không có quyền giữ chỗ. Giá trị có thể cũ ngay sau khi đọc nên backend vẫn phải kiểm tại điểm tạo đơn.

### Snapshot có phải dư thừa dữ liệu không?

Nó lưu một sự kiện lịch sử khác với cấu hình hiện hành. Dữ liệu này phục vụ hoàn và đối chiếu, không chỉ sao chép vô ích các giá trị luôn có thể dựng lại.

### Snapshot có chống được mọi sai lệch kho không?

Không. Nó giúp hoàn đúng lượng đã ghi. Tính đúng còn phụ thuộc cách tính demand, transaction, mọi đường cập nhật kho và dữ liệu đầu vào. Không đánh đồng snapshot với một sổ cái kho đầy đủ.

### Nếu quán đổi giá thì sao?

Đơn đã tạo lưu thành tiền; gửi lại cùng key không tự định giá/trừ kho lại. Hoàn nguyên liệu dùng snapshot lượng, không liên quan lấy giá hiện tại. Đổi món có báo giá/credit là một nghiệp vụ riêng.

### Backend tắt lúc đơn hết hạn thì sao?

Deadline vẫn ở database. Khi backend chạy lại, worker quét tiếp. Trong lúc process tắt không có worker chạy; không khẳng định timer chạy độc lập trên hạ tầng khác.

### Worker chạy đúng 30 phút có chắc chắn không?

Không hứa chính xác từng giây: có chu kỳ quét, khóa đang bận và backlog. Quyền bắt đầu/áp dụng thanh toán dùng deadline thật; việc thu hồi vật lý bản ghi giữ diễn ra khi worker hoặc nhánh xử lý phù hợp commit.

### Tại sao thanh toán muộn không tự giữ kho lại?

Kho có thể đã bán cho người khác. Tự mở lại sẽ hứa phục vụ khi không còn tài nguyên. Hệ thống ghi nhận tiền và hồ sơ xử lý riêng thay vì che mất khoản tiền hoặc tự tái tạo đơn.

### Cách này có tuyệt đối không deadlock, không lỗi không?

Không trình bày tuyệt đối. Có quy ước thứ tự khóa, transaction, ràng buộc và test để giảm/bắt sai lệch trong các luồng đã thiết kế; môi trường vận hành còn cần theo dõi, xử lý lỗi và kiểm thử phù hợp.

## 17. Những câu nên tránh khi bảo vệ

| Tránh nói | Nói chính xác hơn |
|---|---|
| “Khóa cả bảng suốt lúc khách thanh toán.” | Khóa những dòng cần dùng trong transaction ngắn; giữ món sau commit bằng dữ liệu đã lưu. |
| “Có transaction là không tranh chấp.” | Transaction bảo đảm nguyên tử, kết hợp khóa/điều kiện để xử lý cạnh tranh. |
| “Có version ở đâu cũng đạt yêu cầu version của kho.” | Version hiện bảo vệ hồ sơ đổi/thu dư; kho dùng khóa dòng. |
| “QR hết hạn tức ngân hàng thất bại.” | Hết hạn mã không tự chứng minh dòng tiền; giữ lịch sử và xử lý kết quả xác minh. |
| “Đã đóng đơn thì bỏ qua IPN.” | Vẫn ghi nhận bằng chứng tiền về và xử lý khoản không áp dụng. |
| “Hoàn kho là hoàn tiền.” | Hoàn kho trả tài nguyên; hoàn tiền là quy trình tài chính riêng. |
| “Ẩn nút là đã bảo mật.” | Backend kiểm quyền, trạng thái và điều kiện ngay tại thao tác ghi. |
| “Test fixture UI chứng minh database đúng.” | Fixture kiểm giao diện; integration với PostgreSQL kiểm dữ liệu và transaction. |

## 18. Thứ tự ôn và liên hệ báo cáo

1. Học phần 1 để trình bày tổng quan mà không nhầm giữ kho với khóa dòng.
2. Đọc phần 3–4 để giải thích mô hình và định lượng; tương ứng mục 4.2/4.7 báo cáo.
3. Đọc phần 5–8 để giải thích transaction, lock, idempotency và snapshot; tương ứng 5.5.3.
4. Đọc phần 9–12 để trả lời deadline, QR, tiền muộn và đổi món.
5. Đọc phần 13 để phân biệt optimistic/pessimistic concurrency.
6. Tập chứng minh bằng dữ liệu ở phần 15, rồi luyện câu hỏi phần 16–17.

Ảnh code và sơ đồ đã dùng trong báo cáo có tại [assets/inventory](../Assignment-report/assets/inventory/README.md). Khi cần trỏ code, dùng tên hàm và tên file vì số dòng có thể đổi sau chỉnh sửa.
