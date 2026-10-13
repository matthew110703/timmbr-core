export class CategoryCrumbDto {
  name!: string;
  slug!: string;
}

export class CategoryChildDto {
  name!: string;
  slug!: string;
  logoUrl!: string | null;
}

/** What a category listing page needs about its category: title, breadcrumb, subcategories. */
export class CategoryListingContextDto {
  id!: string;
  name!: string;
  slug!: string;
  description!: string | null;
  /** Root first, ending with this category. */
  breadcrumb!: CategoryCrumbDto[];
  /** Active subcategories, by name. */
  children!: CategoryChildDto[];
}
