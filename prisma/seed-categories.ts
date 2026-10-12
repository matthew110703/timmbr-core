/**
 * Adds a realistic furniture category tree (root → group → leaf) for
 * development: the storefront's header menu and category pages need depth.
 *
 * Idempotent and additive: a category is matched by (parent, slug or name)
 * and only created when missing. Nothing is renamed, moved or deleted.
 *
 * Names are unique across the whole tree, so storefront URLs
 * (/category/<slug>) stay unambiguous.
 *
 * Run: pnpm ts-node -r tsconfig-paths/register prisma/seed-categories.ts
 * Add `--placeholder-images` to give second-level categories without a
 * logoUrl a placeholder photo (dev only; real images come from the console).
 */
import { CategoryStatus, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../src/config/env';
import { generateSlug } from '../src/common/utils/helpers';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

/** name → children (a nested tree or a list of leaf names). */
type Tree = { [name: string]: Tree | string[] };

const TREE: Tree = {
  Bedroom: {
    Beds: ['Queen Size Beds', 'King Size Beds', 'Single Beds', 'Poster Beds', 'Storage Beds'],
    Wardrobes: [
      '1 Door Wardrobes',
      '2 Door Wardrobes',
      '3 Door Wardrobes',
      'Sliding Door Wardrobes',
    ],
    'Bedside Tables': [],
    'Chest of Drawers': [],
    'Dressing Tables': ['Dressers', 'Dressing Cabinets', 'Dressing Units'],
    'Kids Bedroom': ['Cribs', 'Bunk Beds', 'Kids Study Tables', 'Kids Wardrobes'],
    Mattresses: ['Memory Foam Mattresses', 'Spring Mattresses', 'Latex Mattresses'],
  },
  'Dining Room': {
    'Dining Sets': [
      '2 Seater Dining Sets',
      '4 Seater Dining Sets',
      '6 Seater Dining Sets',
      '8 Seater Dining Sets',
    ],
    'Dining Tables': ['Round Dining Tables', 'Extendable Dining Tables'],
    'Dining Chairs': ['Upholstered Dining Chairs', 'Wooden Dining Chairs'],
    'Dining Benches': [],
    'Crockery Units': [],
    'Bar Furniture': ['Bar Cabinets', 'Bar Trolleys', 'Bar Stools', 'Bar Table Sets'],
    'Sideboards & Buffets': [],
  },
  Kitchen: {
    'Kitchen Storage': ['Kitchen Racks', 'Kitchen Trolleys', 'Spice Racks'],
    'Kitchen Islands': [],
    'Pantry Cabinets': [],
    'Breakfast Counters': ['Counter Stools', 'Breakfast Tables'],
  },
  'Living Room': {
    // "Sofas" may already exist here; its new children are added under it.
    Sofas: [
      '3 Seater Sofas',
      '2 Seater Sofas',
      '1 Seater Sofas',
      'Sofa Sets',
      'L Shaped Sofas',
      'Leather Sofas',
      'Fabric Sofas',
      'Wooden Sofas',
      'Outdoor Sofas',
      'Sofa Cum Beds',
    ],
    'Sectional Sofas': ['LHS Sectionals', 'RHS Sectionals', 'Corner Sofas'],
    Recliners: ['1 Seater Recliners', '2 Seater Recliners', '3 Seater Recliners', 'Recliner Sets'],
    'Accent Chairs': [
      'Wing Chairs',
      'Lounge Chairs',
      'Slipper Chairs',
      'Barrel Chairs',
      'Rocking Chairs',
    ],
    'Centre Tables': ['Coffee Tables', 'Coffee Table Sets', 'Nesting Tables'],
    'Side Tables': ['End Tables', 'C Shaped Tables', 'Console Tables'],
    'TV & Media Units': [],
    'Settees & Benches': ['Settees', 'Living Room Benches', 'Recamiers'],
    Ottomans: [],
    'Bean Bags': [],
    'Chaise Loungers': [],
  },
  'Living Room Luxury': {
    'Luxury Sofas': ['Chesterfield Sofas', 'Velvet Sofas', 'Handcarved Sofas'],
    'Luxury Lounge Chairs': ['Teak Lounge Chairs', 'Leather Lounge Chairs'],
    'Statement Tables': ['Marble Coffee Tables', 'Live Edge Tables'],
    'Designer Cabinets': [],
  },
  'Storage & Cabinetry': {
    'Book Shelves': ['Wall Book Shelves', 'Ladder Shelves'],
    'Shoe Racks': ['Shoe Cabinets', 'Open Shoe Racks', 'Shoe Rack with Seat'],
    'Cabinets & Sideboards': [],
    'Wall Shelves': [],
  },
  Office: {
    'Study Tables': ['Writing Tables', 'Computer Tables', 'Foldable Tables', 'Wall Mounted Tables'],
    'Office Chairs': ['Ergonomic Chairs', 'Executive Chairs', 'Gaming Chairs'],
    'Office Storage': ['Filing Cabinets', 'Office Cabinets'],
  },
  Outdoor: {
    'Outdoor Seating': ['Garden Benches', 'Outdoor Loungers', 'Swings'],
    'Outdoor Tables': [],
    Planters: [],
  },
};

let created = 0;
let existing = 0;

async function ensure(name: string, parentId: string | null): Promise<string> {
  const slug = generateSlug(name);
  // Match on name too: older rows may have a different slug for the same name
  // (e.g. "storage-cabinetry" vs today's "storage-and-cabinetry").
  const found = await prisma.category.findFirst({
    where: { parentId, OR: [{ slug }, { name }] },
  });
  if (found) {
    existing++;
    return found.id;
  }
  const category = await prisma.category.create({
    data: { name, slug, parentId, status: CategoryStatus.ACTIVE },
  });
  created++;
  console.log(`  + ${name} (${slug})`);
  return category.id;
}

async function seed(tree: Tree | string[], parentId: string | null) {
  if (Array.isArray(tree)) {
    for (const name of tree) await ensure(name, parentId);
    return;
  }
  for (const [name, children] of Object.entries(tree)) {
    const id = await ensure(name, parentId);
    await seed(children, id);
  }
}

/**
 * Dev-only placeholder photos (Unsplash, same set the storefront homepage
 * mocks use) so image tiles in the mobile category menu can be tested.
 */
const PLACEHOLDER_PHOTOS = [
  'photo-1555041469-a586c61ea9bc', // sofa
  'photo-1586023492125-27b2c045efd7', // living room
  'photo-1600210492486-724fe5c67fb0', // luxury living
  'photo-1616486338812-3dadae4b4ace', // bedroom
  'photo-1556911220-e15b29be8c8f', // kitchen
  'photo-1524758631624-e2822e304c36', // office
  'photo-1617806118233-18e1de247200', // dining
  'photo-1538688525198-9b88f6f53126', // chair
].map((id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&h=400&q=80`);

/** Root slug → index of its closest photo; a root's groups rotate from there. */
const ROOT_PHOTO_START: Record<string, number> = {
  'living-room': 1,
  'living-room-luxury': 2,
  bedroom: 3,
  kitchen: 4,
  office: 5,
  'dining-room': 6,
};

/** Sets logoUrl on second-level categories that have none (never overwrites). */
async function seedPlaceholderImages() {
  const roots = await prisma.category.findMany({
    where: { parentId: null },
    include: { children: { orderBy: { name: 'asc' } } },
  });
  let updated = 0;
  for (const root of roots) {
    const start = ROOT_PHOTO_START[root.slug] ?? 0;
    for (const [index, child] of root.children.entries()) {
      if (child.logoUrl) continue;
      await prisma.category.update({
        where: { id: child.id },
        data: { logoUrl: PLACEHOLDER_PHOTOS[(start + index) % PLACEHOLDER_PHOTOS.length] },
      });
      updated++;
    }
  }
  console.log(`Placeholder images: ${updated} categories updated.`);
}

async function main() {
  console.log('Seeding category tree…');
  await seed(TREE, null);
  console.log(`Done: ${created} created, ${existing} already existed.`);
  if (process.argv.includes('--placeholder-images')) await seedPlaceholderImages();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
