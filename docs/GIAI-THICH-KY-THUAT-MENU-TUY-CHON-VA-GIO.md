# Giải thích đơn giản: menu, tùy chọn và giỏ hàng

Đối chiếu source ngày 12/11/2026. Tài liệu riêng, không có câu hỏi phản biện; không thay đổi ứng dụng.

## 1. Ba loại dữ liệu không nên nhầm

- Menu là dữ liệu món/giá/options do backend trả.
- Giỏ là lựa chọn mua lưu phía trình duyệt, có thể sửa/xóa tự do.
- Order là kết quả backend đã xác nhận và lưu, có mã, giá chốt và giữ nguyên liệu.

Cho một món vào giỏ không tạo Order, không trừ kho và không mở khóa database chờ khách.

## 2. Tại sao chia component?

| File/thành phần | Trách nhiệm |
|---|---|
| [MenuPage](../frontend/src/app/page.tsx) | Server Component đọc API và quyết định hiển thị menu/lỗi. |
| [ProductGrid](../frontend/src/features/catalog/ProductGrid.tsx) | Lưới và trạng thái danh sách rỗng. |
| [ProductCard](../frontend/src/features/catalog/ProductCard.tsx) | Tóm tắt một món và điều hướng tới chi tiết. |
| [ProductDetail](../frontend/src/features/catalog/ProductDetail.tsx) | Size/topping/qty và thao tác thêm lựa chọn. |
| [ProductImage](../frontend/src/features/catalog/ProductImage.tsx) | Ảnh thật hoặc minh họa dự phòng. |
| [cart.store.ts](../frontend/src/features/cart/cart.store.ts) | Các thao tác trên giỏ và selector tổng. |
| [CartView](../frontend/src/features/cart/CartView.tsx) | Trình bày giỏ, voucher, gửi đặt hàng và lỗi. |

Tách như vậy giúp cùng màn hình chọn món được dùng lại trong luồng đổi món qua callback onAdd, thay vì sao chép cả cách chọn size/topping.

## 3. Menu lấy dữ liệu thế nào?

Lớp [api.ts](../frontend/src/lib/api.ts) gọi GET /products và /products/:id. MenuPage và trang chi tiết đọc dữ liệu ở server; phần tương tác ProductDetail là Client Component.

Lưới responsive có nhiều cột theo kích thước. loading.tsx hiển thị skeleton trong lúc route tải; ProductGrid có nhánh rỗng; MenuPage có nhánh lỗi kết nối và nút tải lại. Không biến lỗi API thành danh sách rỗng rồi nói quán không có sản phẩm.

ProductImage kiểm URL trống và lỗi tải. Khi không có ảnh, vẽ ly minh họa; không truyền src rỗng để browser có thể gửi yêu cầu không mong muốn về trang hiện tại.

## 4. Tại sao frontend vẫn tính giá nếu backend tính lại?

Khách cần thấy tổng đổi ngay khi chọn size/topping, không phải đợi gửi Order. [pricing.ts](../frontend/src/lib/pricing.ts) tính theo options backend trả:

```text
Giá mỗi ly = giá món + phụ thu size + tổng phụ thu topping
Thành tiền dòng = giá mỗi ly × số ly
```

Ví dụ 45.000đ + size L 10.000đ + topping 5.000đ = 60.000đ/ly. Đây là giá hiển thị, không phải quyền quyết định giá thu. Client có thể bị sửa localStorage/request; backend tự đọc giá và kiểm mã tùy chọn khi tạo Order.

Giá size và định lượng nguyên liệu là hai chính sách khác nhau. Thêm 10.000đ không được dùng để suy ra tự động phải trừ bao nhiêu gam nguyên liệu.

## 5. ProductDetail giữ state nào?

size, toppings, qty và trạng thái vừa thêm giỏ nằm ở component. Việc chọn chưa làm thay đổi database. Khi thêm, component đưa tên/mã/tùy chọn/unitPrice/qty vào store hoặc gọi onAdd do workspace đổi món truyền vào.

Availability theo tổ hợp giúp thông báo lựa chọn không còn đủ hàng. Dữ liệu này có thể cũ ngay sau khi đọc, nên reserve backend vẫn kiểm lại. Card menu hiện không được mặc định xem là đã khóa mọi trường hợp hết hàng chỉ vì chi tiết có kiểm availability.

## 6. Tại sao dòng giỏ phải có key riêng?

Cùng Product nhưng M có kem và S không topping là hai lựa chọn khác nhau. Chỉ dùng productId sẽ cộng nhầm hai ly thành một dòng mất tùy chọn.

makeKey tạo khóa từ productId, size và topping đã sort:

