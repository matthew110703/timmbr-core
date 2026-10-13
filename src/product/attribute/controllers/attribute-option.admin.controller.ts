import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { AttributeOptionService } from '../services/attribute-option.service';
import { CreateAttributeOptionDto } from '../dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from '../dto/update-attribute-option.dto';
import { ATTRIBUTE_ROUTES } from '../attribute.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.ATTRIBUTE_DEFINITIONS}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class AttributeOptionAdminController {
  constructor(private readonly service: AttributeOptionService) {}

  @Get(ATTRIBUTE_ROUTES.OPTIONS.ROOT)
  @ResponseMessage('Attribute options fetched successfully.')
  getAll(@Param('id') id: string) {
    return this.service.getAll(id);
  }

  @Post(ATTRIBUTE_ROUTES.OPTIONS.ROOT)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Attribute option created successfully.')
  create(@Param('id') id: string, @Body() dto: CreateAttributeOptionDto) {
    return this.service.create(id, dto);
  }

  @Patch(ATTRIBUTE_ROUTES.OPTIONS.BY_ID)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Attribute option updated successfully.')
  update(
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @Body() dto: UpdateAttributeOptionDto,
  ) {
    return this.service.update(id, optionId, dto);
  }

  @Delete(ATTRIBUTE_ROUTES.OPTIONS.BY_ID)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Attribute option deleted successfully.')
  async delete(@Param('id') id: string, @Param('optionId') optionId: string) {
    await this.service.delete(id, optionId);
    return null;
  }
}
