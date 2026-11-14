import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  column,
  errorBox,
  loginAsBarista,
  mockApi,
  orderCard,
  payOrder,
  placeOrder,
  prepareCartAsNewCustomer,
  registerNewCustomer,
} from './helpers';

// ---------- Luồng chính: khách đặt và trả tiền, nhân viên xử lý từ đầu đến cuối ----------

test('nhân viên xử lý đơn từ Chờ duyệt đến Đã hoàn tất, khách thấy đơn hoàn tất', async ({ page, browser }) => {
  test.setTimeout(90_000);

  // Khách: đặt và thanh toán một đơn (dùng `page` của test)
  await prepareCartAsNewCustomer(page);
  const orderId = await placeOrder(page);
  await payOrder(page);

  // Nhân viên: dùng trình duyệt riêng, vì hai người đăng nhập hai tài khoản khác nhau
  const baristaContext = await browser.newContext({ baseURL: BASE_URL });
  try {
    const bp = await baristaContext.newPage();
    await loginAsBarista(bp);
    await expect(bp).toHaveURL(/\/barista/);
    await expect(bp.getByRole('heading', { name: 'Đơn hàng tại quầy' })).toBeVisible();

    // 1. Đơn xuất hiện ở cột "Chờ duyệt" với đúng món
    const pending = orderCard(bp, column(bp, 'Chờ duyệt'), orderId);
    await expect(pending).toBeVisible({ timeout: 20_000 });
    await expect(pending).toContainText('Cà phê sữa × 1');
    await expect(pending).toContainText('Size S');
    await pending.getByRole('button', { name: 'Duyệt đơn' }).click();

    // 2. Sang "Đang pha chế"
    const preparing = orderCard(bp, column(bp, 'Đang pha chế'), orderId);
    await expect(preparing).toBeVisible({ timeout: 20_000 });
    await preparing.getByRole('button', { name: 'Pha xong' }).click();

    // 3. Sang "Sẵn sàng nhận"
    const ready = orderCard(bp, column(bp, 'Sẵn sàng nhận'), orderId);
    await expect(ready).toBeVisible({ timeout: 20_000 });
    await ready.getByRole('button', { name: 'Đã giao khách' }).click();

    // 4. Sang "Đã hoàn tất", không còn nút thao tác nào
    const completed = orderCard(bp, column(bp, 'Đã hoàn tất'), orderId);
    await expect(completed).toBeVisible({ timeout: 20_000 });
    await expect(completed.getByRole('button')).toHaveCount(0);
  } finally {
    await baristaContext.close();
  }

  // Khách tải lại trang đơn và thấy đơn đã hoàn tất
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đơn hàng đã hoàn tất' })).toBeVisible();
});

// ---------- Phân quyền và đăng nhập ----------

test('chưa đăng nhập vào quầy thì bị chuyển sang trang đăng nhập', async ({ page }) => {
  await page.goto('/barista');
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)barista/);
});

test('tài khoản khách thường vào quầy thì bị báo không có quyền', async ({ page }) => {
  await registerNewCustomer(page, '/barista');
  await expect(page).toHaveURL(/\/barista/);
  await expect(
    page.getByRole('heading', { name: 'Tài khoản này không có quyền vào quầy' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Về trang khách hàng' })).toBeVisible();

  // Không hiện bảng đơn của nhân viên
  await expect(page.getByRole('heading', { name: 'Đơn hàng tại quầy' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Đăng nhập tài khoản khác' }).click();
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)barista/);
});

test('đăng nhập barista sai mật khẩu thì hiện lỗi và ở lại trang đăng nhập', async ({ page }) => {
  await loginAsBarista(page, 'mat-khau-sai-123');
  await expect(errorBox(page)).toContainText('Email hoặc mật khẩu không đúng');
  await expect(page).toHaveURL(/\/login/);
});

// ---------- Lỗi trên bảng đơn (giả lập phản hồi từ server) ----------

test('không tải được danh sách đơn (lỗi 500): hiện thông báo tải lại', async ({ page }) => {
  await mockApi(page, '/staff/orders', (method) =>
    method === 'GET'
      ? { status: 500, body: { statusCode: 500, message: 'Internal server error' } }
      : undefined,
  );
  await loginAsBarista(page);
  await expect(errorBox(page)).toContainText('Không tải được đơn hàng');
  await expect(page.getByText('Chưa có đơn trong cột này.')).toHaveCount(0);
});

test('tài khoản không đủ quyền barista (lỗi 403): hiện thông báo không có quyền', async ({ page }) => {
  await mockApi(page, '/staff/orders', (method) =>
    method === 'GET'
      ? { status: 403, body: { statusCode: 403, message: 'Forbidden resource' } }
      : undefined,
  );
  await loginAsBarista(page);
  await expect(errorBox(page)).toContainText('Tài khoản này không có quyền barista');
});

test('duyệt đơn bị xung đột trạng thái (lỗi 409): hiện thông báo và đơn không bị chuyển cột', async ({ page }) => {
  // Một đơn giả ở trạng thái đã thanh toán, để có nút "Duyệt đơn" mà không cần tạo đơn thật
  const fakeOrder = {
    id: 999999,
    status: 'PAID',
    total: 70000,
    discount: 0,
    amountDue: 0,
    creditApplied: 0,
    createdAt: new Date().toISOString(),
    voucherCode: null,
    pointsEarned: 0,
    reservationExpiresAt: null,
    reservationExpiredAt: null,
    reservationTimedOut: false,
    expiryMessage: null,
    pendingExchangeId: null,
    items: [
      {
        id: 1,
        productId: 1,
        name: 'Cà phê sữa',
        size: 'M',
        toppings: [],
        toppingNames: [],
        qty: 2,
        lineTotal: 70000,
      },
    ],
  };
  const conflictMessage = 'Đơn hàng vừa được cập nhật bởi người khác, hãy tải lại.';

  await mockApi(page, '/staff/orders', (method) => {
    if (method === 'GET') return { status: 200, body: [fakeOrder] };
    if (method === 'PATCH') return { status: 409, body: { statusCode: 409, message: conflictMessage } };
    return undefined;
  });
  await loginAsBarista(page);

  const pending = orderCard(page, column(page, 'Chờ duyệt'), fakeOrder.id);
  await expect(pending).toBeVisible({ timeout: 20_000 });
  await pending.getByRole('button', { name: 'Duyệt đơn' }).click();

  await expect(errorBox(page)).toContainText(conflictMessage);
  // Đơn vẫn nằm ở "Chờ duyệt", nút bấm lại được
  await expect(orderCard(page, column(page, 'Chờ duyệt'), fakeOrder.id)).toBeVisible();
  await expect(pending.getByRole('button', { name: 'Duyệt đơn' })).toBeEnabled();
});
