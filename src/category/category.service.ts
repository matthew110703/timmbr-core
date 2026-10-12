import { Injectable } from '@nestjs/common';
import { CategoryStatus, Prisma } from '@prisma/client';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';
import { PaginatedResult } from '@/common/types/api-response.types';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoryTreeResponseDto } from './dto/category-tree-response.dto';
import { CategoryMapper } from './category.mapper';
import { CreateCategoryDto } from './dto/create-category.dto';
import {
  CategoryAlreadyExistsException,
  CategoryHasChildrenException,
  CategoryNotFoundException,
  CategorySelfReferentialException,
} from '@/common/exceptions/category.exception';
import { generateSlug } from '@/common/utils/helpers';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryRepository } from './category.repository';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async getCategoryTree(
    rootParentId?: string,
    onlyActive = false,
    maxDepth?: number,
  ): Promise<CategoryTreeResponseDto[]> {
    if (rootParentId) {
      const parentCategory = await this.categoryRepository.findById(rootParentId);

      if (!parentCategory) {
        throw new CategoryNotFoundException();
      }

      if (onlyActive && parentCategory.status !== CategoryStatus.ACTIVE) {
        throw new CategoryNotFoundException();
      }
    }

    const allCategories = await this.categoryRepository.findAllSortedByName();

    // Group once by parent (keeps the repository's name order), so the walk is O(n).
    const childrenOf = new Map<string | null, typeof allCategories>();
    for (const cat of allCategories) {
      if (onlyActive && cat.status !== CategoryStatus.ACTIVE) continue;
      const siblings = childrenOf.get(cat.parentId);
      if (siblings) siblings.push(cat);
      else childrenOf.set(cat.parentId, [cat]);
    }

    // `level` is 1 for the first level returned; past `maxDepth`, children are
    // empty. `visited` stops a corrupt parent cycle from recursing forever.
    const visited = new Set<string>();
    const buildTree = (parentId: string | null, level: number): CategoryTreeResponseDto[] =>
      (childrenOf.get(parentId) ?? [])
        .filter((cat) => !visited.has(cat.id))
        .map((cat) => {
          visited.add(cat.id);
          return {
            ...CategoryMapper.toResponse(cat),
            children: maxDepth && level >= maxDepth ? [] : buildTree(cat.id, level + 1),
          };
        });

    return buildTree(rootParentId ?? null, 1);
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
    onlyActive = false,
  ): Promise<PaginatedResult<CategoryResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.CategoryWhereInput = {
      ...(onlyActive
        ? { status: CategoryStatus.ACTIVE }
        : query.status && { status: query.status }),
      ...(query.parentId && { parentId: query.parentId }),
      ...(query.categoryIds?.length && { id: { in: query.categoryIds } }),
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
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

  async getCategoryById(catId: string, onlyActive = false): Promise<CategoryResponseDto> {
    const category = await this.categoryRepository.findByIdWithParent(catId);

    if (!category) {
      throw new CategoryNotFoundException();
    }

    if (onlyActive && category.status !== CategoryStatus.ACTIVE) {
      throw new CategoryNotFoundException();
    }

    return CategoryMapper.toResponseWithParent(category, category.parent);
  }

  async delete(catId: string, force = false): Promise<CategoryResponseDto> {
    const existingCategory = await this.categoryRepository.findById(catId);

    if (!existingCategory) {
      throw new CategoryNotFoundException();
    }

    const childrenCount = await this.categoryRepository.countChildren(catId);

    if (childrenCount > 0) {
      if (!force) {
        throw new CategoryHasChildrenException();
      }
      const deletedCategory = await this.categoryRepository.deleteTree(catId);
      return CategoryMapper.toResponse(deletedCategory);
    }

    const category = await this.categoryRepository.delete(catId);
    return CategoryMapper.toResponse(category);
  }
}
