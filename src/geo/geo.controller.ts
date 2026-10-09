import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage } from '@/common/decorators';
import { GeoService } from './geo.service';
import { ReverseGeocodeQueryDto } from './dto/reverse-geocode-query.dto';
import { GEO_ROUTES } from './geo.routes';

/** Signed-in users only (address forms); every lookup costs a provider call. */
const GEO_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@Controller(APP_ROUTES.GEO)
export class GeoController {
  constructor(private geo: GeoService) {}

  @Get(GEO_ROUTES.REVERSE)
  @Throttle(GEO_THROTTLE)
  @ResponseMessage('Address found for this location.')
  reverse(@Query() query: ReverseGeocodeQueryDto) {
    return this.geo.reverse(query.lat, query.lon);
  }
}
