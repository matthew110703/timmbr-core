import { CategoryStatus } from '@prisma/client';

export class CategoryResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  logoUrl?: string;
  description?: string;
  parentId?: string;
  status!: CategoryStatus;
  createdAt!: Date;
  updatedAt!: Date;
}
