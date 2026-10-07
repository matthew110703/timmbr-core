import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { OTP_LENGTH, type OtpIntent } from '../auth.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SendOtpDto {
  @Transform(trim)
  @IsNotEmpty({ message: 'Email or phone number is required' })
  @IsString({ message: 'Identifier must be a string' })
  @MaxLength(254)
  identifier!: string;
}

export class VerifyOtpDto extends SendOtpDto {
  @Transform(trim)
  @Matches(new RegExp(`^\\d{${OTP_LENGTH}}$`), {
    message: `Code must be ${OTP_LENGTH} digits`,
  })
  code!: string;

  /** `reset` also issues a password-setup token for an account that has a password. */
  @IsOptional()
  @IsIn(['login', 'reset'])
  intent?: OtpIntent;
}

export class OAuthExchangeDto {
  @IsNotEmpty({ message: 'Code is required' })
  @IsString()
  @MaxLength(128)
  code!: string;

  /** The storefront's binding nonce (its sha256 was sent when sign-in started). */
  @IsNotEmpty({ message: 'Bind is required' })
  @IsString()
  @MaxLength(128)
  bind!: string;
}
