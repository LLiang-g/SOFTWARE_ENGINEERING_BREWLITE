# Kết quả browser E2E ngày 14/11/2026

- Mã tham chiếu HEAD: `c5a6f37f6ec9595956af0d7f8aa51fa6be922713`; test mới từ main của Lượng, gồm commit `aae7cad`, `bba4083`, `e13cd1c`.
- Chạy trên bản sao working tree, không thay đổi mã ứng dụng. Backend test `ingredients.e2e-spec.ts` có thay đổi local nhưng không thuộc bộ browser test này.
- Kết quả cuối: **16 passed, 0 failed**, 31,0 giây, 1 worker.
- Browser: Microsoft Edge qua `E2E_BROWSER_PATH`; tên project Playwright vẫn là `chromium`. Chưa xác nhận kết quả riêng trên Chromium bản Playwright tải xuống hoặc browser khác.
- Stack Docker thử riêng: PostgreSQL 16, NestJS và Next.js production build từ Dockerfile hiện tại; migrate/seed database mới. Web 4100, API 4101, DB 55438. Mock bật, VNPay tắt. Tác vụ hết hạn tắt để cô lập kiểm thử UI.
- Phạm vi: 1 luồng khách hoàn chỉnh, 8 ca giỏ/lỗi/thanh toán, 7 ca quầy/phân quyền/lỗi. Một số ca lỗi HTTP dùng route mock; luồng đặt/thu tiền mock/quầy chính gọi API/database thật.
- `playwright.log`: log cuối của lượt chạy sạch. `last-run.json`: trạng thái Playwright. `playwright-report.png`: ảnh báo cáo HTML sinh từ lần chạy thật.
- Báo cáo HTML đầy đủ ở `e2e/playwright-report/index.html`; mở từ thư mục `e2e` bằng `npm.cmd run report`. Lần chạy tiếp theo có thể ghi đè báo cáo này.
- Lượt đầu thiếu FFmpeg để ghi video; đã cài bằng `npx playwright install ffmpeg`, sau đó chạy lại đủ 16 ca trên DB tạm mới. Không tính các lỗi môi trường ban đầu là lỗi nghiệp vụ.
- Sau thử nghiệm đã dừng và xóa đúng Compose project `brewlite-e2e-1794659216646` cùng volume tạm. Không dùng database ứng dụng hoặc thay đổi env gốc.

Kết quả này không thay thế test VNPay Sandbox, mobile, hiệu năng hoặc bảo vệ phát hành bằng quality gate E2E.
