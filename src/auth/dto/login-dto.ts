import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class LoginPayloadDto {
  /** Email or phone number. */
  @ValidateIf((o: LoginPayloadDto) => !o.email)
  @Transform(trim)
  @IsNotEmpty({ message: 'Email or phone number is required' })
  @IsString()
  @MaxLength(254)
  identifier?: string;

  /** @deprecated Kept for the Admin Console; use `identifier`. */
  @ValidateIf((o: LoginPayloadDto) => !o.identifier)
  @Transform(trim)
  @IsNotEmpty({ message: 'Email or phone number is required' })
  @IsString()
  @MaxLength(254)
  email?: string;

  // Only presence/length here: the strength policy applies when a password is
  // set, not when checking one (older passwords may predate the policy).
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MaxLength(128)
  password!: string;
}
