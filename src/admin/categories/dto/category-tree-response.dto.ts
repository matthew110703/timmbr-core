import { CategoryResponseDto } from './category-response.dto';

export class CategoryTreeResponseDto extends CategoryResponseDto {
  children?: CategoryTreeResponseDto[];
}
