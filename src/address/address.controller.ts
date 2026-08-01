import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtPayload } from '@/auth/types/jwt.types';
import { ResponseMessage } from '@/common/decorators';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('addresses')
export class AddressController {
  constructor(private address: AddressService) {}

  @Get()
  @ResponseMessage('Addresses fetched successfully.')
  getAll(@Req() req: FastifyRequest) {
    const user = req.user as unknown as JwtPayload;
    return this.address.getAll(user.sub);
  }

  @Post()
  @HttpCode(201)
  @ResponseMessage('Address added successfully.')
  create(@Req() req: FastifyRequest, @Body() dto: CreateAddressDto) {
    const user = req.user as unknown as JwtPayload;
    return this.address.create(user.sub, dto);
  }

  @Get(':addressId')
  @ResponseMessage('Address fetched successfully.')
  getOne(@Req() req: FastifyRequest, @Param('addressId') addressId: string) {
    const user = req.user as unknown as JwtPayload;
    return this.address.getOne(user.sub, addressId);
  }

  @Put(':addressId')
  @HttpCode(200)
  @ResponseMessage('Address updated successfully.')
  update(
    @Req() req: FastifyRequest,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const user = req.user as unknown as JwtPayload;
    return this.address.update(user.sub, addressId, dto);
  }

  @Delete(':addressId')
  @ResponseMessage('Address deleted successfully.')
  remove(@Req() req: FastifyRequest, @Param('addressId') addressId: string) {
    const user = req.user as unknown as JwtPayload;
    return this.address.remove(user.sub, addressId);
  }

  @Patch(':addressId/default')
  @HttpCode(200)
  @ResponseMessage('Default address updated successfully.')
  setDefault(@Req() req: FastifyRequest, @Param('addressId') addressId: string) {
    const user = req.user as unknown as JwtPayload;
    return this.address.setDefault(user.sub, addressId);
  }
}
