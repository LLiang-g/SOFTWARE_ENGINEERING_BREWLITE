import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client';

export type AuthUser = { id: number; email: string; role: Role };

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthUser => {
        const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
        return request.user;
    },
);