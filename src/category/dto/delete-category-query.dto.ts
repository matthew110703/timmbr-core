import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class DeleteCategoryQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  force?: boolean;
}
