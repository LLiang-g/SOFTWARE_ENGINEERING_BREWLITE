# Giải thích đơn giản: quầy barista và cập nhật trực tiếp

Đối chiếu source ngày 12/11/2026. Tài liệu đọc riêng, không có câu hỏi phản biện và không sửa ứng dụng.

## 1. Hình dung bằng một đơn cụ thể

Khách trả tiền cho đơn 200. Đơn PAID xuất hiện ở cột chờ duyệt. Barista bấm Duyệt đơn để chuyển PREPARING; pha xong chuyển READY; giao ly cho khách chuyển COMPLETED.

Sau mỗi lần ghi thành công, backend báo có thay đổi. Màn hình khách và quầy gọi API để lấy trạng thái mới. Tín hiệu không tự mang quyền sửa đơn hoặc xác nhận tiền.

## 2. Các file chính

| File | Trách nhiệm |
|---|---|
| [order-state-machine.ts](../backend/src/orders/order-state-machine.ts) | Danh sách cạnh chuyển trạng thái và hàm kiểm luật. |
| [staff-orders.controller.ts](../backend/src/orders/staff-orders.controller.ts) | Route quầy, JWT và role guard. |
| [orders.service.ts](../backend/src/orders/orders.service.ts) | Đọc hàng đợi và transaction cập nhật trạng thái. |
| [orders.gateway.ts](../backend/src/realtime/orders.gateway.ts) | Phát tín hiệu Socket.IO. |
| [useOrdersLive.ts](../frontend/src/features/orders/useOrdersLive.ts) | Kết nối, refresh, polling và hủy request cũ. |
| [StaffBoard.tsx](../frontend/src/features/staff/StaffBoard.tsx) | Bốn cột, nút thao tác, trạng thái đang gửi và lỗi. |

## 3. Tại sao dùng state machine?

Nếu mỗi nút tùy ý gán một chuỗi trạng thái, đơn PENDING có thể bị chuyển thẳng READY. Bảng ORDER_TRANSITIONS đặt luật ở một chỗ, dùng được trong service và test độc lập.

Trong quầy, chuỗi chính là:

```text
PAID → PREPARING → READY → COMPLETED
```

`canTransition()` trả boolean, `assertTransition()` ném ConflictException nếu cạnh không hợp lệ. COMPLETED/CANCELLED không có bước tiếp theo trong bảng hiện tại.

State machine không tự biết người gọi là ai, tiền đã đủ chưa hay có yêu cầu đổi chờ không. Những điều kiện đó phải được kiểm ở guard/service. Một cạnh tồn tại trong bảng không có nghĩa mọi API đều được sử dụng cạnh đó.

Ví dụ PAID → CANCELLED phục vụ đổi món đã duyệt; DTO cập nhật quầy chỉ nhận PREPARING/READY/COMPLETED, không có chức năng hủy PAID tùy ý.

## 4. Hàng đợi không giống lịch sử đơn

`findForStaff()` tách hai truy vấn:

- Toàn bộ đơn PAID/PREPARING/READY, sắp cũ trước bằng createdAt và id.
- 20 đơn COMPLETED gần nhất, sắp mới trước.

Không giới hạn toàn bộ kết quả bằng 20 rồi làm mất đơn đang chờ phục vụ. Nhóm hoàn tất chỉ phục vụ nhìn lại nhanh; API này không được mô tả như lịch sử toàn bộ doanh thu của quán.

Hai truy vấn trong transaction RepeatableRead nhìn cùng một ảnh chụp. Nếu đọc rời, một đơn có thể chuyển sang hoàn tất giữa hai lần đọc và bị mất/lặp ở kết quả ghép.

Ảnh chụp nhất quán không có nghĩa kết quả không thể cũ sau khi trả về. Realtime/polling giúp client đọc lần mới khi dữ liệu đổi.

## 5. updateStaffStatus() cần transaction để làm gì?

