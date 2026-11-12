import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email: string;

    @IsString({ message: 'Mật khẩu không hợp lệ' })
    @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
    @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
    password: string;
}