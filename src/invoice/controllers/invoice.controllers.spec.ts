import { Test, TestingModule } from '@nestjs/testing';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { InvoiceService } from '../invoice.service';
import { InvoiceController } from './invoice.controller';
import { InvoiceAdminController } from './invoice.admin.controller';

describe('InvoiceController & InvoiceAdminController', () => {
  let customerController: InvoiceController;
  let adminController: InvoiceAdminController;
  let invoiceService: jest.Mocked<InvoiceService>;

  beforeEach(async () => {
    const mockInvoiceService = {
      getCustomerInvoiceByOrderId: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      getCustomerInvoiceDownloadUrl: jest.fn().mockResolvedValue({
        downloadUrl: 'https://r2.test/inv.pdf',
        fileName: 'INV_26-27_000001.pdf',
        expiresIn: 300,
      }),
      getAdminInvoices: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      getAdminInvoiceById: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      getAdminInvoiceDownloadUrl: jest.fn().mockResolvedValue({
        downloadUrl: 'https://r2.test/inv.pdf',
        fileName: 'INV_26-27_000001.pdf',
        expiresIn: 300,
      }),
      retryPdfGeneration: jest.fn().mockResolvedValue({ id: 'inv-1', pdfGenerationVersion: 2 }),
      resendInvoiceEmail: jest.fn().mockResolvedValue({ id: 'deliv-1' }),
      voidInvoice: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'VOID' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController, InvoiceAdminController],
      providers: [{ provide: InvoiceService, useValue: mockInvoiceService }],
    }).compile();

    customerController = module.get<InvoiceController>(InvoiceController);
    adminController = module.get<InvoiceAdminController>(InvoiceAdminController);
    invoiceService = module.get(InvoiceService);
  });

  it('delegates customer order invoice and download requests with authenticated user.sub', async () => {
    const req: any = { user: { sub: 'cust-123' } };

    await customerController.getOrderInvoice(req, 'order-1');
    expect(invoiceService.getCustomerInvoiceByOrderId).toHaveBeenCalledWith('cust-123', 'order-1');

    await customerController.downloadOrderInvoice(req, 'order-1');
    expect(invoiceService.getCustomerInvoiceDownloadUrl).toHaveBeenCalledWith(
      'cust-123',
      'order-1',
    );
  });

  it('restricts InvoiceAdminController to ADMIN and MASTER, and restricts voidInvoice exclusively to Super Admin (MASTER)', () => {
    const classRoles = Reflect.getMetadata(ROLES_KEY, InvoiceAdminController);
    expect(classRoles).toEqual([UserRole.ADMIN, UserRole.MASTER]);

    const voidHandlerRoles = Reflect.getMetadata(
      ROLES_KEY,
      InvoiceAdminController.prototype.voidInvoice,
    );
    expect(voidHandlerRoles).toEqual([UserRole.MASTER]);
  });

  it('delegates admin retry-pdf, resend-email, and void actions with actor ID', async () => {
    const req: any = { user: { sub: 'master-1', role: UserRole.MASTER } };

    await adminController.retryPdfGeneration(req, 'inv-1');
    expect(invoiceService.retryPdfGeneration).toHaveBeenCalledWith('inv-1', 'master-1');

    await adminController.resendInvoiceEmail(req, 'inv-1', { recipient: 'alt@example.com' });
    expect(invoiceService.resendInvoiceEmail).toHaveBeenCalledWith('inv-1', 'master-1', {
      recipient: 'alt@example.com',
    });

    await adminController.voidInvoice(req, 'inv-1', {
      reason: 'Order cancelled due to regulatory hold',
    });
    expect(invoiceService.voidInvoice).toHaveBeenCalledWith('inv-1', 'master-1', {
      reason: 'Order cancelled due to regulatory hold',
    });
  });
});
