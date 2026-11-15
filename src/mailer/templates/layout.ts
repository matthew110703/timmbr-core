import { escapeHtml } from '@/invoice/pdf/invoice-html.template';
import {
  EMAIL_BRAND_COLOR,
  EMAIL_BRAND_GRADIENT_END,
  EMAIL_THEME,
  EmailThemeRole,
  FONT_SANS,
  FONT_SCRIPT,
  FONT_SERIF_DISPLAY,
  TIMMBR_BRAND_LOGO_URL,
  TIMMBR_HOUSE_HEART_URL,
} from './constants';

/** Every field is HTML: callers escape any dynamic value before passing it in. */
export interface EmailLayoutParams {
  title: string;
  preheader: string;
  heroTitle: string;
  heroSubtitle: string;
  bodyHtml: string;
  signOff: string;
  footerNote: string;
}

const MOBILE_BREAKPOINT_PX = 620;

const themeEntries = Object.entries(EMAIL_THEME) as Array<
  [EmailThemeRole, (typeof EMAIL_THEME)[EmailThemeRole]]
>;

function darkRules(selectorPrefix: string, roles: typeof themeEntries): string {
  return roles
    .map(
      ([role, token]) =>
        `${selectorPrefix}.t-${role} { ${token.property}: ${token.dark} !important; }`,
    )
    .join('\n');
}

const textRoles = themeEntries.filter(([, token]) => token.property === 'color');
const surfaceRoles = themeEntries.filter(([, token]) => token.property !== 'color');

const EMAIL_STYLESHEET = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
${darkRules('', themeEntries)}
.t-icon { filter: invert(1) !important; }
}
${darkRules('[data-ogsc] ', textRoles)}
${darkRules('[data-ogsb] ', surfaceRoles)}
[data-ogsc] .t-icon { filter: invert(1) !important; }
@media (max-width: ${MOBILE_BREAKPOINT_PX}px) {
.r-outer { padding-left: 16px !important; padding-right: 16px !important; }
.r-inner { padding-left: 24px !important; padding-right: 24px !important; }
.r-hero-title { font-size: 36px !important; }
.r-hero-subtitle { font-size: 26px !important; }
.r-logo { width: 160px !important; }
.r-ticket-number { font-size: 24px !important; }
.r-code { font-size: 40px !important; }
}`;

export function renderEmailLayout(p: EmailLayoutParams): string {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${p.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400&family=DM+Serif+Display&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${EMAIL_STYLESHEET}
</style>
</head>
<body class="t-page" style="margin:0; padding:0; background-color:${EMAIL_THEME.page.light}; font-family:${FONT_SANS};">

  <div style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; mso-hide:all;">
    ${p.preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="t-page" style="background-color:${EMAIL_THEME.page.light};">
    <tr>
      <td align="center" class="r-outer" style="padding:32px 40px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

          <tr>
            <td style="padding:26px 0;">
              <img src="${TIMMBR_BRAND_LOGO_URL}"
                   width="212" alt="Timmbr" class="r-logo"
                   style="display:block; width:212px; max-width:100%; height:auto; border:0;">
            </td>
          </tr>

          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="t-card" style="background-color:${EMAIL_THEME.card.light}; border-radius:12px; overflow:hidden;">

                <tr>
                  <td bgcolor="${EMAIL_BRAND_COLOR}" class="r-inner" style="background:linear-gradient(to right, ${EMAIL_BRAND_COLOR}, ${EMAIL_BRAND_GRADIENT_END}); padding:30px 40px;">
                    <p class="r-hero-title" style="margin:0 0 8px 0; font-family:${FONT_SERIF_DISPLAY}; font-size:48px; line-height:1.3; color:#ffffff; font-weight:400;">
                      ${p.heroTitle}
                    </p>
                    <p class="r-hero-subtitle" style="margin:0; font-family:${FONT_SCRIPT}; font-size:32px; line-height:1.1; color:#ffffff; font-weight:400;">
                      ${p.heroSubtitle}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td height="5" bgcolor="${EMAIL_BRAND_COLOR}" style="background:linear-gradient(to right, ${EMAIL_BRAND_COLOR}, ${EMAIL_BRAND_GRADIENT_END}); font-size:0; line-height:0;">
                    &nbsp;
                  </td>
                </tr>

                <tr>
                  <td class="r-inner" style="padding:30px 40px; font-family:${FONT_SANS};">
                    ${p.bodyHtml}
                  </td>
                </tr>

                <tr>
                  <td class="t-band r-inner" style="background-color:${EMAIL_THEME.band.light}; padding:22px 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="middle">
                          <p class="t-body" style="margin:0 0 4px 0; font-family:${FONT_SCRIPT}; font-size:24px; font-weight:400; line-height:normal; color:${EMAIL_THEME.body.light};">
                            ${p.signOff}
                          </p>
                          <p class="t-strong" style="margin:0; font-family:${FONT_SANS}; font-size:12px; line-height:1.3; color:${EMAIL_THEME.strong.light}; font-weight:600; opacity:0.9;">
                            The Timmbr team
                          </p>
                        </td>
                        <td width="38" valign="middle" align="right">
                          <img src="${TIMMBR_HOUSE_HEART_URL}" width="38" height="38" alt="" class="t-icon"
                               style="display:block; width:38px; height:38px; border:0;">
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding-top:12px;">
              <p class="t-muted" style="margin:0 0 10px 0; font-family:${FONT_SANS}; font-size:12px; line-height:1.3; color:${EMAIL_THEME.muted.light}; font-weight:300; text-align:center;">
                ${p.footerNote}
              </p>
              <p class="t-muted" style="margin:0; font-family:${FONT_SANS}; font-size:12px; line-height:1.3; color:${EMAIL_THEME.muted.light}; font-weight:300; text-align:center;">
                &copy; ${year} Timmbr. All rights reserved.
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

export function emailGreeting(firstName: string | null | undefined): string {
  const name = firstName?.trim();
  return name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
}

/** Stacks blocks vertically with a fixed gap; tables because Outlook ignores margins on divs. */
export function emailStack(blocks: string[], gapPx = 24): string {
  const rows = blocks
    .map((block, index) => {
      const padding = index < blocks.length - 1 ? ` style="padding-bottom:${gapPx}px;"` : '';
      return `<tr><td${padding}>${block}</td></tr>`;
    })
    .join('\n');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows}
</table>`;
}

