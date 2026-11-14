import { expect, type Page, type Route } from '@playwright/test';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// Tài khoản barista do seed tạo. Nếu backend/.env của bạn đổi BARISTA_EMAIL / BARISTA_PASSWORD
// thì đặt cùng giá trị cho hai biến môi trường này khi chạy test.
export const BARISTA_EMAIL = process.env.E2E_BARISTA_EMAIL ?? 'barista@brewlite.local';
export const BARISTA_PASSWORD = process.env.E2E_BARISTA_PASSWORD ?? 'barista123';

// Khung báo lỗi có chữ. Chỉ chọn thẻ <p role="alert">, vì Next.js có sẵn một phần tử
// role="alert" rỗng dùng để đọc thông báo chuyển trang.
export function errorBox(page: Page) {
  return page.locator('p[role="alert"]').filter({ hasText: /\S/ });
}

// ---------- Khách hàng ----------

// Đăng ký tài khoản khách mới rồi chuyển tới đường dẫn `next`.
export async function registerNewCustomer(page: Page, next: string) {
  const email = `e2e+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto(`/register?next=${encodeURIComponent(next)}`);
  await page.locator('input[type="email"]:visible').fill(email);
  const passwords = page.locator('input[autocomplete="new-password"]:visible');
  await passwords.nth(0).fill('e2e-pass-123');
  await passwords.nth(1).fill('e2e-pass-123');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
}

// Thêm 1 ly Cà phê sữa (id 1 trong seed) vào giỏ rồi đăng ký tài khoản mới, kết thúc ở trang /cart.
export async function prepareCartAsNewCustomer(page: Page) {
  await page.goto('/products/1');
  await page.getByRole('button', { name: /^Thêm vào giỏ/ }).click();
  await expect(page.getByText('Đã thêm vào giỏ').filter({ visible: true })).toBeVisible();

  // Giỏ hàng được lưu trong trình duyệt nên vẫn còn sau khi tải lại trang
  await registerNewCustomer(page, '/cart');
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText('Size S').filter({ visible: true })).toBeVisible();
}

// Bấm Đặt hàng, chờ sang trang đơn hàng và trả về mã đơn.
export async function placeOrder(page: Page): Promise<number> {
  await page.getByRole('button', { name: /^Đặt hàng/ }).click();
  await expect(page).toHaveURL(/\/orders\/\d+$/, { timeout: 20_000 });
  return Number(page.url().match(/\/orders\/(\d+)$/)![1]);
}

// Thanh toán mô phỏng (ví điện tử, mặc định) và chờ thấy thông báo thành công.
export async function payOrder(page: Page) {
  await expect(page.getByRole('heading', { name: 'Phương thức thanh toán' })).toBeVisible();
  await page.getByRole('button', { name: /^Thanh toán/ }).click();
  await expect(page.getByRole('heading', { name: 'Đặt hàng thành công' })).toBeVisible();
}

// ---------- Nhân viên (barista) ----------

// Đăng nhập bằng tài khoản barista. Không có `next` nên được đưa thẳng vào /barista.
export async function loginAsBarista(page: Page, password = BARISTA_PASSWORD) {
  await page.goto('/login');
  await page.locator('input[type="email"]:visible').fill(BARISTA_EMAIL);
  await page.locator('input[autocomplete="current-password"]:visible').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

// Một cột trên bảng đơn tại quầy: "Chờ duyệt", "Đang pha chế", "Sẵn sàng nhận", "Đã hoàn tất".
export function column(page: Page, title: string) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: title, exact: true, level: 2 }) });
}

// Thẻ của một đơn trong cột. `exact` để "Đơn #1" không khớp nhầm "Đơn #12".
export function orderCard(page: Page, col: ReturnType<typeof column>, orderId: number) {
  return col
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: `Đơn #${orderId}`, exact: true }) });
}

// ---------- Giả lập API (để thử các lỗi khó gây ra thật) ----------

export type MockResult = { status: number; body: unknown } | 'abort';

// Chặn mọi yêu cầu có đường dẫn bắt đầu bằng `pathPrefix` và trả lời theo `respond`.
// `respond` trả về undefined thì yêu cầu đi tiếp tới server thật.
// Có xử lý CORS, vì web (cổng 3000) gọi API (cổng 3001) nên trình duyệt sẽ chặn phản hồi giả nếu thiếu.
export async function mockApi(
  page: Page,
  pathPrefix: string,
  respond: (method: string, path: string) => MockResult | undefined,
) {
  await page.route(
    (url) => url.pathname.startsWith(pathPrefix),
    async (route: Route) => {
      const req = route.request();
      const method = req.method();
      const cors = {
        'access-control-allow-origin': req.headers()['origin'] ?? '*',
        'access-control-allow-headers':
          req.headers()['access-control-request-headers'] ??
          'content-type, authorization, idempotency-key',
        'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
      };
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

      const result = respond(method, new URL(req.url()).pathname);
      if (!result) return route.continue();
      if (result === 'abort') return route.abort('failed');
      return route.fulfill({
        status: result.status,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify(result.body),
      });
    },
  );
}
