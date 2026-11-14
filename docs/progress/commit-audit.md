# Truy vết tiến độ theo commit

Đối chiếu ngày 13/11/2026. Nhóm xác nhận Cao Cát Lượng là PO, Dương Văn Khánh là SM; không suy ra vai trò từ số commit.

## Cách phân kỳ

Ba giai đoạn tám ngày lịch được tổng hợp hồi cứu: 21–28/10, 29/10–05/11 và 06–13/11/2026. Git ghi ngày commit, không ghi thời gian bắt đầu công việc, Daily Scrum hoặc giờ họp Review/Retrospective. Kết quả đo hiệu năng ngày 13/11 được lưu riêng; không tự coi đó là commit đã có trên Git.

Không dùng số commit/dòng code để phân chia điểm, tỷ lệ đóng góp hoặc dựng Actual Burndown. Commit merge không tính thêm thành một lần hiện thực chức năng. Một module có thể do nhiều người cập nhật ở các giai đoạn khác nhau.

## Mốc tích hợp ngoài tập refs local

[PR #1 / merge 761803c](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/761803cc95067447185cf05e1807a18ecebca3af) được GitHub ghi nhận ngày 12/11/2026. Đây là mốc tích hợp vào main, không gán toàn bộ code trong merge cho người merge.

## Đóng góp theo tác giả

### Cao Cát Lượng — L-Liangg

| Ngày | Sprint tổng hợp | Commit | Nội dung |
|---|---:|---|---|
| 2026-10-21 | 1 | [a5116ad](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/a5116adc20f9d9495fe36ecfeb81deed0c96b604) | feat(platform): schema Prisma, migration, seed, docker-compose |
| 2026-10-22 | 1 | [e299172](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/e299172d2b970cf7dfcc8a21b6a52e467b9e89be) | chore: sync branch with latest main |
| 2026-10-22 | 1 | [584b219](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/584b2196f0e7dbf847efa24e9587413ddc1b22bd) | feat(catalog): API GET /products và trang Menu |
| 2026-10-25 | 1 | [34b8dc9](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/34b8dc91723b3387442b111f21244ed266149a52) | chore: prepare for merge |
| 2026-10-26 | 1 | [b962267](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/b9622679936acc64a34262a313c8865ea5bcfb72) | Cap nhat phien ban next |
| 2026-10-28 | 1 | [03fbc54](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/03fbc54dcb0f99a39621de4534aea3b5562f1532) | chore: merge branch son |
| 2026-11-10 | 3 | [47f06f0](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/47f06f043b7d0538174ee9d3302592af6d6e3add) | feat(frontend): th?m ??ng nh?p cho barista ? trang /barista |
| 2026-11-10 | 3 | [4d98873](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/4d988738ffabc45ca5c0c1dc7261c0c16a9e1fd6) | feat(frontend): thêm đăng nhập cho barista ở trang /barista |
| 2026-11-11 | 3 | [289ebda](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/289ebdabdac00d65d2d26c22c922f8350b099c05) | feat(backend): thêm vai trò barista và sổ cái điểm thưởng |
| 2026-11-11 | 3 | [a02dae2](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/a02dae280ffed1bd05c54258ff5a81948de6bbe1) | feat(backend): tính số ly còn lại từ nguyên liệu và công thức món |

### Dương Văn Khánh — khanh

| Ngày | Sprint tổng hợp | Commit | Nội dung |
|---|---:|---|---|
| 2026-10-30 | 2 | [1e68549](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/1e68549bb1a6f8169bc1ab0c4413fac004381b6b) | feat(frontend): tách bước đặt hàng và thanh toán, thêm nút hủy đơn |
| 2026-11-01 | 2 | [7531fea](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/7531fea0c1987957ecfdff3895762b24d56ddbb6) | feat(promotions): mã giảm giá và điểm thưởng |
| 2026-11-11 | 3 | [956778e](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/956778ea9f6294e26585138f71966ed22c10d544) | fix: API cho hủy đơn đã thanh toán và hoàn kho dù chưa hoàn tiền → chặn hủy thông thường, chỉ cho hủy PENDING/PAYMENT_FAILED. |
| 2026-11-11 | 3 | [7b49707](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/7b49707188cae6a9b96122afb99c6690520079be) |  Hoàn kho theo công thức hiện tại trong database thay vì lượng đã giữ lúc đặt |
| 2026-11-11 | 3 | [9ca5548](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/9ca55487f00c8bf2d5779f531d65c6e81657f40a) | (orders): chống tạo đơn và trừ kho trùng bằng idempotency key |
| 2026-11-12 | 3 | [85dba04](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/85dba04531b2c797bf14076de276a77f38915bc3) |  thanh toán online vnpay sand box |
| 2026-11-12 | 3 | [ee6fcb0](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/ee6fcb0678887f10778e38cc29a36e6d500adc86) | fix : Thanh toán lại, đổi món và QR mở VNPay |
| 2026-11-12 | 3 | [b25ab6c](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/b25ab6c7a31edbd079ca69e911a7c47af9c3d156) | feat: hoàn thiện luồng đổi món và thanh toán chênh lệch |
| 2026-11-12 | 3 | [bab072f](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/bab072f4beb2e76f44efb69d543b908805c6009c) | feat: tính nguyên liệu theo size và topping, tự giải phóng kho khi đơn hết hạn |
| 2026-11-12 | 3 | [fc5fb22](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/fc5fb222a2e9f72177ea7ccb2aa6653b5c6262f1) | feat: đóng gói toàn hệ thống BrewLite bằng Docker Compose |
| 2026-11-12 | 3 | [a05aa16](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/a05aa16139820cddcba175ccca8a5f13274111fd) | chore: bỏ theo dõi thư mục tạm dùng kiểm chứng và tạo báo cáo |
| 2026-11-12 | 3 | [9ce537a](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/9ce537a5488801abcf979e2237c564eeed28c3e2) | feat: bổ sung sao lưu và khôi phục PostgreSQL trong Docker |
| 2026-11-12 | 3 | [95b957a](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/95b957af5277e3e75afae08a759b4fa66386aaa2) | ci: tự động kiểm thử, phát hành Docker image và triển khai BrewLite |

### Dương Trung Lâm — lam

| Ngày | Sprint tổng hợp | Commit | Nội dung |
|---|---:|---|---|
| 2026-10-27 | 1 | [7d1ee97](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/7d1ee97f2486620c83975276e9dcce1cef25f695) | feat(auth): đăng ký, đăng nhập JWT, Guard, trang login và register |
| 2026-11-05 | 2 | [eff0b21](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/eff0b212f4199157763a4fe4ea9106d8f49717a1) | feat(staff-ui): dựng giao diện trang nhân viên |
| 2026-11-05 | 2 | [8a64dcf](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/8a64dcf6f8fdd04280043e7cb32495eefa304162) | feat(staff-ui): tải đơn và cập nhật trạng thái tại quầy |
| 2026-11-05 | 2 | [0c4f659](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/0c4f6593aa6f3df1b08ff7bf8d2de64d4287eb2a) | feat(staff-ui): đồng bộ trạng thái đơn qua WebSocket |
| 2026-11-06 | 3 | [886cdc7](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/886cdc72e3cfd73fea3ead830062c43ef331e6c2) | test(staff-ui): kiểm thử trang nhân viên và hướng dẫn demo |

### Đinh Văn Thanh Sơn — LuyenThienMaTon

| Ngày | Sprint tổng hợp | Commit | Nội dung |
|---|---:|---|---|
| 2026-10-26 | 1 | [2c77b3b](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/2c77b3bb7d2f667128b0c664d3fa9c49f011544c) | feat(cart): giỏ hàng Zustand, badge số lượng, trang giỏ hàng |
| 2026-10-28 | 1 | [3f16006](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/3f16006d476690a53d082cfe23cf1cff3a3af0ed) | feat(orders,payments): tạo đơn, thanh toán mock idempotent, trang checkout và xác nhận |

### Nguyễn Hồng An — NguyenHongAn-3123410003

| Ngày | Sprint tổng hợp | Commit | Nội dung |
|---|---:|---|---|
| 2026-10-24 | 1 | [b611917](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/b61191738bd78740fca470c55fdf01f7527d6739) | feat(catalog): chi tiết sản phẩm, chọn size và topping |
| 2026-10-29 | 2 | [3c50070](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/3c50070fde4ddfd4a5ec8b78bfa70554f32a3d36) | feat(inventory): trừ kho bằng khóa lạc quan, hoàn kho khi hủy đơn |

### Phạm Nguyễn Minh Nhật — Nhat-cre

| Ngày | Sprint tổng hợp | Commit | Nội dung |
|---|---:|---|---|
| 2026-10-29 | 2 | [969cf5d](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/969cf5d7892a6b88ff30a6e95997ef3a8594418b) | feat(orders,payments): state machine, hủy đơn, thanh toán idempotent, test (a)(b) bằng Vitest |
| 2026-11-05 | 2 | [8813102](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/88131027071d8b27fe8513150f6a35b5ea3ab50c) | feat(staff,realtime): API duyệt đơn và cập nhật trạng thái qua WebSocket |
| 2026-11-06 | 3 | [5d2d6a4](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/5d2d6a44a262394b38a04e6e652d300550d9277d) | test(staff,realtime): bổ sung kiểm thử trạng thái đơn và WebSocket |
| 2026-11-06 | 3 | [339b262](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/commit/339b2626516f8ec83db513ff65b31bce4d698487) | fix(orders): hiển thị hướng dẫn theo trạng thái đơn |

JSON đi kèm ghi các file thay đổi để đối chiếu theo phạm vi, không chứa email tác giả hoặc nội dung dữ liệu ứng dụng. Các nhận xét Review/Retrospective trong báo cáo là tổng kết kỹ thuật hồi cứu, không phải biên bản họp được tạo lại.