export function emailIntro(greetingHtml: string, messageHtml: string): string {
  return `<p class="t-strong" style="margin:0 0 6px 0; font-family:${FONT_SANS}; font-size:18px; line-height:1.3; color:${EMAIL_THEME.strong.light}; font-weight:600;">
  ${greetingHtml}
</p>
<p class="t-body" style="margin:0; font-family:${FONT_SANS}; font-size:16px; line-height:1.3; color:${EMAIL_THEME.body.light}; font-weight:500;">
  ${messageHtml}
</p>`;
}

export function emailNoteTitle(html: string): string {
  return `<p class="t-strong" style="margin:0 0 4px 0; font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:${EMAIL_THEME.strong.light}; font-weight:600;">
  ${html}
</p>`;
}

export function emailMutedText(html: string): string {
  return `<p class="t-muted" style="margin:0; font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:${EMAIL_THEME.muted.light}; font-weight:400;">
  ${html}
</p>`;
}

export function emailNote(titleHtml: string, textHtml: string): string {
  return `${emailNoteTitle(titleHtml)}
${emailMutedText(textHtml)}`;
}

export function emailIconRow(iconUrl: string, contentHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td width="20" valign="top" style="padding-right:12px; font-size:0; line-height:0;">
      <img src="${iconUrl}" width="20" height="20" alt="" class="t-icon"
           style="display:block; width:20px; height:20px; border:0;">
    </td>
    <td valign="top">
      ${contentHtml}
    </td>
  </tr>
</table>`;
}

export const EMAIL_DIVIDER = `<div class="t-divider" style="height:1px; background-color:${EMAIL_THEME.divider.light}; width:100%; line-height:1px; font-size:1px;">&nbsp;</div>`;

export function emailButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" bgcolor="${EMAIL_BRAND_COLOR}" style="border-radius:8px; background-color:${EMAIL_BRAND_COLOR};">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block; padding:14px 32px; font-family:${FONT_SANS}; font-size:16px; line-height:1.2; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

export function emailFallbackLink(leadHtml: string, href: string): string {
  const safeHref = escapeHtml(href);
  return `<p class="t-muted" style="margin:0; font-family:${FONT_SANS}; font-size:12px; line-height:1.5; color:${EMAIL_THEME.muted.light}; font-weight:400;">
  ${leadHtml}<br>
  <a href="${safeHref}" target="_blank" class="t-link" style="color:${EMAIL_THEME.link.light}; text-decoration:underline; word-break:break-all;">${safeHref}</a>
</p>`;
}
