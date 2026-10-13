import { AttributeScope, AttributeType, FilterDisplay } from '@prisma/client';
import { ProductDetailMapper, stockStatus } from './product-detail.mapper';
import { ProductDetailRow } from './product-detail.repository';

type Definition = ProductDetailRow['attributeValues'][number]['definition'];

const definition = (overrides: Partial<Definition>): Definition => ({
  id: 'def',
  key: null,
  name: 'Name',
  type: AttributeType.STRING,
  unit: null,
  scope: AttributeScope.PRODUCT,
  displayType: FilterDisplay.CHECKBOX,
  filterOrder: 0,
  ...overrides,
});

const finish = definition({
  id: 'd-finish',
  key: 'finish',
  name: 'Finish',
  scope: AttributeScope.VARIANT,
  displayType: FilterDisplay.SWATCH,
  filterOrder: 6,
});
const upholstery = definition({
  id: 'd-uph',
  name: 'Upholstery',
  scope: AttributeScope.VARIANT,
  filterOrder: 0,
});

const option = (
  slug: string,
  label: string,
  sortOrder: number,
  swatchHex: string | null = null,
) => ({
  option: { slug, label, sortOrder, swatchHex },
});

const variant = (
  id: string,
  attributeValues: ProductDetailRow['variants'][number]['attributeValues'],
  // Plain numbers stand in for Prisma Decimals (the mapper converts with Number()).
  overrides: Record<string, unknown> = {},
): ProductDetailRow['variants'][number] =>
  ({
    id,
    sku: id.toUpperCase(),
    price: 10000,
    compareAtPrice: null,
    currency: 'INR',
    isDefault: false,
    inventory: { quantity: 20, reservedQuantity: 0 },
    attributeValues,
    ...overrides,
  }) as unknown as ProductDetailRow['variants'][number];

const product = (overrides: Partial<ProductDetailRow> = {}): ProductDetailRow =>
  ({
    id: 'p1',
    slug: 'koto-chair',
    title: 'Koto Chair',
    shortDescription: 'A chair.',
    description: null,
    brand: { name: 'Oakline', slug: 'oakline', status: 'ACTIVE' },
    category: { slug: 'chairs' },
    images: [
      { storageKey: 'a.jpg', altText: null, variantId: null },
      { storageKey: 'b.jpg', altText: 'Walnut', variantId: 'v2' },
    ],
    attributeValues: [],
    variants: [],
    ...overrides,
  }) as ProductDetailRow;

const map = (row: ProductDetailRow) =>
  ProductDetailMapper.toResponse(
    row,
    [{ name: 'Chairs', slug: 'chairs' }],
    (key) => `https://cdn/${key}`,
  );

describe('ProductDetailMapper', () => {
  it('groups variant options, ordered like the filters, options by sort order', () => {
    const result = map(
      product({
        variants: [
          variant(
            'v1',
            [
              {
                value: 'walnut',
                definition: finish,
                options: [option('walnut', 'Walnut', 2, '#5a3b2a')],
              },
              { value: 'Velvet', definition: upholstery, options: [] },
            ],
            { isDefault: true },
          ),
          variant('v2', [
            {
              value: 'honey',
              definition: finish,
              options: [option('honey', 'Honey', 1, '#b5753a')],
            },
            { value: 'Bouclé', definition: upholstery, options: [] },
          ]),
        ],
      }),
    );

    expect(result.optionGroups).toEqual([
      {
        key: 'upholstery',
        name: 'Upholstery',
        display: 'PILL',
        options: [
          { value: 'velvet', label: 'Velvet', swatchHex: null },
          { value: 'boucle', label: 'Bouclé', swatchHex: null },
        ],
      },
      {
        key: 'finish',
        name: 'Finish',
        display: 'SWATCH',
        options: [
          { value: 'honey', label: 'Honey', swatchHex: '#b5753a' },
          { value: 'walnut', label: 'Walnut', swatchHex: '#5a3b2a' },
        ],
      },
    ]);
    expect(result.variants.map((v) => v.options)).toEqual([
      { finish: 'walnut', upholstery: 'velvet' },
      { finish: 'honey', upholstery: 'boucle' },
    ]);
    expect(result.defaultVariantId).toBe('v1');
  });

  it('prices, discounts and stock per variant (capped at the cart limit)', () => {
    const [onSale, low, out] = map(
      product({
        variants: [
          variant('v1', [], {
            price: 7500,
            compareAtPrice: 10000,
            inventory: { quantity: 40, reservedQuantity: 0 },
          }),
          variant('v2', [], {
            compareAtPrice: 9000,
            inventory: { quantity: 5, reservedQuantity: 2 },
          }),
          variant('v3', [], { inventory: null }),
        ],
      }),
    ).variants;

    expect(onSale).toMatchObject({
      price: 7500,
      compareAtPrice: 10000,
      discountPct: 25,
      stock: 'IN_STOCK',
      available: 10,
    });
    // A compare-at below the price is not a sale.
    expect(low).toMatchObject({
      compareAtPrice: null,
      discountPct: 0,
      stock: 'LOW_STOCK',
      available: 3,
    });
    expect(out).toMatchObject({ stock: 'OUT_OF_STOCK', available: 0 });
  });

  it('lists product attributes as specs and lifts the boolean flags out', () => {
    const result = map(
      product({
        attributeValues: [
          {
            value: 'teak',
            definition: definition({ key: 'material', name: 'Material' }),
            options: [option('teak', 'Teak Wood', 0)],
          },
          {
            value: '150',
            definition: definition({
              name: 'Weight capacity',
              type: AttributeType.INTEGER,
              unit: 'kg',
            }),
            options: [],
          },
          {
            value: '["Seat","Back"]',
            definition: definition({ name: 'Cushions', type: AttributeType.LIST }),
            options: [],
          },
          {
            value: 'true',
            definition: definition({
              key: 'fast-delivery',
              name: 'Fast Delivery',
              type: AttributeType.BOOLEAN,
            }),
            options: [option('yes', 'Yes', 0)],
          },
        ],
        variants: [variant('v1', [])],
      }),
    );

    expect(result.specs).toEqual([
      { label: 'Material', value: 'Teak Wood' },
      { label: 'Weight capacity', value: '150 kg' },
      { label: 'Cushions', value: 'Seat, Back' },
    ]);
    expect(result.flags).toEqual({ fastDelivery: true, clearance: false });
  });

  it('maps images (alt falls back to the title) and hides an inactive brand', () => {
    const result = map(
      product({
        brand: { name: 'Gone', slug: 'gone', status: 'INACTIVE' },
        variants: [variant('v1', [])],
      }),
    );
    expect(result.images).toEqual([
      { url: 'https://cdn/a.jpg', alt: 'Koto Chair', variantId: null },
      { url: 'https://cdn/b.jpg', alt: 'Walnut', variantId: 'v2' },
    ]);
    expect(result.brand).toBeNull();
    expect(result.breadcrumb).toEqual([{ name: 'Chairs', slug: 'chairs' }]);
  });

  it('buckets stock', () => {
    expect([0, 1, 5, 6].map(stockStatus)).toEqual([
      'OUT_OF_STOCK',
      'LOW_STOCK',
      'LOW_STOCK',
      'IN_STOCK',
    ]);
  });
});
