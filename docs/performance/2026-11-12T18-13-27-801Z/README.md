# Kết quả đo hiệu năng BrewLite

Thời điểm kết thúc: 01:16:26 13/11/2026 (Asia/Saigon).

- Dữ liệu: 50 sản phẩm, 20 tài khoản, 100 đơn, 300 dòng món.
- Mỗi endpoint: 20 VU closed-loop, warm-up 10s, đo 30s, không think time.
- Máy: Intel(R) Core(TM) i5-10500H CPU @ 2.50GHz; 12 logical CPU; 15.83 GiB RAM; Node v24.22.2.
- Backend production build riêng, HTTP loopback; database thử nghiệm riêng trên PostgreSQL local. Không benchmark image Docker hoặc Internet.

| API | Requests | p50 ms | p95 ms | p99 ms | Req/s | Lỗi | Kết luận |
|---|---:|---:|---:|---:|---:|---:|---|
| GET /products | 4354 | 115.69 | 284.76 | 341.68 | 144.48 | 0 | Đạt |
| GET /products/:id | 8724 | 63.36 | 101.97 | 146.55 | 290.39 | 0 | Đạt |
| GET /orders/:id | 10438 | 55.20 | 74.08 | 93.98 | 347.62 | 0 | Đạt |
| GET /orders/me | 9294 | 60.26 | 91.19 | 106.32 | 309.29 | 0 | Đạt |

Kết luận: **đạt ngưỡng p95 ≤ 500 ms trong lần đo local này**. Các endpoint được đo riêng, không chạy đồng thời cả bốn nhóm. Percentile tính trên toàn bộ mẫu theo nearest rank, kể cả mẫu lỗi/timeout nếu có.

[Ảnh minh chứng](evidence.png) · [Trang kết quả](evidence.html) · [Dữ liệu và cấu hình](results.json). Mỗi file CSV chứa toàn bộ mẫu của một endpoint.

## Giới hạn

- One local run, not a guarantee for other hardware or Internet traffic.
- Only GET endpoints; no VNPay/network gateway latency or browser rendering measured.
- API and load generator share CPU; database host resources and other background workloads are not isolated.
- This is a read workload with synthetic data, not a capacity limit or long-duration soak test.

API và database tạm đã được dọn sau lần đo; không sửa dữ liệu vận hành. Mã nguồn đo nằm trong proposed-fixes/30-performance-measurement. Commit: 95b957af5277e3e75afae08a759b4fa66386aaa2. Source fingerprint: 642120610b4007077c47f727262a9996d988411e1e388a66d9e2635fc832bd01.
