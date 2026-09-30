import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUUID()
  @IsNotEmpty()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
