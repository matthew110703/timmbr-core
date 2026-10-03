import { Injectable } from '@nestjs/common';
import { BrandStatus, Prisma } from '@prisma/client';
import { BrandRepository } from './brand.repository';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { GetBrandsQueryDto } from './dto/get-brands-query.dto';
import { BrandResponseDto } from './dto/brand-response.dto';
import { BrandMapper } from './brand.mapper';
import {
  BrandAlreadyExistsException,
  BrandNotFoundException,
} from '@/common/exceptions/brand.exception';
import { generateSlug } from '@/common/utils/helpers';
import { PaginatedResult } from '@/common/types/api-response.types';

@Injectable()
export class BrandService {
  constructor(private readonly brandRepository: BrandRepository) {}

  async create(dto: CreateBrandDto): Promise<BrandResponseDto> {
    const existingBrand = await this.brandRepository.findFirst({
      name: { equals: dto.name, mode: 'insensitive' },
    });

    if (existingBrand) {
      throw new BrandAlreadyExistsException();
    }

    const slug = generateSlug(dto.name);

    const brand = await this.brandRepository.create({
      name: dto.name,
      slug,
      description: dto.description,
      logoUrl: dto.logoUrl,
      status: dto.status,
    });

    return BrandMapper.toResponse(brand);
  }

  async update(brandId: string, dto: UpdateBrandDto): Promise<BrandResponseDto> {
    const existingBrand = await this.brandRepository.findById(brandId);

    if (!existingBrand) {
      throw new BrandNotFoundException();
    }

    if (dto.name !== undefined && dto.name.toLowerCase() !== existingBrand.name.toLowerCase()) {
      const duplicate = await this.brandRepository.findFirst({
        id: { not: brandId },
        name: { equals: dto.name, mode: 'insensitive' },
      });

      if (duplicate) {
        throw new BrandAlreadyExistsException();
      }
    }

    const brand = await this.brandRepository.update(brandId, {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      ...(dto.status && { status: dto.status }),
    });

    return BrandMapper.toResponse(brand);
  }

  async getAllBrands(
    query: GetBrandsQueryDto,
    onlyActive = false,
  ): Promise<PaginatedResult<BrandResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.BrandWhereInput = {
      ...(onlyActive ? { status: BrandStatus.ACTIVE } : query.status && { status: query.status }),
      ...(query.brandIds?.length && { id: { in: query.brandIds } }),
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
    };

    const [brands, total] = await this.brandRepository.findPaginated(where, page, limit);

    const totalPages = Math.ceil(total / limit);

    return {
      data: brands.map((brand) => BrandMapper.toResponse(brand)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getBrandById(brandId: string, onlyActive = false): Promise<BrandResponseDto> {
    const brand = await this.brandRepository.findById(brandId);

    if (!brand) {
      throw new BrandNotFoundException();
    }

    if (onlyActive && brand.status !== BrandStatus.ACTIVE) {
      throw new BrandNotFoundException();
    }

    return BrandMapper.toResponse(brand);
  }

  async delete(brandId: string): Promise<BrandResponseDto> {
    const existingBrand = await this.brandRepository.findById(brandId);

    if (!existingBrand) {
      throw new BrandNotFoundException();
    }

    const brand = await this.brandRepository.delete(brandId);

    return BrandMapper.toResponse(brand);
  }
}
