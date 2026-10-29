import {
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

type PublicUser = { id: number; email: string; loyaltyPoints: number };

@Injectable()
export class AuthService {
    constructor(
        private readonly users: UsersService,
        private readonly jwt: JwtService,
    ) {}

    async register(dto: RegisterDto) {
        const email = dto.email.trim().toLowerCase();

        if (await this.users.findByEmail(email)) {
            throw new ConflictException('Email đã được đăng ký');
        }

        const passwordHash = await hash(dto.password, 10);
        const user = await this.users.create(email, passwordHash);
        return this.buildResponse(user);
    }

    async login(dto: LoginDto) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.users.findByEmail(email);

        const valid = user ? await compare(dto.password, user.passwordHash) : false;
        if (!user || !valid) {
            throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
        }

        return this.buildResponse({
            id: user.id,
            email: user.email,
            loyaltyPoints: user.loyaltyPoints,
        });
    }

    private async buildResponse(user: PublicUser) {
        const accessToken = await this.jwt.signAsync({
            sub: user.id,
            email: user.email,
        });
        return { accessToken, user };
    }
}