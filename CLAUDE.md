# timmbr-core — Claude Code Instructions

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm start:dev` | Start dev server (watch mode) |
| `pnpm test` | Run all unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:cov` | Run tests with coverage report |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm format` | Auto-format all source files |
| `pnpm build` | Production build |
| `pnpm db:migrate` | Create and apply a Prisma migration (`prisma migrate dev`) |

Prisma client regenerates automatically via the `postinstall` hook. For a manual regen: `pnpm exec prisma generate`.

---

## Architecture

- **Platform:** NestJS on Fastify (`@nestjs/platform-fastify`)
- **ORM:** Prisma via `PrismaService` (injected as a NestJS provider)
- **Cache / token store:** Redis via `RedisService`
- **API versioning:** URI-based, default version `1` → all routes under `/api/v1/...`
- **Rate limiting:** 100 requests / 60 s globally (ThrottlerGuard, registered in AppModule)
- **Auth:** JWT (Passport) — `AccessTokenGuard` applied globally; use `@Public()` to opt a route out

### Feature module structure

Every feature module follows this layout:

```
src/<module>/
  <module>.module.ts       — NestJS module (imports, controllers, providers)
  <module>.controller.ts   — HTTP layer
  <module>.service.ts      — Business logic
  <module>.mapper.ts       — Prisma entity → response DTO
  dto/
    create-<module>.dto.ts
    update-<module>.dto.ts
    <module>-response.dto.ts
