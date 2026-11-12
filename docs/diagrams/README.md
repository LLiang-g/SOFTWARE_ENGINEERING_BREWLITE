# Nguồn sơ đồ

Hai sơ đồ use-case là tạo phẩm Task 1, baseline 12/11/2026. Nguồn PlantUML, bản SVG để xem/đối chiếu và PNG để đưa vào LaTeX được lưu cùng tên.

Nguồn chuẩn nằm tại thư mục này. Các file usecase cũ trong Assignment-report/ là phiên bản trước, không dùng làm baseline hiện tại. Actor quản lý/giảng viên là stakeholder, không tự suy ra một role đăng nhập mới trong code. Barista kiêm xử lý thanh toán theo phạm vi quán nhỏ.

Tái render với PlantUML (công cụ ở môi trường phát triển, không phải dependency ứng dụng):

```powershell
java -jar <duong-dan-plantuml.jar> -charset UTF-8 -tsvg docs/diagrams/usecase-system.puml docs/diagrams/usecase-checkout.puml
java -jar <duong-dan-plantuml.jar> -charset UTF-8 -tpng docs/diagrams/usecase-system.puml docs/diagrams/usecase-checkout.puml
```

Sử dụng layout Graphviz mặc định; môi trường kiểm tra đã chạy `java -jar <plantuml.jar> -testdot` thành công với dot 2.44.1. Activity, sequence, class và deployment là tạo phẩm Task 2/3, chưa được đánh dấu hoàn tất bằng hai hình use-case này.
