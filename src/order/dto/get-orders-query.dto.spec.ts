import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { GetOrdersQueryDto } from './get-orders-query.dto';

const parse = async (query: Record<string, unknown>) => {
  const dto = plainToInstance(GetOrdersQueryDto, query);
  return { dto, errors: await validate(dto) };
};

describe('GetOrdersQueryDto.status', () => {
  it('accepts a single status', async () => {
    const { dto, errors } = await parse({ status: 'DELIVERED' });
    expect(errors).toHaveLength(0);
    expect(dto.status).toEqual([OrderStatus.DELIVERED]);
  });

  it('accepts a comma-separated list', async () => {
    const { dto, errors } = await parse({ status: 'CONFIRMED, PROCESSING,SHIPPED' });
    expect(errors).toHaveLength(0);
    expect(dto.status).toEqual([
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
    ]);
  });

  it('accepts a repeated query param', async () => {
    const { dto, errors } = await parse({ status: ['CANCELLED', 'RETURNED'] });
    expect(errors).toHaveLength(0);
    expect(dto.status).toEqual([OrderStatus.CANCELLED, OrderStatus.RETURNED]);
  });

  it('rejects an unknown status', async () => {
    const { errors } = await parse({ status: 'CONFIRMED,LOST' });
    expect(errors.map((e) => e.property)).toContain('status');
  });
});
