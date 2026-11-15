# Ma trận truy vết BrewLite

Cập nhật 14/11/2026 theo repo và bằng chứng hiện có. Mỗi dòng phân biệt code, phép thử và giới hạn kết luận; không tự gán toàn bộ AC PASS. Sơ đồ cập nhật cho A2: `docs/diagrams/a2-sequence-checkout.*`, `a2-class-domain.*`; activity và use-case giữ nguồn tương ứng. ADR tại `docs/architecture/adr/`.

Browser E2E: `docs/verification/browser-e2e-2026-11-14/` (16/16, Edge, Docker local). CI gate: ảnh Actions #43, commit `0bd3335`, success. Hai phạm vi bằng chứng được ghi riêng. Task 3.2/production vẫn để sau.

| Mã | Use-case / nhóm | Thiết kế | Code / API | Test / bằng chứng | Phạm vi kết luận |
| --- | --- | --- | --- | --- | --- |
| FR-01 | UC-02 | Activity/class | products.service.ts; ProductGrid; GET /products | ingredients.e2e-spec.ts; Playwright order-flow | Code/API + browser flow |
| FR-02 | UC-02 | Class | ProductDetail; GET /products/:id | availability/ingredient-demand; Playwright size M | Topping runtime kiểm bằng API; browser chưa kiểm mọi lựa chọn |
| FR-03 | UC-03 | Activity | cart.store.ts; CartView | Playwright order-flow/order-errors | Đã có browser E2E, không coi là mọi thao tác giỏ đều được bao phủ |
| FR-04 | UC-04 | Sequence; ADR-002 | auth service/strategy/guards | auth-roles; Playwright register/permission | Không thay thế kiểm toán bảo mật |
| FR-05 | UC-01 | Sequence; ADR-004 | OrdersService; POST /orders | order-idempotency; inventory; Playwright checkout | Một ý định không tạo/giữ kho lặp |
| FR-06 | UC-01 | Sequence; ADR-005 | PaymentsService + MockGateway | payments; Playwright success/retry | PAYMENT_MOCK_ENABLED=true, VNPAY_ENABLED=false |
| FR-07 | UC-05 | Activity/sequence | GET /orders/me, /orders/:id; confirmation | API ownership; Playwright reload COMPLETED | Đọc lịch sử và chi tiết đúng chủ |
| FR-08 | UC-08 | State machine/class | StaffOrdersController; OrdersService | staff-orders; Playwright staff-flow | 409 giả lập kiểm UI; concurrency có API test riêng |
| FR-09 | UC-06 | ADR-004 | InventoryService; snapshot/expiry | inventory; inventory-snapshot; size-topping-expiry | Khóa dòng nguyên liệu ở bản hiện tại |
| FR-10 | UC-07 | Promotion(Voucher)/LoyaltyTransaction | promotions/loyalty services | discount; promotions; loyalty; browser voucher | Snapshot tiền và cộng điểm một lần |
| FR-11 | UC-01 | Gateway; ADR-005 | VnpayGateway; PaymentQr | vnpay tests | Playwright hiện dùng mock, không chứng minh gateway Sandbox live |
| FR-12 | UC-01 | Sequence; ADR-005 | VnpayService IPN/Return/QueryDr | vnpay.crypto; vnpay API | Chữ ký, merchant, số tiền và tham chiếu |
| FR-13 | UC-11 | ADR-004/005 | Vnpay start/check/apply; refund case | payment-exchange; vnpay API | Thanh toán lại và tiền về muộn |
| FR-14 | UC-09 | Exchange design | ExchangeWorkspace; quote/request/withdraw | payment-exchange API | Không có browser coverage đầy đủ cho đổi món |
| FR-15 | UC-09 | Exchange + version | ExchangeService.decide; creditApplied | payment-exchange API | Duyệt nguyên tử và thu chênh lệch |
| FR-16 | UC-10 | Refund case + version | StaffRefundController; updateRefund | payment-exchange API | Hồ sơ/chứng từ, không tự chuyển tiền ngân hàng |
| FR-17 | UC-09/10/11 | Queue API | StaffPaymentCases; staff APIs | payment-exchange API | Lọc, quyền và các điều kiện hồ sơ |
| FR-18 | Vận hành local | Docker/ADR-007 | Dockerfiles; Compose; migrate/seed | Docker smoke và local E2E stack | Đã có stack đủ web/API/DB; bỏ ghi chú cũ chỉ có DB |
| FR-19 | Delivery | Pipeline + ADR | brewlite.yml; reusable e2e.yml; deploy scripts | Actions #43 / 0bd3335; local 16/16 | Gate đã chạy; URL production/release chốt riêng |
| FR-20 | Phạm vi | Context/scope | Không có UI tài xế | Không nghiệm thu chức năng ngoài phạm vi | Won't |
| NFR-01 | Bảo mật | ADR-002/007 | Guards/JWT/bcrypt/input validation | auth roles/API ownership/browser permission | Test quyền, không pentest toàn hệ thống |
| NFR-02 | Toàn vẹn | ADR-004 | Transaction/unique/row lock/version | inventory/idempotency/exchange | Phân biệt snapshot, khóa và chống lặp |
| NFR-03 | Hiệu năng | Môi trường đo local | docs/performance/tools/run.cjs | JSON/CSV: 32.810 request, p95 bốn API <500ms | Chỉ phạm vi lần đo đã mô tả |
| NFR-04 | Responsive/accessibility | UI/ADR-006 | Tailwind/forms/focus | Ảnh UI và desktop browser E2E | Cần kiểm 390px/1440px và accessibility toàn bộ |
| NFR-05 | Khả dụng | Error/retry + ADR-007 | UI states; authoritative payment status | Playwright injected errors; health/smoke | Không suy thành uptime SLA |
| NFR-06 | Tái tạo/triển khai | ADR-001/003/007 | Lockfile/Docker/migrations | Docker smoke/local clean E2E | Public HTTPS production để sau |
| NFR-07 | Quan sát | ADR-007 | Nest console/Docker logs/deploy state | CI artifacts + logs | Không khẳng định có logging tập trung |
| NFR-08 | Truy vết | ADR-001..007; diagrams | Tài liệu và ma trận này | Kiểm đường dẫn và đối chiếu theo mã | Trạng thái tài liệu, không tự chứng nhận mọi AC đạt |
| NFR-09 | Quality gate | Dependency chain | CI passed needs browser_e2e | Actions #43; validator 13 trường hợp local | CI fail đã kiểm chứng ở run #45; owner còn cần bật required checks |
| NFR-10 | Sao lưu/phục hồi | ADR-003/007 | scripts/database; scripts/deploy | Docker smoke backup/restore | Rollback app tách phục hồi dữ liệu |
| NFR-11 | Phiên | Auth store/UI policy | Zustand session state | Browser contexts riêng cho khách/barista | Không suy ra test hai tab cùng origin đã đủ |
| NFR-12 | PWA | Frontend direction | Next.js responsive | Chưa có hồ sơ install/offline | Could; không gọi mobile UI là PWA đã cài đặt |