```text
Khóa Order
→ Đọc lại trạng thái
→ Kiểm còn trong nhóm được xử lý
→ Nếu bắt đầu pha: kiểm yêu cầu đổi chờ
→ assertTransition
→ UPDATE theo id và trạng thái hiện tại
→ Kiểm count
→ Commit
```

Hai nhân viên cùng bấm Duyệt đơn trên một Order PAID: người đầu ghi PREPARING; người sau lấy khóa rồi thấy PREPARING, không được chuyển PREPARING sang PREPARING. Kết quả là một lần chuyển thật, không hai lần.

Không nói mọi hai request đồng thời chỉ có một cái được thành công trong mọi tình huống. Hai yêu cầu khác đích có thể trở thành hai bước hợp lệ theo thứ tự được xử lý; điều code bảo vệ là luật trên trạng thái đọc lại dưới khóa, không có một version kỳ vọng từ client trong DTO trạng thái hiện tại.

UPDATE kèm trạng thái và kiểm count là bảo vệ thêm, không thay thế việc đọc lại/kiểm luật. Khóa Order cũng phối hợp với thanh toán, hủy và duyệt đổi món.

## 6. Tại sao đang có yêu cầu đổi thì không pha ngay?

Đơn nguồn còn PAID và giữ nguyên liệu khi yêu cầu REQUESTED chờ quầy. Nếu vừa dùng nguyên liệu pha cũ vừa duyệt hoàn nguyên liệu để đổi, tồn ghi sổ sẽ không khớp quá trình phục vụ.

Vì vậy API bắt đầu PREPARING kiểm REQUESTED. Quầy quyết định hoặc khách rút trước rồi mới tiếp tục. Luồng đổi cũng kiểm nguồn vẫn PAID, không thể dùng một màn hình cũ để đổi đơn đã pha.

## 7. Đổi trạng thái có trừ kho hoặc cộng điểm lại không?

Không. Kho được giữ lúc tạo Order; Payment/điểm được ghi khi thanh toán được áp dụng. Cập nhật quầy thay trạng thái phục vụ, không lặp lại các hiệu ứng đó.

Nói “bấm Duyệt đơn là thanh toán/giữ kho” sẽ sai thứ tự nghiệp vụ hiện tại. Xem riêng các tài liệu kho và VNPay khi cần theo dõi hiệu ứng tài chính/tài nguyên.

## 8. Vì sao dùng sự kiện không có payload?

Gateway phát `orders.changed` tới namespace `/orders-live` mà không gửi email, món, tổng tiền hoặc toàn Order. Sau tín hiệu:

- Quầy gọi GET staff orders với quyền BARISTA.
- Khách gọi GET đơn/lịch sử của chính mình với JWT/chủ đơn.

Quyền đọc dữ liệu nằm ở API. Không broadcast toàn bộ Order rồi nhờ frontend tự giấu những đơn không thuộc khách.

Kênh hiện là tín hiệu chung, không mô tả như đã có room riêng theo tài khoản hoặc xác thực JWT socket nếu source gateway không khai báo. Không có payload đơn giúp hạn chế dữ liệu lộ trên kênh, nhưng không đồng nghĩa kênh không bộc lộ tín hiệu hoạt động nào.

CORS origin không thay thế xác thực/phân quyền. Sự kiện cũng không phải chứng từ thanh toán.

## 9. Tại sao phải emit sau commit?

Nếu emit trong lúc transaction chưa xong, client có thể đọc thấy trạng thái cũ hoặc transaction rollback sau đó. Người dùng nhìn thông báo thành công dù dữ liệu không tồn tại.

Code gọi notifyOrdersChanged sau khi transaction trả về thành công. Replay không tạo hiệu ứng mới thì không phát như một lần xử lý mới; các test kiểm cả tình huống không được phát sự kiện.

