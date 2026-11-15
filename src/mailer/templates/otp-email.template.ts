import { escapeHtml } from '@/invoice/pdf/invoice-html.template';
import {
  EMAIL_THEME,
  FONT_SANS,
  TIMMBR_OTP_CLOCK_ICON_URL,
  TIMMBR_OTP_SHIELD_ICON_URL,
} from './constants';
import {
  EMAIL_DIVIDER,
  emailGreeting,
  emailIconRow,
  emailIntro,
  emailNote,
  emailStack,
  renderEmailLayout,
} from './layout';

export function otpEmailTemplate(
  firstName: string | null,
  otpCode: string,
  expiryMinutes: number,
): string {
  const code = escapeHtml(otpCode);

  const ticket = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="t-ticket" style="background-color:${EMAIL_THEME.ticket.light}; border-radius:6px;">
  <tr>
    <td style="padding:12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td class="t-dash" style="border:1px dashed ${EMAIL_THEME.dash.light}; border-radius:6px; padding:22px 20px 20px 20px; text-align:center;">
            <p class="t-label" style="margin:0 0 17px 0; font-family:${FONT_SANS}; font-size:12px; line-height:normal; color:${EMAIL_THEME.label.light}; font-weight:700; letter-spacing:0.02em;">
              YOUR LOGIN CODE
            </p>
            <p class="t-strong r-code" style="margin:0 0 17px 0; font-family:${FONT_SANS}; font-size:48px; line-height:1.1; color:${EMAIL_THEME.strong.light}; font-weight:700; letter-spacing:0.04em;">
              ${code}
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center">
              <tr>
                <td valign="middle" style="padding-right:6px; font-size:0; line-height:0;">
                  <img src="${TIMMBR_OTP_CLOCK_ICON_URL}" width="14" height="14" alt="" class="t-icon"
                       style="display:block; width:14px; height:14px; border:0;">
                </td>
                <td valign="middle" class="t-strong" style="font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:${EMAIL_THEME.strong.light}; font-weight:500;">
                  Valid for ${expiryMinutes} minutes &bull; Use only once
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  const bodyHtml = emailStack([
    emailIntro(
      emailGreeting(firstName),
      'Enter this one time password on the Timmbr login screen to securely sign in to your account.',
    ),
    ticket,
    emailStack(
      [
        emailIconRow(
          TIMMBR_OTP_SHIELD_ICON_URL,
          emailNote(
            'Just for you. Never share this code.',
            'Timmbr will never ask you for your OTP by phone, email or message.',
          ),
        ),
        EMAIL_DIVIDER,
        emailNote(
          'Didn&rsquo;t request this code?',
          'You can safely ignore this email. Without this code, this login request can&rsquo;t be completed.',
        ),
      ],
      18,
    ),
  ]);

  return renderEmailLayout({
    title: 'Your Timmbr login code',
    preheader: `Your Timmbr login code is ${code}. Valid for ${expiryMinutes} minutes.`,
    heroTitle: 'Let&rsquo;s log you in.',
    heroSubtitle: 'Make yourself at home.',
    bodyHtml,
    signOff: 'See you inside,',
    footerNote: 'This is an automated account email. Please do not reply.',
  });
}
