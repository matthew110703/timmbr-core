import { SectionItemPayload } from './section-item.dto';

export class PageResponseDto {
  id!: string;
  slug!: string;
  title!: string;
  description!: string | null;
  isActive!: boolean;
  sections!: SectionItemPayload[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class PageListItemResponseDto {
  id!: string;
  slug!: string;
  title!: string;
  description!: string | null;
  isActive!: boolean;
  sectionCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
