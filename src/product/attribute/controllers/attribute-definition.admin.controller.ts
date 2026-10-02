import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { AttributeDefinitionService } from '../services/attribute-definition.service';
import { CreateAttributeDefinitionDto } from '../dto/create-attribute-definition.dto';
import { UpdateAttributeDefinitionDto } from '../dto/update-attribute-definition.dto';
import { GetAttributeDefinitionsQueryDto } from '../dto/get-attribute-definitions-query.dto';
import { ATTRIBUTE_ROUTES } from '../attribute.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.ATTRIBUTE_DEFINITIONS}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class AttributeDefinitionAdminController {
  constructor(private readonly service: AttributeDefinitionService) {}

  @Get(ATTRIBUTE_ROUTES.DEFINITIONS.ROOT)
  @ResponseMessage('Attribute definitions fetched successfully.')
  getAll(@Query() query: GetAttributeDefinitionsQueryDto) {
    return this.service.getAll(query);
  }

  @Get(ATTRIBUTE_ROUTES.DEFINITIONS.BY_ID)
  @ResponseMessage('Attribute definition fetched successfully.')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post(ATTRIBUTE_ROUTES.DEFINITIONS.ROOT)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Attribute definition created successfully.')
  create(@Body() dto: CreateAttributeDefinitionDto) {
    return this.service.create(dto);
  }

  @Put(ATTRIBUTE_ROUTES.DEFINITIONS.BY_ID)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Attribute definition updated successfully.')
  update(@Param('id') id: string, @Body() dto: UpdateAttributeDefinitionDto) {
    return this.service.update(id, dto);
  }

  @Delete(ATTRIBUTE_ROUTES.DEFINITIONS.BY_ID)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Attribute definition deleted successfully.')
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return null;
  }
}
