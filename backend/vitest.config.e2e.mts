import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        root: './',
        include: ['test/**/*.e2e-spec.ts'],
        testTimeout: 30000,
        hookTimeout: 30000,
        fileParallelism: false,
    },
    plugins: [swc.vite({ module: { type: 'es6' } })],
});