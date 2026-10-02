import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { AttributeValueService } from '../services/attribute-value.service';
import { AssignAttributeValueDto } from '../dto/assign-attribute-value.dto';
import { ATTRIBUTE_ROUTES } from '../attribute.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.PRODUCTS}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class ProductAttributeAdminController {
  constructor(private readonly service: AttributeValueService) {}

  @Get(ATTRIBUTE_ROUTES.PRODUCT_ASSIGNMENTS.ROOT)
  @ResponseMessage('Product attributes fetched successfully.')
  getAttributes(@Param('productId') productId: string) {
    return this.service.getProductAttributes(productId);
  }

  @Post(ATTRIBUTE_ROUTES.PRODUCT_ASSIGNMENTS.ROOT)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Product attribute assigned successfully.')
  assignAttribute(@Param('productId') productId: string, @Body() dto: AssignAttributeValueDto) {
    return this.service.assignProductAttribute(productId, dto);
  }

  @Delete(ATTRIBUTE_ROUTES.PRODUCT_ASSIGNMENTS.BY_DEFINITION)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAttribute(
    @Param('productId') productId: string,
    @Param('definitionId') definitionId: string,
  ) {
    await this.service.removeProductAttribute(productId, definitionId);
    return;
  }
}
