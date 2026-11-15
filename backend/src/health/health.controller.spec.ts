import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

function controllerWith(queryRaw: () => Promise<unknown>) {
  return new HealthController({ $queryRaw: queryRaw } as never);
}

describe('HealthController', () => {
  it('trả status ok khi database trả lời', async () => {
    const result = await controllerWith(vi.fn().mockResolvedValue([{ ok: 1 }])).check();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
  });

  it('trả 503 khi database không trả lời', async () => {
    const controller = controllerWith(vi.fn().mockRejectedValue(new Error('connection refused')));
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
