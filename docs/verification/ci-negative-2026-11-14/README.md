# Kiểm chứng CI phát hiện lỗi — 14/11/2026

- Workflow #45: https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/actions/runs/43604157646
- Nhánh riêng `ci/negative-gate-evidence-20261114`, base `0bd3335`.
- Commit `8d80732` chỉ đổi expected của test giảm giá từ 12000 thành 12001. Không đổi hàm nghiệp vụ.
- Backend: 1 failed, 41 passed; assertion và process exit code 1 trong `backend-failure.log`.
- Gate `CI passed` cũng failure, exit code 1; xem `gate-failure.log`.
- Metadata đầy đủ: `evidence.json`. Ảnh trong báo cáo là hình tổng hợp từ metadata/log, không phải ảnh chụp giao diện GitHub.
- Commit `39be949` đã khôi phục test đúng; tree sau khôi phục giống base. Không merge nhánh kiểm chứng.

Đây là run sự kiện push. Không tạo được PR do connector từ chối quyền ghi. Run này không chứng minh branch protection ngăn merge; owner vẫn cần bật required checks. Publish/deploy còn chịu điều kiện nhánh độc lập.
