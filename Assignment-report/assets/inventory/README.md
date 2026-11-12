# Hình minh họa luồng quản lý nguyên liệu

- `code-demand.png`, `code-reserve.png`, `code-release.png`, `code-expiry.png`: ảnh chụp đoạn code từ các file backend hiện tại ngày 12/11/2026, có tên file/số dòng. Ảnh được render bằng Edge headless từ nội dung source, giữ nguyên nội dung dòng và chỉ xuống dòng hiển thị khi cần.
- `inventory-relations.png`: sơ đồ thực thể chọn lọc, có nguồn `docs/diagrams/inventory-relations.puml`.
- `inventory-lifecycle.png`: luồng tạo đơn/giữ kho/hủy/hết hạn, nguồn Graphviz trong `docs/diagrams/inventory-lifecycle.puml`; render SVG qua PlantUML rồi chuyển PNG.
- `inventory-concurrency.png`: tương tác hai request tranh nguyên liệu cuối, nguồn `docs/diagrams/inventory-concurrency.puml`.

Ảnh giao diện hết hạn sử dụng fixture của bản vá 13 và được chú thích riêng trong báo cáo. Không có khóa, token thật hoặc nội dung file `.env` trong các ảnh.

Các ảnh code phản ánh snapshot source tại thời điểm biên soạn; nếu thay đổi hàm hoặc số dòng, cần chụp lại để duy trì truy vết.
