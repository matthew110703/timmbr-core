import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { passwordRegex } from '@/auth/dto/sign-up-dto';

export class CreateAdminUserDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(3, { message: 'Name must be at least 3 characters' })
  @MaxLength(64, { message: 'Name must be at most 64 characters' })
  name!: string;

  @Transform(({ value }) => (value as string)?.toLowerCase())
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @Matches(passwordRegex, {
    message:
      'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character',
  })
  password!: string;
}