```

---

## Path Alias

`@/*` maps to `src/*`. **Always** use this alias.

```typescript
// ✓
import { PrismaService } from '@/prisma/prisma.service';

// ✗ — ESLint error (no-restricted-imports)
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaService } from '../../../prisma/prisma.service';
```

---

## ESLint / Code Style

Config: `eslint.config.mjs` — extends `tseslint.configs.recommendedTypeChecked` + Prettier.

### Errors (will fail CI)

| Rule | Constraint |
|------|-----------|
| `no-restricted-imports` | Use `@/` alias; no `src/` prefix; no `../../..` (3+ levels) |
| `no-restricted-syntax` | Never `process.env` directly — use `import { env } from '@/config/env'` |
| `prettier/prettier` | Formatting must match Prettier config |
| `no-unnecessary-type-assertion` | Remove casts TypeScript doesn't need |
| `@typescript-eslint/unbound-method` | Pass static methods via lambda (see Services section) |

### Warnings (keep clean)

`no-explicit-any`, `no-unsafe-argument`, `no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-member-access`, `no-unsafe-return`, `no-floating-promises`

### Prettier settings (`.prettierrc`)

```json
{ "singleQuote": true, "trailingComma": "all", "semi": true, "printWidth": 100, "tabWidth": 2 }
```

---

## DTO Conventions (`src/*/dto/*.dto.ts`)

- **Required fields** — definite assignment `field!: type`
- **Optional fields** — `field?: type` paired with `@IsOptional()`
- Every class-validator decorator includes `{ message: '...' }` for readable errors
- Field names are camelCase in DTOs but may differ from Prisma schema (`fname`/`lname` → `firstName`/`lastName` in DB)
- Use `@Transform` for normalization (e.g., lowercase email)
- For update DTOs where a field can be explicitly cleared to `null`, use `@ValidateIf((o) => o.field !== null)`

```typescript
// Required
@IsString({ message: 'First name must be a string' })
@MinLength(2, { message: 'First name must be at least 2 characters' })
fname!: string;

// Optional
@IsString({ message: 'Label must be a string' })
@IsOptional()
label?: string;
```

---

## Custom Exception Pattern

Location: `src/common/exceptions/<module>.exception.ts`

```typescript
import { NotFoundException } from '@nestjs/common';

export class XNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'X not found.', code: 'X_NOT_FOUND' });
  }
}
```

Rules:
- Extend an NestJS HTTP exception subclass (`NotFoundException`, `ConflictException`, `ForbiddenException`, `UnprocessableEntityException`, etc.)
- Always pass `{ message: string, code: string }` to `super()` — `GlobalExceptionFilter` reads `code` from `getResponse()`
- `code` is `SCREAMING_SNAKE_CASE` and globally unique across the codebase

---

## Controller Conventions

```typescript
@Controller('things')
export class ThingController {
  constructor(private thing: ThingService) {}

  @Get()
  @ResponseMessage('Things fetched successfully.')
  getAll(@Req() req: FastifyRequest) {
    const user = req.user as unknown as JwtPayload;  // Fastify + Passport pattern
    return this.thing.getAll(user.sub);
  }

  @Post()
  @HttpCode(201)
  @ResponseMessage('Thing created successfully.')
  create(@Req() req: FastifyRequest, @Body() dto: CreateThingDto) {
    const user = req.user as unknown as JwtPayload;
    return this.thing.create(user.sub, dto);
  }
}
```

- `JwtPayload`: `{ sub: string, email: string, role: UserRole }`
- **Do not** add `@UseGuards` — the global `AccessTokenGuard` covers all routes
- Use `@Public()` only to opt a route out of auth
- `@HttpCode(200)` is needed on PUT/PATCH routes (NestJS defaults PUT to 200 but explicit is clearer)
- `@HttpCode(201)` on POST create routes
- Always add `@ResponseMessage('...')` — populates `ApiSuccessResponse.message`

---

## Service Conventions

```typescript
@Injectable()
export class ThingService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string): Promise<ThingResponseDto[]> {
    const items = await this.prisma.thing.findMany({ where: { userId } });
    return items.map((item) => ThingMapper.toResponse(item));  // lambda — avoids unbound-method
  }

  async create(userId: string, dto: CreateThingDto): Promise<ThingResponseDto> {
    // Use $transaction for any multi-step atomic operation
    const thing = await this.prisma.$transaction(async (tx) => {
      await tx.thing.updateMany({ where: { userId, active: true }, data: { active: false } });
      return tx.thing.create({ data: { userId, ...dto } });
    });
    return ThingMapper.toResponse(thing);
  }

  private async findOwned(userId: string, thingId: string): Promise<Thing> {
    const thing = await this.prisma.thing.findUnique({ where: { id: thingId } });
    if (!thing) throw new ThingNotFoundException();
    if (thing.userId !== userId) throw new ThingForbiddenException();
    return thing;
  }
}
```

Key rules:
- Always wrap mapper calls in a lambda: `items.map((x) => Mapper.toResponse(x))` not `items.map(Mapper.toResponse)` (ESLint `unbound-method` error)
- Methods return typed DTOs (`Promise<XResponseDto>`), never raw Prisma entities
- Create a private `findOwned` helper for any resource that has ownership (404 + 403 checks)

---

## Mapper Pattern

```typescript
import { Thing } from '@prisma/client';
import { ThingResponseDto } from './dto/thing-response.dto';

export class ThingMapper {
  static toResponse(entity: Thing): ThingResponseDto {
    return {
      id: entity.id,
      fname: entity.firstName,        // rename DB field → DTO field
      line2: entity.line2 ?? null,    // nullable: always ?? null, not ?? undefined
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
```

---

## Response Shape

The global `TransformInterceptor` wraps all successful responses:

```typescript
// Success
{
  success: true,
  statusCode: 200,
  code: 'OK',                          // derived from HTTP status label
  message: 'Things fetched successfully.',  // from @ResponseMessage()
  data: T,
  path: '/api/v1/things',
  method: 'GET',
  timestamp: '2025-01-01T00:00:00.000Z'
}

// Paginated (return { data: T[], meta: {...} } from service)
{
  success: true, statusCode: 200, code: 'OK', message: '...', path: '...', method: '...', timestamp: '...',
  data: T[],
  meta: { page, limit, total, totalPages, hasNextPage, hasPrevPage }
}

// Error (GlobalExceptionFilter)
{
  success: false,
  statusCode: 404,
  code: 'THING_NOT_FOUND',             // from custom exception's code field
  message: 'Thing not found.',
  errors: null,
  path: '/api/v1/things/xyz',
  method: 'GET',
  timestamp: '...'
}
```

Return `{ message: string, data: T }` from a service method to set a dynamic per-response message.
Use `@SkipTransform()` on a route to return raw data without the wrapper.

---

## Available Decorators (`src/decorators/`)

| Decorator | Effect |
|-----------|--------|
| `@Public()` | Bypass JWT auth for a route or controller |
| `@ResponseMessage('...')` | Set custom `message` in success response |
| `@SkipTransform()` | Bypass `TransformInterceptor` — raw response |

Import from `@/decorators`.

---

## Environment / Config

```typescript
// ✓ always
import { env } from '@/config/env';
const port = env.PORT;

// ✗ ESLint error everywhere except src/config/env.ts
const port = process.env.PORT;
```

---

## Prisma

- Schema files: `prisma/models/<area>/<model>.prisma` (multi-file schema)
- After editing a `.prisma` file: run `pnpm db:migrate` to create and apply the migration
- Enum values are imported from `@prisma/client` as **value** imports (not type-only):
  ```typescript
  import { AddressType, UserRole } from '@prisma/client';
  ```
- Barrel re-exports in `src/types/user/index.ts` use `import type` — if you need `UserRole` as a runtime value, import it directly from `@prisma/client`

---

## Testing Conventions (`*.spec.ts`)

### Setup pattern

```typescript
import { Test, TestingModule } from '@nestjs/testing';

const mockPrismaService = {
  thing: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  $transaction: jest.fn(),
};

describe('ThingService', () => {
  let service: ThingService;

  beforeEach(async () => {
    // Re-initialize $transaction — jest.resetAllMocks() clears it
    mockPrismaService.$transaction.mockImplementation((fn: (tx: typeof mockPrismaService) => unknown) =>
      fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [ThingService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<ThingService>(ThingService);
  });

  // Services: resetAllMocks (clears implementations)
  afterEach(() => jest.resetAllMocks());
  // Controllers: clearAllMocks (clears call counts only)
  // afterEach(() => jest.clearAllMocks());
});
```

### Mocking external modules (e.g., argon2)

```typescript
jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import * as argon2 from 'argon2';
const mockedArgon2 = jest.mocked(argon2);

// in test:
mockedArgon2.hash.mockResolvedValue('hashed-value');
```

### Testing custom exception codes

```typescript
// ✓ correct — use .catch() + getResponse()
const error = await service.validateToken('bad-token', TokenType.RESET_PASSWORD)
  .catch((e: unknown) => e);
expect(error).toBeInstanceOf(UnauthorizedException);
expect((error as UnauthorizedException).getResponse()).toMatchObject({ code: 'TOKEN_INVALID' });

// ✗ incorrect — catch (err: any) triggers no-explicit-any
try {
  await service.validateToken('bad');
} catch (err: any) {
  expect(err.response?.code).toBe('TOKEN_INVALID');
}
```

### Type safety in tests

- Avoid `as any` — use fully-typed DTO variables or `as SpecificDtoType`
- For complete objects (all required fields provided): declare with the DTO type directly
- For partial objects passed to service methods: use `as CreateThingDto` (not `as any`)
- `UserRole` must be imported from `@prisma/client` directly (the `@/types/user` barrel uses `import type`)
