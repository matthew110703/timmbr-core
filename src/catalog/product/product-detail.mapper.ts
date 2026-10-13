import { AttributeScope, AttributeType, FilterDisplay } from '@prisma/client';
import { freeStock, maxLineQuantity } from '@/cart/cart.helper';
import { generateSlug } from '@/common/utils/helpers';
import { AttributeValueValidator } from '@/product/attribute/validators/attribute-value.validator';
import {
  ProductDetailResponseDto,
  ProductOptionGroupDto,
  ProductSpecDto,
  ProductStockStatus,
} from '../dto/product-detail-response.dto';
import { ProductDetailAttributeRow, ProductDetailRow } from './product-detail.repository';

/** "Only N left" shows at or below this many units. */
export const LOW_STOCK_THRESHOLD = 5;

/** Global boolean attributes shown as page flags, not as specification rows. */
const FLAG_KEYS = { fastDelivery: 'fast-delivery', clearance: 'clearance' } as const;
const FLAG_KEY_SET = new Set<string>(Object.values(FLAG_KEYS));

const toNumber = (value: unknown): number => Number(value);

export function stockStatus(available: number): ProductStockStatus {
  if (available <= 0) return 'OUT_OF_STOCK';
  return available <= LOW_STOCK_THRESHOLD ? 'LOW_STOCK' : 'IN_STOCK';
}

/** URL key of a definition: its global key, else its slugified name (product-specific ones). */
const groupKey = (definition: ProductDetailAttributeRow['definition']) =>
  definition.key ?? generateSlug(definition.name);

/** The value as shown: option labels when option-backed, else the typed value (with its unit). */
function displayValue(row: ProductDetailAttributeRow): string {
  if (row.options.length > 0) {
    return [...row.options]
      .sort((a, b) => a.option.sortOrder - b.option.sortOrder)
      .map((o) => o.option.label)
      .join(', ');
  }
  const value = AttributeValueValidator.deserialize(row.definition.type, row.value);
  const text = Array.isArray(value)
    ? value.join(', ')
    : typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : String(value);
  return row.definition.unit ? `${text} ${row.definition.unit}` : text;
}

/** One option a variant attribute stands for: its option, else a slug of its own value. */
function optionOf(row: ProductDetailAttributeRow) {
  const linked = [...row.options].sort((a, b) => a.option.sortOrder - b.option.sortOrder)[0];
  if (linked) {
    return {
      value: linked.option.slug,
      label: linked.option.label,
      swatchHex: linked.option.swatchHex ?? null,
      sortOrder: linked.option.sortOrder,
    };
  }
  const label = displayValue(row);
  const value = generateSlug(label);
  return value ? { value, label, swatchHex: null, sortOrder: Number.MAX_SAFE_INTEGER } : null;
}

const isTrue = (row: ProductDetailAttributeRow) =>
  row.definition.type === AttributeType.BOOLEAN
    ? row.value === 'true' || row.options.length > 0
    : false;

export class ProductDetailMapper {
  /**
   * The product page payload. Option groups come from VARIANT-scope attributes, ordered like the
   * listing filters (filterOrder, then name), options by their sort order then first appearance.
   * Every variant carries its value per group, so the page resolves combinations itself.
   */
  static toResponse(
    row: ProductDetailRow,
    breadcrumb: { name: string; slug: string }[],
    imageUrl: (key: string) => string,
  ): ProductDetailResponseDto {
    type Group = ProductOptionGroupDto & {
      order: number;
      seen: Map<string, { sortOrder: number; index: number }>;
    };
    const groups = new Map<string, Group>();

    const variants = row.variants.map((variant) => {
      const options: Record<string, string> = {};
      for (const attribute of variant.attributeValues) {
        if (attribute.definition.scope !== AttributeScope.VARIANT) continue;
        const option = optionOf(attribute);
        if (!option) continue;
        const key = groupKey(attribute.definition);
        let group = groups.get(key);
        if (!group) {
          group = {
            key,
            name: attribute.definition.name,
            display: attribute.definition.displayType === FilterDisplay.SWATCH ? 'SWATCH' : 'PILL',
            options: [],
            order: attribute.definition.filterOrder,
            seen: new Map(),
          };
          groups.set(key, group);
        }
        if (!group.seen.has(option.value)) {
          group.seen.set(option.value, { sortOrder: option.sortOrder, index: group.seen.size });
          group.options.push({
            value: option.value,
            label: option.label,
            swatchHex: option.swatchHex,
          });
        }
        options[key] ??= option.value;
      }

      const compareAt = variant.compareAtPrice === null ? null : toNumber(variant.compareAtPrice);
      const price = toNumber(variant.price);
      const onSale = compareAt !== null && compareAt > price;
      const free = freeStock(variant.inventory);
      return {
        id: variant.id,
        sku: variant.sku,
        price,
        compareAtPrice: onSale ? compareAt : null,
        discountPct: onSale ? Math.floor(((compareAt - price) * 100) / compareAt) : 0,
        currency: variant.currency,
        isDefault: variant.isDefault,
        options,
        stock: stockStatus(free),
        available: maxLineQuantity(variant.inventory),
      };
    });

    const optionGroups = [...groups.values()]
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(({ key, name, display, options, seen }) => ({
        key,
        name,
        display,
        options: [...options].sort((a, b) => {
          const x = seen.get(a.value)!;
          const y = seen.get(b.value)!;
          return x.sortOrder - y.sortOrder || x.index - y.index;
        }),
      }));

    const specs: ProductSpecDto[] = [];
    const flags = { fastDelivery: false, clearance: false };
    for (const attribute of row.attributeValues) {
      if (attribute.definition.scope !== AttributeScope.PRODUCT) continue;
      const key = attribute.definition.key;
      if (key && FLAG_KEY_SET.has(key)) {
        if (key === FLAG_KEYS.fastDelivery) flags.fastDelivery = isTrue(attribute);
        if (key === FLAG_KEYS.clearance) flags.clearance = isTrue(attribute);
        continue;
      }
      const value = displayValue(attribute);
      if (value) specs.push({ label: attribute.definition.name, value });
    }

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      shortDescription: row.shortDescription,
      description: row.description ?? null,
      brand:
        row.brand && row.brand.status === 'ACTIVE'
          ? { name: row.brand.name, slug: row.brand.slug }
          : null,
      breadcrumb,
      categorySlug: row.category.slug,
      images: row.images.map((image) => ({
        url: imageUrl(image.storageKey),
        alt: image.altText || row.title,
        variantId: image.variantId ?? null,
      })),
      optionGroups,
      variants,
      defaultVariantId: variants[0].id,
      specs,
      flags,
    };
  }
}
