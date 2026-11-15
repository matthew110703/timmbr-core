import { escapeHtml } from '@/invoice/pdf/invoice-html.template';
import { EMAIL_THEME, EmailThemeRole, FONT_SANS } from './constants';
import { emailGreeting, emailIntro, emailStack, renderEmailLayout } from './layout';

export interface OrderUpdateEmailTemplateParams {
  customerName: string;
  orderNumber: string;
  orderStatus: string;
  updateCategory: string;
  message: string;
}

function summaryRow(label: string, valueHtml: string, valueRole: EmailThemeRole): string {
  return `<tr>
  <td class="t-body" style="padding:4px 0; font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:${EMAIL_THEME.body.light}; font-weight:400;">${label}</td>
  <td align="right" class="t-${valueRole}" style="padding:4px 0 4px 12px; font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:${EMAIL_THEME[valueRole].light}; font-weight:700;">${valueHtml}</td>
</tr>`;
}

export function orderUpdateEmailTemplate(params: OrderUpdateEmailTemplateParams): string {
  const orderNumber = escapeHtml(params.orderNumber);
  const orderStatus = escapeHtml(params.orderStatus);
  const updateCategory = escapeHtml(params.updateCategory.replace(/_/g, ' '));
  const message = escapeHtml(params.message);

  const summary = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="t-ticket" style="background-color:${EMAIL_THEME.ticket.light}; border-radius:6px;">
  <tr>
    <td style="padding:12px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${summaryRow('Order Number:', orderNumber, 'strong')}
        ${summaryRow('Current Status:', orderStatus, 'strong')}
        ${summaryRow('Category:', updateCategory, 'link')}
      </table>
    </td>
  </tr>
</table>`;

  const messageBox = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="t-card t-outline" style="background-color:${EMAIL_THEME.card.light}; border:1px solid ${EMAIL_THEME.outline.light}; border-radius:8px;">
  <tr>
    <td class="t-strong" style="padding:16px; font-family:${FONT_SANS}; font-size:15px; line-height:1.5; color:${EMAIL_THEME.strong.light}; font-weight:400;">
      ${message}
    </td>
  </tr>
</table>`;

  const bodyHtml = emailStack([
    emailIntro(
      emailGreeting(params.customerName.split(' ')[0]),
      `Here is the latest update regarding your order <strong>${orderNumber}</strong>.`,
    ),
    emailStack([summary, messageBox], 16),
  ]);

  return renderEmailLayout({
    title: `Order Update ${orderNumber}`,
    preheader: `Update on your Timmbr order ${orderNumber}`,
    heroTitle: 'Order update.',
    heroSubtitle: 'News from Timmbr.',
    bodyHtml,
    signOff: 'Thanks for choosing us,',
    footerNote: 'This is an automated order email. Please do not reply.',
  });
}
