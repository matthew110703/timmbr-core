import { env } from '@/config/env';
import { RedisService } from '@/redis/redis.service';
import {
  GeocodingUnavailableException,
  LocationNotFoundException,
  LocationOutsideServiceAreaException,
} from '@/common/exceptions/geo.exception';
import { GeoService, toAddress, type GeoapifyResult } from './geo.service';

const BENGALURU: GeoapifyResult = {
  country_code: 'in',
  country: 'India',
  state: 'Karnataka',
  city: 'Bengaluru',
  suburb: 'Indiranagar',
  district: 'Bangalore East',
  street: '100 Feet Road',
  housenumber: '12',
  postcode: '560038',
  formatted: '12, 100 Feet Road, Indiranagar, Bengaluru 560038, Karnataka, India',
};

const okResponse = (results: GeoapifyResult[]) =>
  ({ ok: true, status: 200, json: () => Promise.resolve({ results }) }) as Response;

describe('toAddress', () => {
  it('maps a Geoapify result onto the address form fields', () => {
    expect(toAddress(BENGALURU, 12.97, 77.64)).toEqual({
      line1: '12 100 Feet Road',
      line2: 'Indiranagar, Bangalore East',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      country: 'India',
      latitude: 12.97,
      longitude: 77.64,
      formatted: BENGALURU.formatted,
    });
  });

  it('falls back for missing parts and drops invalid PIN codes', () => {
    const address = toAddress(
      {
        country_code: 'in',
        name: 'Cubbon Park',
        town: 'Mysuru',
        suburb: 'Mysuru',
        postcode: '5700',
      },
      12.3,
      76.6,
    );
    expect(address.line1).toBe('Cubbon Park');
    expect(address.city).toBe('Mysuru');
    // The suburb repeats the city, so it isn't used as line 2.
    expect(address.line2).toBe('');
    expect(address.postalCode).toBe('');
    expect(address.country).toBe('India');
  });

  it('keeps line 2 to the two most specific localities', () => {
    const address = toAddress(
      {
        ...BENGALURU,
        neighbourhood: "D'Souza Layout",
        quarter: 'Shanthala Nagar',
        district: 'Bengaluru Central City Corporation',
      },
      12.97,
      77.59,
    );
    expect(address.line2).toBe("D'Souza Layout, Shanthala Nagar");
  });
});

describe('GeoService', () => {
  let redis: { get: jest.Mock; setWithTTL: jest.Mock };
  let service: GeoService;
  let fetchMock: jest.SpyInstance;
  const originalKey = env.GEOAPIFY_API_KEY;

  beforeEach(() => {
    env.GEOAPIFY_API_KEY = 'test-key';
    redis = {
      get: jest.fn().mockResolvedValue(null),
      setWithTTL: jest.fn().mockResolvedValue('OK'),
    };
    service = new GeoService(redis as unknown as RedisService);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    env.GEOAPIFY_API_KEY = originalKey;
    fetchMock.mockRestore();
  });

  it('looks the point up, caches the result and returns the address', async () => {
    fetchMock.mockResolvedValue(okResponse([BENGALURU]));

    const address = await service.reverse(12.971599, 77.594566);

    const [requested] = fetchMock.mock.calls[0] as [URL];
    const url = new URL(requested);
    expect(url.origin + url.pathname).toBe('https://api.geoapify.com/v1/geocode/reverse');
    expect(url.searchParams.get('lat')).toBe('12.971599');
    expect(url.searchParams.get('lon')).toBe('77.594566');
    expect(url.searchParams.get('apiKey')).toBe('test-key');
    expect(url.searchParams.get('format')).toBe('json');
    expect(redis.setWithTTL).toHaveBeenCalledWith(
      'geo:reverse:12.9716:77.5946',
      86_400,
      JSON.stringify(BENGALURU),
    );
    expect(address).toMatchObject({ city: 'Bengaluru', postalCode: '560038', latitude: 12.971599 });
  });

  it('answers from the cache without calling the provider', async () => {
    redis.get.mockResolvedValue(JSON.stringify(BENGALURU));

    await expect(service.reverse(12.97, 77.59)).resolves.toMatchObject({ state: 'Karnataka' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(redis.setWithTTL).not.toHaveBeenCalled();
  });

  it('rejects points outside India', async () => {
    fetchMock.mockResolvedValue(
      okResponse([{ ...BENGALURU, country_code: 'de', country: 'Germany' }]),
    );
    await expect(service.reverse(51.2, 6.77)).rejects.toBeInstanceOf(
      LocationOutsideServiceAreaException,
    );
  });

  it('reports a point with no address', async () => {
    fetchMock.mockResolvedValue(okResponse([]));
    await expect(service.reverse(0, 0)).rejects.toBeInstanceOf(LocationNotFoundException);
  });

  it('is unavailable without an API key, on provider errors and on network failures', async () => {
    env.GEOAPIFY_API_KEY = undefined;
    await expect(service.reverse(12.97, 77.59)).rejects.toBeInstanceOf(
      GeocodingUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();

    env.GEOAPIFY_API_KEY = 'test-key';
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(service.reverse(12.97, 77.59)).rejects.toBeInstanceOf(
      GeocodingUnavailableException,
    );

    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    await expect(service.reverse(12.97, 77.59)).rejects.toBeInstanceOf(
      GeocodingUnavailableException,
    );
    expect(redis.setWithTTL).not.toHaveBeenCalled();
  });
});
