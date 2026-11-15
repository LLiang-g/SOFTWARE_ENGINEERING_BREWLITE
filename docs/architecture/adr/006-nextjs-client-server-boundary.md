# ADR-006 — Next.js và ranh giới dữ liệu client/server

- Ngày ghi nhận: 14/11/2026.
- Trạng thái: Áp dụng, ghi nhận theo hiện thực hiện tại.

## Bối cảnh

Menu cần tải dữ liệu phía server, còn tùy chọn/giỏ cần tương tác nhanh. DNS container chỉ dùng trong mạng Docker; trình duyệt khách cần địa chỉ API truy cập được từ host.

## Quyết định

Dùng Next.js App Router kết hợp Server/Client Components, Tailwind cho bố cục responsive, Zustand cho giỏ/phiên. Server tải catalog qua SERVER_API_URL; browser gọi NEXT_PUBLIC_API_URL. Backend tính lại giá, xác thực và kiểm kho; không tin tổng do UI gửi. WebSocket chỉ thông báo thay đổi để client tải lại dữ liệu đúng quyền.

## Phương án khác và đánh đổi

- Chỉ client-render giảm phân tách server/client nhưng tăng thời gian chờ catalog ban đầu.
- Một URL nội bộ cho cả SSR/browser làm browser không phân giải được tên container.
- Next.js hỗ trợ kết hợp tải và tương tác; đổi lại cần xử lý hydration và hiểu biến NEXT_PUBLIC được chốt lúc build. Persist giỏ cải thiện trải nghiệm nhưng state trình duyệt không có thẩm quyền với dữ liệu nghiệp vụ.

## Hệ quả và truy vết

Đổi API public phải rebuild image frontend. `NEXT_PUBLIC_` không chứa bí mật. Mobile-first là định hướng UI; chính sách cài đặt/offline PWA cần thiết kế riêng, không suy ra từ việc dùng Next.js. Nguồn: `frontend/src/lib/api.ts`, `frontend/src/features/cart/`, `frontend/next.config.ts`, `frontend/Dockerfile`, `docker-compose.yml`.
