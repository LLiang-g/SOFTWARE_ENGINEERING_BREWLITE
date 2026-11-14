import { test, expect, type Page } from '@playwright/test';

// ---------- Hàm dùng chung ----------

// Thêm 1 ly Cà phê sữa (id 1 trong seed) vào giỏ rồi đăng ký tài khoản mới, kết thúc ở trang /cart.
async function prepareCartAsNewCustomer(page: Page) {
  await page.goto('/products/1');
  await page.getByRole('button', { name: /^Thêm vào giỏ/ }).click();
  await expect(page.getByText('Đã thêm vào giỏ').filter({ visible: true })).toBeVisible();

  // Giỏ hàng được lưu trong trình duyệt nên vẫn còn sau khi tải lại trang
  const email = `e2e+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto('/register?next=%2Fcart');
  await page.locator('input[type="email"]:visible').fill(email);
  const passwords = page.locator('input[autocomplete="new-password"]:visible');
  await passwords.nth(0).fill('e2e-pass-123');
  await passwords.nth(1).fill('e2e-pass-123');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();

  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText('Size S').filter({ visible: true })).toBeVisible();
}

// Bấm Đặt hàng và chờ sang trang đơn hàng.
async function placeOrder(page: Page) {
  await page.getByRole('button', { name: /^Đặt hàng/ }).click();
  await expect(page).toHaveURL(/\/orders\/\d+$/, { timeout: 20_000 });
}

// Khung báo lỗi có chữ. Chỉ chọn thẻ <p role="alert">, vì Next.js có sẵn một phần tử
// role="alert" rỗng dùng để đọc thông báo chuyển trang.
function errorBox(page: Page) {
  return page.locator('p[role="alert"]').filter({ hasText: /\S/ });
}

// Giả lập backend trả lỗi cho yêu cầu tạo đơn (POST /orders).
// Phải thêm header CORS, nếu không trình duyệt sẽ chặn phản hồi giả vì web (3000) gọi API (3001).
async function mockCreateOrder(
  page: Page,
  mode: { status: number; body: object } | 'network-down',
) {
  await page.route('**/orders', async (route) => {
    const req = route.request();
    const cors = {
      'access-control-allow-origin': req.headers()['origin'] ?? '*',
      'access-control-allow-headers':
        req.headers()['access-control-request-headers'] ?? 'content-type, authorization, idempotency-key',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (req.method() !== 'POST') return route.continue();
    if (mode === 'network-down') return route.abort('failed');
    return route.fulfill({
      status: mode.status,
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify(mode.body),
    });
  });
}

// ---------- Giỏ hàng ----------

test('giỏ hàng trống hiện thông báo và có nút quay lại chọn món', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Giỏ hàng đang trống' })).toBeVisible();
  await page.getByRole('link', { name: 'Chọn món' }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});

test('mã giảm giá không tồn tại hiện lỗi và không giảm giá', async ({ page }) => {
  await prepareCartAsNewCustomer(page);
  await page.getByPlaceholder('Nhập mã giảm giá').filter({ visible: true }).fill('KHONGCOMA');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(errorBox(page)).toContainText('Mã giảm giá không tồn tại');
  await expect(page.getByText(/giảm \d+%/)).toHaveCount(0);
});

// ---------- Đặt hàng gặp lỗi (giả lập phản hồi từ server) ----------

test('mất kết nối server khi đặt hàng: báo chưa xác nhận kết quả và cho kiểm tra lịch sử', async ({ page }) => {
  await prepareCartAsNewCustomer(page);
  await mockCreateOrder(page, 'network-down');
  await page.getByRole('button', { name: /^Đặt hàng/ }).click();

  await expect(errorBox(page)).toContainText('Chưa xác nhận được kết quả đặt hàng');
  await expect(page.getByRole('link', { name: 'Kiểm tra lịch sử đơn' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bắt đầu lần đặt mới' })).toBeVisible();
  await expect(page).toHaveURL(/\/cart$/);
});

test('hết phiên đăng nhập (401) khi đặt hàng: bị đưa về trang đăng nhập', async ({ page }) => {
  await prepareCartAsNewCustomer(page);
  await mockCreateOrder(page, { status: 401, body: { statusCode: 401, message: 'Unauthorized' } });
  await page.getByRole('button', { name: /^Đặt hàng/ }).click();

  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});

test('server lỗi 500 khi đặt hàng: hiện lỗi, không bị treo, thử lại được', async ({ page }) => {
  await prepareCartAsNewCustomer(page);
  await mockCreateOrder(page, {
    status: 500,
    body: { statusCode: 500, message: 'Internal server error' },
  });
  await page.getByRole('button', { name: /^Đặt hàng/ }).click();

  await expect(errorBox(page)).toContainText('Internal server error');
  await expect(page).toHaveURL(/\/cart$/);
  // Nút Đặt hàng phải bấm lại được, không bị khóa mãi
  await expect(page.getByRole('button', { name: /^Đặt hàng/ })).toBeEnabled();

  // Server hồi phục: bỏ giả lập và thử lại thì đặt được đơn
  await page.unroute('**/orders');
  await placeOrder(page);
  await expect(page.getByRole('heading', { name: 'Đơn hàng đã được tạo' })).toBeVisible();
});

// ---------- Trang đơn hàng và thanh toán ----------

test('không tải được phương thức thanh toán: hiện lỗi và yêu cầu tải lại trang', async ({ page }) => {
  await prepareCartAsNewCustomer(page);
  await page.route('**/payments/vnpay/config', (route) => route.abort('failed'));
  await placeOrder(page);

  await expect(errorBox(page)).toContainText('Không tải được phương thức thanh toán');
  await expect(page.getByRole('button', { name: /^Thanh toán/ })).toHaveCount(0);
});

test('thanh toán thất bại: đơn được giữ lại và thanh toán lại thành công', async ({ page }) => {
  await prepareCartAsNewCustomer(page);
  await placeOrder(page);
  await expect(page.getByRole('heading', { name: 'Phương thức thanh toán' })).toBeVisible();

  // Lần 1: bật "giả lập thanh toán lỗi"
  await page.getByRole('checkbox', { name: /Giả lập thanh toán lỗi/ }).check();
  await page.getByRole('button', { name: /^Thanh toán/ }).click();
  await expect(page.getByRole('heading', { name: 'Thanh toán thất bại' })).toBeVisible();

  // Đơn vẫn còn, vẫn thanh toán được. Tắt giả lập lỗi (nếu ô vẫn đang được tick) rồi thử lại.
  const simulate = page.getByRole('checkbox', { name: /Giả lập thanh toán lỗi/ });
  if (await simulate.isChecked()) await simulate.uncheck();
  await page.getByRole('button', { name: /^Thanh toán/ }).click();
  await expect(page.getByRole('heading', { name: 'Đặt hàng thành công' })).toBeVisible();
});

test('hủy đơn chưa thanh toán: đơn chuyển sang đã hủy', async ({ page }) => {
  await prepareCartAsNewCustomer(page);
  await placeOrder(page);
  await expect(page.getByRole('heading', { name: 'Đơn hàng đã được tạo' })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept()); // hộp thoại "Bạn chắc chắn muốn hủy đơn này?"
  await page.getByRole('button', { name: 'Hủy đơn' }).click();
  await expect(page.getByRole('heading', { name: 'Đơn hàng đã hủy' })).toBeVisible();
});
