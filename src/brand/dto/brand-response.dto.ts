import { BrandStatus } from '@prisma/client';

export class BrandResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  status: BrandStatus;
  createdAt: Date;
  updatedAt: Date;
}
