import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { OrderItemInputDto } from './create-order.dto';

export class CheckoutQuoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @IsUUID()
  @IsNotEmpty()
  shippingAddressId!: string;
}
