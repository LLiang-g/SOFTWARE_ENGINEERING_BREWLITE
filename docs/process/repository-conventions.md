# Quy ước repository BrewLite

Ghi nhận ngày 14/11/2026. Tài liệu dùng cho phối hợp và review; không thay thế cấu hình bảo vệ nhánh trên GitHub.

- `main`: nhánh tích hợp. Nhánh cá nhân/chức năng là nơi phát triển và sửa lỗi; gửi PR để tích hợp.
- Commit phân loại `feat`, `fix`, `test`, `docs`, `ci`, `chore`; mô tả hành vi hoặc vấn đề cụ thể.
- PR ghi vấn đề, thay đổi, test đã chạy và tác động tới cấu hình/dữ liệu.
- Không commit JWT/merchant secret, env thật, backup dữ liệu hoặc dependency.
- Khi đổi schema, ghi migration mới tương ứng; không sửa lịch sử đã áp dụng trên môi trường dùng chung.
- Khi đổi nghiệp vụ, đối chiếu yêu cầu, diagram, code và fixture/test trong cùng đợt review.
- DoD: đúng AC, build đạt, kiểm input/quyền/lỗi, test liên quan và tài liệu chạy.

Các check chạy trong workflow là bằng chứng kỹ thuật. Chính sách “không merge khi check lỗi” cần ruleset/branch protection của repository, do người có quyền quản trị thiết lập và lưu minh chứng.
