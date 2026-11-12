import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

/** Giới hạn route cho các vai trò được liệt kê. Dùng cùng JwtAuthGuard và RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
