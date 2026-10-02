import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { AttributeValueService } from '../services/attribute-value.service';
import { AssignAttributeValueDto } from '../dto/assign-attribute-value.dto';
import { ATTRIBUTE_ROUTES } from '../attribute.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.PRODUCTS}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class VariantAttributeAdminController {
  constructor(private readonly service: AttributeValueService) {}

  @Get(ATTRIBUTE_ROUTES.VARIANT_ASSIGNMENTS.ROOT)
  @ResponseMessage('Variant attributes fetched successfully.')
  getAttributes(@Param('productId') productId: string, @Param('variantId') variantId: string) {
    return this.service.getVariantAttributes(productId, variantId);
  }

  @Post(ATTRIBUTE_ROUTES.VARIANT_ASSIGNMENTS.ROOT)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Variant attribute assigned successfully.')
  assignAttribute(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: AssignAttributeValueDto,
  ) {
    return this.service.assignVariantAttribute(productId, variantId, dto);
  }

  @Delete(ATTRIBUTE_ROUTES.VARIANT_ASSIGNMENTS.BY_DEFINITION)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAttribute(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Param('definitionId') definitionId: string,
  ) {
    await this.service.removeVariantAttribute(productId, variantId, definitionId);
    return;
  }
}
