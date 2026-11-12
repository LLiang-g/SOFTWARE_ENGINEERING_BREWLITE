import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
    password: string;
}