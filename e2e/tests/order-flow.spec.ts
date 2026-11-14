import { test, expect } from '@playwright/test';

// Mỗi lần chạy dùng email mới, vì seed chỉ có tài khoản barista, không có tài khoản khách.
const email = `e2e+${Date.now()}@example.com`;
const password = 'e2e-pass-123';

test('khách đặt hàng từ menu đến trang xác nhận thanh toán thành công', async ({ page }) => {
  // 1. Menu: thấy 4 món từ seed
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hôm nay uống gì?' })).toBeVisible();
  for (const name of ['Cà phê sữa', 'Americano', 'Cappuccino', 'Trà đào']) {
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }

  // 2. Mở món, chọn size M, tăng lên 2 ly, thêm vào giỏ
  await page.getByRole('link', { name: /Cà phê sữa/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Cà phê sữa' })).toBeVisible();
  await page.getByRole('radio', { name: /^M/ }).click();
  await page.getByRole('button', { name: 'Tăng số lượng' }).click();
  await page.getByRole('button', { name: /^Thêm vào giỏ/ }).click();
  await expect(page.getByText('Đã thêm vào giỏ').filter({ visible: true })).toBeVisible();

  // 3. Giỏ hàng: kiểm tra món, áp mã giảm giá BREW10
  await page.getByRole('link', { name: 'Xem giỏ hàng' }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole('heading', { name: 'Giỏ hàng' })).toBeVisible();
  await expect(page.getByText('Size M').filter({ visible: true })).toBeVisible();
  await page.getByPlaceholder('Nhập mã giảm giá').filter({ visible: true }).fill('BREW10');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(page.getByText(/giảm 10%/).filter({ visible: true })).toBeVisible();

  // Lưu ý: Next.js giữ trang cũ ở trạng thái ẩn, nên các chỗ dễ trùng đều lọc phần tử đang hiện.
  // 4. Chưa đăng nhập nên nút là "Đăng nhập để đặt hàng" -> sang đăng ký tài khoản mới
  await page.getByRole('button', { name: /^Đăng nhập để đặt hàng/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole('main').getByRole('link', { name: 'Đăng ký' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng ký tài khoản' })).toBeVisible();
  await page.locator('input[type="email"]:visible').fill(email);
  const passwordFields = page.locator('input[autocomplete="new-password"]:visible');
  await passwordFields.nth(0).fill(password);
  await passwordFields.nth(1).fill(password);
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();

  // 5. Đăng ký xong tự quay về giỏ hàng (giỏ được giữ lại), bấm Đặt hàng
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText('Size M').filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: /^Đặt hàng/ }).click();

  // 6. Trang đơn hàng: đơn mới tạo, đang chờ thanh toán
  // Nếu đặt đơn thất bại, giỏ hàng hiện chữ đỏ trong thẻ <p role="alert">.
  // Chỉ chọn thẻ p, vì Next.js có sẵn một phần tử role="alert" rỗng để đọc thông báo chuyển trang.
  const orderUrl = /\/orders\/\d+$/;
  const cartError = page.locator('p[role="alert"]').filter({ hasText: /\S/ });
  await Promise.race([
    page.waitForURL(orderUrl, { timeout: 20_000 }),
    cartError.first().waitFor({ state: 'visible', timeout: 20_000 }),
  ]).catch(() => {});
  if (!orderUrl.test(page.url())) {
    const errors = await cartError.allInnerTexts();
    throw new Error(`Đặt hàng chưa thành công. URL: ${page.url()} | Lỗi hiện trên trang: ${JSON.stringify(errors)}`);
  }
  await expect(page.getByRole('heading', { name: 'Đơn hàng đã được tạo' })).toBeVisible();

  // 7. Thanh toán mô phỏng bằng ví điện tử (mặc định) -> xác nhận thành công
  await expect(page.getByRole('heading', { name: 'Phương thức thanh toán' })).toBeVisible();
  await page.getByRole('button', { name: /^Thanh toán/ }).click();
  await expect(page.getByRole('heading', { name: 'Đặt hàng thành công' })).toBeVisible();
});
