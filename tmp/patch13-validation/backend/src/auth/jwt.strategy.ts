import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { getJwtSecret } from './jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly users: UsersService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: getJwtSecret(),
        });
    }

    async validate(payload: { sub: number; email: string }) {
        const user = await this.users.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException();
        }
        // Vai trò lấy từ database mỗi lần gọi API, nên đổi quyền có hiệu lực ngay.
        return { id: user.id, email: user.email, role: user.role };
    }
}