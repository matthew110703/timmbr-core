import { TIMMBR_DOWNLOAD_ICON_URL } from './constants';
import { invoiceEmailTemplate } from './invoice-email.template';

describe('invoiceEmailTemplate', () => {
  const params = {
    customerName: 'Aarav Sharma',
    orderNumber: '#TMB-5008524C',
    attachmentFileName: 'TMB_25-26_0001.pdf',
  };

  it('shows the order number, the attached file name and the first-name greeting', () => {
    const html = invoiceEmailTemplate(params);

    expect(html).toContain('Order confirmed.');
    expect(html).toContain('#TMB-5008524C');
    expect(html).toContain('TMB_25-26_0001.pdf &bull; PDF document');
    expect(html).toContain(TIMMBR_DOWNLOAD_ICON_URL);
    expect(html).toContain('Hi Aarav,');
  });

  it('opts into light and dark rendering', () => {
    expect(invoiceEmailTemplate(params)).toContain(
      '<meta name="color-scheme" content="light dark">',
    );
  });

  it('falls back to a generic greeting when the name is blank', () => {
    expect(invoiceEmailTemplate({ ...params, customerName: '' })).toContain('Hi there,');
  });

  it('escapes dynamic values', () => {
    const html = invoiceEmailTemplate({
      customerName: '<script>alert(1)</script> Doe',
      orderNumber: '<b>#1</b>',
      attachmentFileName: '"evil".pdf',
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>#1</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;evil&quot;.pdf');
  });

  it('no longer carries invoice totals', () => {
    expect(invoiceEmailTemplate(params)).not.toContain('Total Paid');
  });
});
