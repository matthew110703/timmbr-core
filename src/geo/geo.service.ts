import { Injectable, Logger } from '@nestjs/common';
import { env } from '@/config/env';
import { RedisService } from '@/redis/redis.service';
import {
  GeocodingUnavailableException,
  LocationNotFoundException,
  LocationOutsideServiceAreaException,
} from '@/common/exceptions/geo.exception';
import { ReverseGeocodeResponseDto } from './dto/reverse-geocode-response.dto';

const GEOAPIFY_REVERSE_URL = 'https://api.geoapify.com/v1/geocode/reverse';
/** Same point (to ~11 m) → same answer, for a day. */
const CACHE_TTL_SECONDS = 24 * 60 * 60;
const CACHE_PRECISION = 4;
const REQUEST_TIMEOUT_MS = 5_000;
/** We only deliver in India. */
const SERVICE_COUNTRY = 'in';
const LINE2_PARTS = 2;

/** The fields we read from a Geoapify `format=json` result. */
export interface GeoapifyResult {
  country_code?: string;
  country?: string;
  state?: string;
  county?: string;
  city?: string;
  town?: string;
  village?: string;
  district?: string;
  suburb?: string;
  quarter?: string;
  neighbourhood?: string;
  street?: string;
  housenumber?: string;
  name?: string;
  postcode?: string;
  address_line1?: string;
  formatted?: string;
}

const clean = (value?: string) => value?.trim() ?? '';

/** Up to `max` distinct, non-empty parts (case-insensitive, minus `exclude`) joined with ", ". */
function joinDistinct(
  parts: (string | undefined)[],
  exclude: string[] = [],
  max = Infinity,
): string {
  const seen = new Set(exclude.filter(Boolean).map((part) => part.toLowerCase()));
  const kept: string[] = [];
  for (const part of parts.map(clean)) {
    if (!part || seen.has(part.toLowerCase()) || kept.length >= max) continue;
    seen.add(part.toLowerCase());
    kept.push(part);
  }
  return kept.join(', ');
}

/** Maps a provider result onto the address form's fields. */
export function toAddress(
  result: GeoapifyResult,
  latitude: number,
  longitude: number,
): ReverseGeocodeResponseDto {
  const city =
    clean(result.city) || clean(result.town) || clean(result.village) || clean(result.county);
  const street = [clean(result.housenumber), clean(result.street)].filter(Boolean).join(' ');
  const line1 = street || clean(result.name) || clean(result.address_line1);
  // The two most specific localities; districts like "… City Corporation" add noise.
  const line2 = joinDistinct(
    [result.neighbourhood, result.quarter, result.suburb, result.district],
    [line1, city],
    LINE2_PARTS,
  );
  const postcode = clean(result.postcode).replace(/\s+/g, '');

  return {
    line1,
    line2,
    city,
    state: clean(result.state),
    postalCode: /^\d{6}$/.test(postcode) ? postcode : '',
    country: clean(result.country) || 'India',
    latitude,
    longitude,
    formatted: clean(result.formatted),
  };
}

/** Reverse geocoding (point → address) through Geoapify. The API key stays server-side. */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly redis: RedisService) {}

  async reverse(latitude: number, longitude: number): Promise<ReverseGeocodeResponseDto> {
    const apiKey = env.GEOAPIFY_API_KEY;
    if (!apiKey) throw new GeocodingUnavailableException();

    const cacheKey = `geo:reverse:${latitude.toFixed(CACHE_PRECISION)}:${longitude.toFixed(CACHE_PRECISION)}`;
    const cached = await this.redis.get(cacheKey);
    let result: GeoapifyResult;
    if (cached) {
      result = JSON.parse(cached) as GeoapifyResult;
    } else {
      result = await this.lookup(latitude, longitude, apiKey);
      await this.redis.setWithTTL(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
    }

    if (clean(result.country_code).toLowerCase() !== SERVICE_COUNTRY) {
      throw new LocationOutsideServiceAreaException();
    }
    return toAddress(result, latitude, longitude);
  }

  private async lookup(
    latitude: number,
    longitude: number,
    apiKey: string,
  ): Promise<GeoapifyResult> {
    const url = new URL(GEOAPIFY_REVERSE_URL);
    url.search = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'json',
      lang: 'en',
      limit: '1',
      apiKey,
    }).toString();

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      this.logger.error('Geoapify request failed', error);
      throw new GeocodingUnavailableException();
    }
    if (!response.ok) {
      this.logger.error(`Geoapify reverse geocoding failed: ${response.status}`);
      throw new GeocodingUnavailableException();
    }

    const body = (await response.json()) as { results?: GeoapifyResult[] };
    const result = body.results?.[0];
    if (!result) throw new LocationNotFoundException();
    return result;
  }
}
