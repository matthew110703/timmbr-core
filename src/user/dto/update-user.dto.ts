import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(3, { message: 'Name must be at least 3 characters' })
  @MaxLength(64, { message: 'Name must be at most 64 characters' })
  @IsOptional()
  name?: string;

  // Phone is intentionally not editable here: an unverified number would let
  // someone take over that number's OTP login. It returns as an OTP-verified flow.
}
