import { TIMMBR_BRAND_LOGO_URL } from './constants';
import { escapeHtml } from '@/invoice/pdf/invoice-html.template';

export interface OrderUpdateEmailTemplateParams {
  customerName: string;
  orderNumber: string;
  orderStatus: string;
  updateCategory: string;
  message: string;
}

export function orderUpdateEmailTemplate(params: OrderUpdateEmailTemplateParams): string {
  const firstName = escapeHtml(params.customerName.split(' ')[0] || 'Customer');
  const orderNumber = escapeHtml(params.orderNumber);
  const orderStatus = escapeHtml(params.orderStatus);
  const updateCategory = escapeHtml(params.updateCategory.replace(/_/g, ' '));
  const message = escapeHtml(params.message);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Order Update ${orderNumber}</title>
</head>
<body style="margin:0; padding:0; background-color:#ECE3D2; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    Update on your Timmbr order ${orderNumber}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ECE3D2; padding:40px 0;">
    <tr>
      <td align="center">

        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#F7F1E6; border-radius:12px; overflow:hidden; max-width:480px; width:100%;">

          <tr>
            <td align="center" style="padding:44px 40px 8px 40px;">
              <img src="${TIMMBR_BRAND_LOGO_URL}"
                   width="160" alt="Timmbr"
                   style="display:block; width:160px; height:auto;">
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 0 40px;">
              <div style="height:1px; background-color:#E3D7C2; width:100%;"></div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:32px 40px 0 40px;">
              <h1 style="margin:0; font-size:22px; line-height:30px; color:#3A2E22; font-weight:700;">
                Update on Your Order
              </h1>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 40px 0 40px;">
              <p style="margin:0; font-size:15px; line-height:24px; color:#6B5F4F;">
                Hi ${firstName}, here is the latest update regarding your order <strong>${orderNumber}</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EFE6D5; border-radius:8px; padding:16px;">
                <tr>
                  <td style="font-size:13px; color:#6B5F4F; padding:4px 0;">Order Number:</td>
                  <td align="right" style="font-size:13px; font-weight:700; color:#3A2E22; padding:4px 0;">${orderNumber}</td>
                </tr>
                <tr>
                  <td style="font-size:13px; color:#6B5F4F; padding:4px 0;">Current Status:</td>
                  <td align="right" style="font-size:13px; font-weight:600; color:#3A2E22; padding:4px 0;">${orderStatus}</td>
                </tr>
                <tr>
                  <td style="font-size:13px; color:#6B5F4F; padding:4px 0;">Category:</td>
                  <td align="right" style="font-size:13px; font-weight:600; color:#D16731; padding:4px 0;">${updateCategory}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 40px 0 40px;">
              <div style="background-color:#FFFFFF; border:1px solid #E3D7C2; border-radius:8px; padding:16px; font-size:15px; line-height:24px; color:#3A2E22;">
                ${message}
              </div>
            </td>
          </tr>

          <tr><td style="padding-bottom:40px;"></td></tr>

        </table>

        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%;">
          <tr>
            <td align="center" style="padding:24px 20px 0 20px;">
              <p style="margin:0; font-size:12px; line-height:18px; color:#9B8F7A;">
                &copy; 2026 Timmbr. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}
