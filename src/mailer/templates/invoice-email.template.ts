import { escapeHtml } from '@/invoice/pdf/invoice-html.template';
import {
  EMAIL_THEME,
  FONT_SANS,
  TIMMBR_DOWNLOAD_ICON_URL,
  TIMMBR_OTP_SHIELD_ICON_URL,
} from './constants';
import {
  EMAIL_DIVIDER,
  emailGreeting,
  emailIconRow,
  emailIntro,
  emailNote,
  emailNoteTitle,
  emailStack,
  renderEmailLayout,
} from './layout';

export interface InvoiceEmailTemplateParams {
  customerName: string;
  orderNumber: string;
  attachmentFileName: string;
}

export function invoiceEmailTemplate(params: InvoiceEmailTemplateParams): string {
  const orderNumber = escapeHtml(params.orderNumber);
  const fileName = escapeHtml(params.attachmentFileName);

  const ticket = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;">
  <tr>
    <td align="center" style="padding:12px 0; text-align:center;">
      <p class="t-label" style="margin:0 0 12px 0; font-family:${FONT_SANS}; font-size:12px; line-height:normal; color:${EMAIL_THEME.label.light}; font-weight:700;">
        YOUR ORDER NUMBER
      </p>
      <p class="t-strong r-ticket-number" style="margin:0; font-family:${FONT_SANS}; font-size:30px; line-height:1.1; color:${EMAIL_THEME.strong.light}; font-weight:700;">
        ${orderNumber}
      </p>
    </td>
  </tr>
</table>`;

  const attachment = `${emailNoteTitle('Your invoice is attached.')}
<table role="presentation" cellpadding="0" cellspacing="0">
  <tr>
    <td valign="middle" class="t-meta" style="font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:${EMAIL_THEME.meta.light}; font-weight:400; word-break:break-word;">
      ${fileName} &bull; PDF document
    </td>
    <td width="16" valign="middle" style="padding-left:8px; font-size:0; line-height:0;">
      <img src="${TIMMBR_DOWNLOAD_ICON_URL}" width="16" height="16" alt="" class="t-icon"
           style="display:block; width:16px; height:16px; border:0;">
    </td>
  </tr>
</table>`;

  const bodyHtml = emailStack([
    emailIntro(
      emailGreeting(params.customerName.split(' ')[0]),
      'Thanks for your order! We&rsquo;ve received it and are getting everything ready. Your invoice is attached to this email.',
    ),
    ticket,
    emailStack(
      [
        emailIconRow(TIMMBR_OTP_SHIELD_ICON_URL, attachment),
        EMAIL_DIVIDER,
        emailNote(
          'What happens next?',
          'We&rsquo;ll send you an update when your order is on its way.<br>Need a hand? Visit Help in your Timmbr account.',
        ),
      ],
      18,
    ),
  ]);

  return renderEmailLayout({
    title: `Order confirmed ${orderNumber}`,
    preheader: `Your Timmbr order ${orderNumber} is confirmed. Your invoice is attached.`,
    heroTitle: 'Order confirmed.',
    heroSubtitle: 'A little closer to home.',
    bodyHtml,
    signOff: 'Thanks for choosing us,',
    footerNote: 'This is an automated order email. Please do not reply.',
  });
}
