import { Injectable } from '@nestjs/common';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';
import { PaginatedResult } from '@/common/types/api-response.types';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoryTreeResponseDto } from './dto/category-tree-response.dto';
import { Prisma } from '@prisma/client';
import { CategoryMapper } from './category.mapper';
import { CreateCategoryDto } from './dto/create-category.dto';
import {
  CategoryAlreadyExistsException,
  CategoryNotFoundException,
  CategorySelfReferentialException,
} from '@/common/exceptions/category.exception';
import { generateSlug } from '@/common/utils/helpers';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryRepository } from './category.repository';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async getCategoryTree(rootParentId?: string): Promise<CategoryTreeResponseDto[]> {
    if (rootParentId) {
      const parentCategory = await this.categoryRepository.findById(rootParentId);

      if (!parentCategory) {
        throw new CategoryNotFoundException();
      }
    }

    const allCategories = await this.categoryRepository.findAllSortedByName();

    const buildTree = (parentId: string | null): CategoryTreeResponseDto[] => {
      return allCategories
        .filter((cat) => cat.parentId === parentId)
        .map((cat) => ({
          ...CategoryMapper.toResponse(cat),
          children: buildTree(cat.id),
        }));
    };

    return buildTree(rootParentId ?? null);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const existingCategory = await this.categoryRepository.findFirst({
      name: dto.name,
      ...(dto.parentId && { parentId: dto.parentId }),
    });

    if (existingCategory) {
      throw new CategoryAlreadyExistsException(!!dto.parentId);
    }

    const slug = generateSlug(dto.name);

    const category = await this.categoryRepository.create({
      name: dto.name,
      description: dto.description,
      logoUrl: dto.logoUrl,
      status: dto.status,
      parentId: dto.parentId,
      slug: slug,
    });

    return CategoryMapper.toCreateResponse(category);
  }

  async update(catId: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const existingCategory = await this.categoryRepository.findById(catId);

    if (!existingCategory) {
      throw new CategoryNotFoundException();
    }

    const targetParentId = dto.parentId !== undefined ? dto.parentId : existingCategory.parentId;
    const targetName = dto.name ?? existingCategory.name;

    if (targetParentId === catId) {
      throw new CategorySelfReferentialException();
    }

    const isNameChanged = dto.name !== undefined && dto.name !== existingCategory.name;
    const isParentChanged =
      dto.parentId !== undefined && dto.parentId !== existingCategory.parentId;

    if (isNameChanged || isParentChanged) {
      const duplicate = await this.categoryRepository.findFirst({
        id: { not: catId },
        name: targetName,
        parentId: targetParentId,
      });

      if (duplicate) {
        throw new CategoryAlreadyExistsException(!!targetParentId);
      }
    }

    const category = await this.categoryRepository.update(catId, {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      ...(dto.status && { status: dto.status }),
      ...(dto.parentId !== undefined && { parentId: dto.parentId }),
    });

    return CategoryMapper.toUpdateResponse(category);
  }

  async getAllCategories(
    query: GetCategoriesQueryDto,
  ): Promise<PaginatedResult<CategoryResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.CategoryWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.parentId && { parentId: query.parentId }),
    };

    const [categories, total] = await this.categoryRepository.findPaginated(where, page, limit);

    const totalPages = Math.ceil(total / limit);

    return {
      data: categories.map((category) => CategoryMapper.toResponse(category)),
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

  async getCategoryById(catId: string): Promise<CategoryResponseDto> {
    const category = await this.categoryRepository.findByIdWithParent(catId);

    if (!category) {
      throw new CategoryNotFoundException();
    }

    return CategoryMapper.toResponseWithParent(category, category.parent);
  }

  async delete(catId: string): Promise<CategoryResponseDto> {
    const existingCategory = await this.categoryRepository.findById(catId);

    if (!existingCategory) {
      throw new CategoryNotFoundException();
    }

    const category = await this.categoryRepository.delete(catId);

    return CategoryMapper.toResponse(category);
  }
}