```text
3|M|KEM,TRAN_CHAU
```

Chọn cùng hai topping ở thứ tự khác vẫn cùng key. Cùng key cộng qty; khác size hoặc topping tạo dòng mới. Khóa giỏ không phải khóa idempotency tạo đơn hoặc khóa database; nó chỉ nhận diện dòng trong state.

## 7. Vì sao không lưu total riêng?

Store lưu items; selectTotal tính tổng unitPrice × qty, selectCount tính tổng qty. Nếu items và total đều được sửa thủ công, xóa một dòng nhưng quên cập nhật total có thể làm màn hình lệch.

Tính suy ra giảm số trạng thái cần đồng bộ. Tuy vậy unitPrice đang lưu vẫn có thể cũ hoặc bị sửa; không được dùng tổng client làm nguồn thật ở backend.

setQty xóa khi qty về 0, thao tác bình thường có giới hạn 99. Các giới hạn trong store hỗ trợ UI, không thay DTO backend. Không giả định dữ liệu tự sửa trong localStorage luôn đã được validate chỉ vì nút UI có giới hạn.

## 8. Vì sao có localStorage và useHydrated?

Zustand persist lưu giỏ theo origin với tên brewlite-cart. Reload khôi phục được giỏ, nhưng server không có localStorage để biết ngay giá trị đó.

[useHydrated](../frontend/src/features/cart/useHydrated.ts) dùng useSyncExternalStore với snapshot server=false, client=true. Màn hình chờ đến khi có thể dùng dữ liệu trình duyệt, tránh server render số ly khác giá trị client đem vào lần đầu.

Giỏ hiện là storage dùng chung origin, không phải một giỏ backend đồng bộ mọi thiết bị hoặc một giỏ tách theo tài khoản. Intent đặt hàng được tách theo tài khoản, nhưng không vì vậy mà toàn bộ items cũng tự thành giỏ riêng từng User.

## 9. checkout-intent khác cart ra sao?

Cart lưu khách đang muốn mua gì, thay đổi thường xuyên. [checkout-intent.ts](../frontend/src/features/cart/checkout-intent.ts) lưu một ý định gửi cụ thể với key/nội dung để xử lý trường hợp chưa nhận response.

Ví dụ backend đã tạo Order nhưng response mất. Nếu client tự sinh key mới rồi gửi lại có thể tạo hai Order. Intent đã lưu trước request cho phép dùng key cũ khi nội dung không đổi.

Intent lưu trong sessionStorage theo userId. Khác tài khoản không dùng cùng intent; reload cùng tab vẫn có key. Không chứa token trong nội dung intent. Topping và voucher được chuẩn hóa để so sánh; không tự khẳng định mọi thứ tự dòng giỏ tương đương đều được chuẩn hóa.

## 10. Gửi đặt hàng

```text
Kiểm đăng nhập
→ Chặn gửi chồng bằng placingRef
→ Chuẩn bị/lưu intent
→ Gửi productId, size, toppings, qty và voucherCode
→ Backend tính lại giá, giữ kho, tạo Order
→ Nhận response xác nhận
→ Xóa giỏ và hoàn tất intent
→ Chuyển tới trang Order
```

Không xóa giỏ ngay trước khi gửi, vì lỗi có thể làm khách mất lựa chọn. Khi đã có Order thì thanh toán diễn ra trên Order, không tạo lại toàn bộ giỏ cho mỗi lần thử trả tiền.

Nếu auth thay đổi trong lúc request đang chạy, CartView kiểm lại token trước khi ghi tiếp vào UI. Không dùng response của một tài khoản để tự coi tài khoản vừa đổi là chủ đơn.

placingRef chỉ bảo vệ một component, không chống mọi tab/retry/client tự gọi API. OrderCreateRequest và unique key phía backend mới bảo vệ hiệu ứng tạo đơn.

## 11. Những điều cần kiểm tra cùng nhau

- Danh sách rỗng khác lỗi API.
- Giá tùy chọn và số lượng cập nhật đúng.
- Cùng cấu hình gộp dòng, khác cấu hình tách dòng.
- Reload giữ giỏ và không sai HTML trước hydration.
- Thao tác tăng/xóa cập nhật cả total và badge.
- Thiếu đăng nhập quay về giỏ sau login.
- Giá client bị sửa vẫn không quyết định giá Order.
- Mất phản hồi dùng lại key, không tạo thêm Order/giữ thêm kho.

Ảnh UI trong báo cáo không tự thay thế một lần chạy browser E2E. Phần tính lại giá/validation/idempotency có các test backend liên quan; tiêu chí frontend cần được kiểm với hành vi trình duyệt thật.
