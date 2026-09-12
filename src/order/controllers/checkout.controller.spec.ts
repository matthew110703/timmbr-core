import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutController } from './checkout.controller';
import { OrderService } from '../order.service';

describe('CheckoutController', () => {
  let controller: CheckoutController;
  let service: jest.Mocked<OrderService>;

  beforeEach(async () => {
    const mockOrderService = {
      getQuote: jest.fn().mockResolvedValue({
        items: [],
        subtotal: 1000,
        discount: 0,
        shippingFee: 0,
        tax: 180,
        grandTotal: 1000,
        currency: 'INR',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [{ provide: OrderService, useValue: mockOrderService }],
    }).compile();

    controller = module.get<CheckoutController>(CheckoutController);
    service = module.get(OrderService);
  });

  it('calculates quote for authenticated user', async () => {
    const req: any = { user: { sub: 'user-uuid-1' } };
    const dto = {
      shippingAddressId: 'addr-uuid-1',
      items: [{ variantId: 'var-uuid-1', quantity: 1 }],
    };

    const result = await controller.getQuote(req, dto);
    expect(service.getQuote).toHaveBeenCalledWith('user-uuid-1', dto);
    expect(result.grandTotal).toBe(1000);
  });
});
