import { Category } from '@prisma/client';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoryTreeResponseDto } from './dto/category-tree-response.dto';

export type CategoryWithChildren = Category & {
  children?: CategoryWithChildren[];
};

export class CategoryMapper {
  static toResponse(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      status: category.status,
      description: category.description!,
      logoUrl: category.logoUrl!,
      parentId: category.parentId!,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  static toResponseWithParent(category: Category, parent: Category | null) {
    return {
      ...this.toResponse(category),
      parent: parent ? this.toResponse(parent) : null,
    };
  }

  static toTreeResponse(category: CategoryWithChildren): CategoryTreeResponseDto {
    return {
      ...this.toResponse(category),
      children: category.children
        ? category.children.map((child) => this.toTreeResponse(child))
        : [],
    };
  }

  static toCreateResponse(category: Category): CategoryResponseDto {
    return this.toResponse(category);
  }

  static toUpdateResponse(category: Category): CategoryResponseDto {
    return this.toResponse(category);
  }
}
