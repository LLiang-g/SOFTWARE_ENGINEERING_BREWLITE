# Checklist Assignment 2 — rà soát 14/11/2026

Đối chiếu `Assignment2-BrewLite.pdf` với repo và báo cáo riêng. “Có tạo phẩm” không tự động nghĩa là được chấm đủ điểm; “chưa xác nhận” không đồng nghĩa chắc chắn chưa thực hiện ngoài repo.

| Task | Yêu cầu | Tạo phẩm / kết quả | Còn cần chốt |
| --- | --- | --- | --- |
| 1.1 | Bối cảnh, stakeholder, scope, giả định/ràng buộc/rủi ro | context-and-scope.md; báo cáo bổ sung bảng rủi ro | Phản hồi stakeholder nếu dùng làm bằng chứng nghiệm thu |
| 1.2 | FR/NFR, MoSCoW, AC, use-case tổng quát | SRS, bảng yêu cầu và diagram | Không tự nhận mọi AC PASS |
| 1.3 | UC trọng tâm, diagram riêng, actor/trigger/pre/post/main/alt/exception/FR | use-case-checkout.md; báo cáo đã thêm hình UC-01 | — |
| 2.1 | Activity start/end, actor/system, decision, swimlane, hết hàng/login/pay fail | activity-checkout.puml và PNG | — |
| 2.2 | Sequence, JWT/validate, TX, alt payment, idempotency | a2-sequence-checkout.puml/PNG/SVG đã chỉnh các nhánh dừng và kết quả | Đồng bộ khi nghiệp vụ đổi |
| 2.3 | Class, thuộc tính, multiplicity, enum | a2-class-domain.puml/PNG/SVG; Promotion ánh xạ Voucher; LoyaltyTransaction | — |
| 3.1 | Phân lớp, module, DB/mock/log/health/config, trade-off/ADR | 7 ADR và sơ đồ phân lớp trong docs/architecture, báo cáo mục 5.1 | — |
| 3.2 | UML production thực tế, HTTPS/registry/storage/env/log/health/boundaries | Tạm hoãn theo yêu cầu; hình hiện tại là local | Dựng môi trường thực tế rồi vẽ đúng cấu hình |
| 4.1 | Repo/branch/PR, README/ignore/env, board/backlog, commit/DoD | Có cấu trúc tương đương web/API; README và tài liệu quy ước/backlog đối chiếu | Board/Sprint Backlog thực tế, quyền GV |
| 4.2 | Tạo phẩm Task 1–3 trong docs; lịch sử/lý do thay đổi | Có requirements/diagrams/architecture | Commit/push tài liệu mới; đối chiếu lịch sử tuần tự |
| 4.3 | API/menu, loading/empty/error, seed, test | Có code, API test và Playwright menu/checkout | Hồ sơ PWA nếu nghiệm thu cài đặt/offline |
| 4.4 | CI PR install/lint/unit/build, chặn merge khi fail, pass/fail evidence | Đã lấy PR #1 và link CI PR #2; #43 gate xanh, ba artifact; 13 kiểm tra gate local | API main protected=false, rulesets=[]; owner cần bật required checks. Đã có run #45: unit test fail và CI passed fail; log tại docs/verification/ci-negative-2026-11-14/ |
| 5.1 | Tùy chọn/cart/auth/order/mock/confirmation/history/validate/lỗi | Có code, API/browser tests và báo cáo hành trình | AC ngoài phạm vi các test cần kiểm riêng |
| 5.2 | Unit/API/browser E2E, migrate/seed, Compose và health | Hồ sơ unit 42/42; API hồi quy trước; browser 16/16 Docker/Edge; CI smoke/gate | Không dùng số test lượt cũ làm số test run mới |
| 5.3.1 | Quality gate | Có và đã chạy #43, gồm browser E2E | Minh chứng âm trên GitHub nếu chốt gate chặn thực tế |
| 5.3.2–3 | Tag SHA/semver và push registry | Workflow, digest outputs/artifact, ảnh phát hành trước | Link run/artifact đúng bản nộp |
| 5.3.4–6 | Deploy production qua CI, migrate an toàn và smoke | Có cấu hình và script; chưa xác nhận public production | Hoàn thành trên môi trường production đã chọn |
| 5.3.7 | Dừng/rollback khi fail | Exit/throw, state, rollback app và mock contract tests | Bằng chứng vận hành đích; không tự nhận DB rollback |
| 5.4 | HTTPS frontend/API/health, DB kín, secret, release/notes, README/demo/Review/Retro | Có README và tổng kết Review/Retro | URL thực tế; release/tag/notes; video/demo và truy cập bên ngoài |
| Truy vết | FR → UC → diagram → code → test | Ma trận cập nhật 20 FR và 12 NFR | Review theo commit nộp cuối |
| Thứ tự | Tạo phẩm task trước có trên Git trước nghiệm thu task sau | Có tạo phẩm hiện tại và timeline ngày commit thật | Không dựng lại ngày; tài liệu bổ sung muộn không thành tài liệu có sẵn trước |

Checklist phục vụ nhóm, không input nguyên trạng vào PDF. Chi tiết việc còn lại: `Assignment2-report/GHI-CHU-CAN-BO-SUNG.md`.

