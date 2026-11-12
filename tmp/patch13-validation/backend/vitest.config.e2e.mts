import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        root: './',
        include: ['test/**/*.e2e-spec.ts'],
        testTimeout: 30000,
        hookTimeout: 30000,
        fileParallelism: false,

        // Test cũ dùng mock; file VNPay chủ động stubEnv và giả lập gateway riêng.
        env: { ORDER_EXPIRY_WORKER_ENABLED: 'false', VNPAY_ENABLED: 'false', PAYMENT_MOCK_ENABLED: 'true' },
    },
    plugins: [swc.vite({ module: { type: 'es6' } })],
});