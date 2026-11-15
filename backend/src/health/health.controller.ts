import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// GET /health dùng cho healthcheck của Docker và smoke test sau khi deploy.
// Trả 200 khi API sống và kết nối được database, 503 khi database không trả lời.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    return {
      status: 'ok',
      database: 'up',
      commit: process.env.RELEASE_COMMIT ?? 'dev',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