Cách emit sau commit này không phải một hàng đợi bền vững hoặc transactional outbox. Nếu process dừng giữa commit và emit, client có thể mất tín hiệu đó; việc tải lại khi kết nối/polling giúp đọc trạng thái đã lưu.

## 10. useOrdersLive() kết hợp những gì?

Hook dùng chung cho nhiều màn hình:

1. Khi enabled, kết nối Socket.IO bằng WebSocket.
2. connect: đánh dấu có kết nối và refresh API.
3. orders.changed: refresh API.
4. disconnect/connect_error: hiển thị mất kênh trực tiếp.
5. Tải HTTP ban đầu, không chờ chỉ một sự kiện mới.
6. Mỗi 15 giây, nếu tab đang hiển thị thì refresh bằng HTTP.
7. Cleanup khi rời component: dọn timer/listener/socket và hủy request.

WebSocket giúp nhanh; polling hỗ trợ đồng bộ khi không nhận được tín hiệu. Không khẳng định dữ liệu luôn cập nhật đúng tức thì từng mili giây hoặc tab đã đóng vẫn được push.

## 11. AbortController giải quyết vấn đề gì?

Giả sử lần tải A chậm, lần tải B bắt đầu sau nhưng về trước. Nếu cả hai tự ghi vào state, A có thể ghi đè dữ liệu mới hơn của B.

refresh hủy controller cũ, tạo controller mới, truyền signal cho hàm load. Hàm load ở màn hình phải kiểm signal trước khi cập nhật. `activeLoad` giúp một refresh thuộc callback đã rời màn hình không tiếp tục được dùng.

Đây là kiểm soát response giao diện, không phải khóa database hoặc bảo đảm dữ liệu giữa nhiều transaction nhất quán. Các loại cơ chế bảo vệ khác nhau không thay nhau.

## 12. StaffBoard và StaffGate

StaffGate hỗ trợ chặn/điều hướng giao diện theo trạng thái đăng nhập. StaffBoard hiển thị bốn cột, gửi trạng thái đích, khóa thao tác lúc đang gửi và tải lại sau kết quả.

401 có thể đưa phiên UI về đăng nhập; 403 báo thiếu quyền; 409 hiển thị xung đột và refresh. Backend mới là lớp bắt buộc: tự gọi PATCH vẫn phải qua guard, DTO, state machine và transaction.

Các tab thanh toán/hỗ trợ nằm trong cùng workspace cho barista của quán nhỏ, không cần một vai trò thu ngân tách riêng trong thiết kế hiện tại.

## 13. Kiểm thử đang có

[staff-orders.e2e-spec.ts](../backend/test/staff-orders.e2e-spec.ts) kiểm:

- Quyền JWT/role và lọc hàng đợi.
- Chuyển đúng chuỗi, không lặp Payment/kho/điểm.
- Hai nhân viên cùng duyệt, bỏ bước và request sai.
- Hai client Socket.IO thật nhận sự kiện không payload; đọc API thấy dữ liệu đã commit.
- Rollback, replay, hủy hoàn kho và kết nối lại.
- Nhiều hơn 20 đơn đang xử lý không bị cắt khỏi hàng đợi.

Các client trong test kết nối thật tới ứng dụng Nest test; đây khác với chỉ mock hàm emit. Nó vẫn là môi trường test, không tự chứng minh mạng production luôn không mất sự kiện.

Tài liệu không thêm số liệu test mới. Ảnh bảng quầy trong báo cáo dùng API fixture để minh họa trạng thái các cột.

## 14. Tóm tắt bằng ba câu

State machine và service quyết định một chuyển trạng thái có hợp lệ hay không. Transaction/khóa phối hợp thao tác cạnh tranh, rồi backend phát tín hiệu sau khi ghi thành công. Giao diện nhận tín hiệu và đọc lại API có quyền để lấy trạng thái thật, có tải lại/polling để phục hồi khi mất kết nối.
