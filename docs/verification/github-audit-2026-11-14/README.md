# Minh chứng GitHub đã tự thu thập — 14/11/2026

Nguồn là GitHub API qua kết nối repository. `evidence.json` lưu thông tin chọn lọc, không chứa token/email/secret. Đây là dữ liệu đọc thực tế, không phải suy ra từ ảnh hoặc commit message.

## Các minh chứng đã có link chính xác

| Nội dung | Nguồn | Kết quả |
| --- | --- | --- |
| Pull Request tích hợp của nhóm | [PR #1](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/pull/1) | Đã merge; head 95b957a |
| CI chạy trên PR của nhóm | [BrewLite CI CD #2](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/actions/runs/43251828645) | Backend, frontend, Docker và CI passed thành công |
| Gate tích hợp browser E2E | [BrewLite CI CD #43](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/actions/runs/43596977311) | Backend, frontend, Docker, browser E2E và CI passed thành công; commit 0bd3335 |
| Browser E2E mới trên main | [BrewLite E2E #3](https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/actions/runs/43600981314) | Thành công; commit 5748020 có thay đổi ghi video |

Run #43 có ba artifact chưa hết hạn tại thời điểm đọc: `backend-test-results`, `docker-smoke-results`, `playwright-report`. Xem ID, digest và kích thước trong JSON; vào link run để tải bản gốc.

## Bảo vệ nhánh — kết quả xác minh

API nhánh `main` trả `protected=false`, `protection.enabled=false`, required status checks ở trạng thái off. API rulesets trả mảng rỗng. Do đó tại thời điểm đọc, không có cấu hình bảo vệ nhánh/required checks cho main được phản ánh bởi các API này.

Kết nối hiện có `push=true` nhưng `admin=false`, `maintain=false`. Endpoint chi tiết branch protection trả 403 `Resource not accessible by integration`. Tôi không thể dùng quyền push để tự bật quyền quản trị. Đây là giới hạn quyền GitHub, không phải lỗi code hoặc việc chưa viết hướng dẫn.

Chủ repo thực hiện một lần:

1. Repo → Settings → Branches → Add classic branch protection rule.
2. Branch name pattern: `main`.
3. Bật Require a pull request before merging.
4. Bật Require status checks to pass before merging; chọn **CI passed** do workflow BrewLite CI CD tạo ra. Kiểm tra đúng tên từ run thực tế.
5. Có thể yêu cầu branch cập nhật với main trước merge. Với chính sách nhóm muốn áp dụng cả admin, bật Do not allow bypassing the above settings.
6. Giữ force push và xóa nhánh ở trạng thái không cho phép; lưu rule.
7. Chụp cấu hình và mở một PR để kiểm tra trạng thái merge bị chặn khi check chưa đạt. Sau đó có thể đọc lại API để xác nhận.

Theo [GitHub Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule), thao tác này cần admin hoặc quyền chỉnh repository rules phù hợp.

## Minh chứng CI phát hiện lỗi

Đã kiểm tra 12 run CI CD kết thúc failure trong 50 run gần nhất trả về. Tất cả 12 đều thất bại ở **Deploy tested images**, tại đăng nhập hoặc script triển khai. Vì thế không dùng chúng làm minh chứng lint/unit/build/browser gate phát hiện lỗi.

Để có minh chứng đúng Task 4.4, chạy thử trên nhánh/PR kiểm chứng riêng: tạo một lỗi lint hoặc assertion test có chủ đích, quan sát job kiểm tra và CI passed thất bại; ghi link run, rồi sửa về đúng để có run xanh. Không merge lỗi thử vào main. Chưa tạo/push nhánh lỗi thử trong đợt thu thập này.

## Backlog, lịch sử và quyền giảng viên

- Repository công khai; có thể mở link code/PR/run để kiểm tra. Không suy ra đã có lời mời riêng cho tài khoản giảng viên.
- Danh sách issues tại thời điểm đọc chỉ gồm ba PR, không có issue công việc độc lập. Điều này không khẳng định một GitHub Project riêng chắc chắn không tồn tại.
- Có thể lập board/backlog hiện tại từ tài liệu `docs/process/assignment2-sprint-backlog.md`; phải ghi ngày tạo thực tế. Không dựng board hoặc ngày họp cũ làm bằng chứng lịch sử.
- Tài liệu/ADR mới đang local cần commit và push. Thời điểm thêm tài liệu được giữ đúng ngày thực hiện, không đổi lịch sử task trước/sau.

## Phân biệt phạm vi

Đợt này chỉ đọc API và lưu minh chứng local, không chỉnh GitHub settings, không merge/push hoặc deploy. Phần production tiếp tục để sau theo yêu cầu nhóm.
