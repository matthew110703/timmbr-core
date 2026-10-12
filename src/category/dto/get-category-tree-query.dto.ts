import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetCategoryTreeQueryDto {
  /** Levels to include below the starting point (1 = roots only). Omit for the whole tree. */
  @Type(() => Number)
  @IsInt({ message: 'Depth must be an integer' })
  @Min(1, { message: 'Depth must be at least 1' })
  @Max(5, { message: 'Depth must be at most 5' })
  @IsOptional()
  depth?: number;
}
