import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReverseGeocodeQueryDto } from './reverse-geocode-query.dto';

const errorsFor = async (query: Record<string, string>) =>
  (await validate(plainToInstance(ReverseGeocodeQueryDto, query))).map((e) => e.property);

describe('ReverseGeocodeQueryDto', () => {
  it('accepts coordinates from the query string', async () => {
    const dto = plainToInstance(ReverseGeocodeQueryDto, { lat: '12.9716', lon: '77.5946' });
    expect(dto).toEqual({ lat: 12.9716, lon: 77.5946 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    [{ lat: '91', lon: '77' }, ['lat']],
    [{ lat: '12', lon: '-181' }, ['lon']],
    [{ lat: 'abc', lon: '77' }, ['lat']],
    [{ lat: '12' }, ['lon']],
  ])('rejects %j', async (query, invalid) => {
    expect(await errorsFor(query as Record<string, string>)).toEqual(invalid);
  });
});
