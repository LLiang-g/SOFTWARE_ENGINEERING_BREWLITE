import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { Role } from '../generated/prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<Role[] | undefined>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (!required || required.length === 0) return true;

        const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
        if (!user || !required.includes(user.role)) {
            throw new ForbiddenException('Tài khoản này không có quyền thực hiện thao tác này');
        }
        return true;
    }
}
