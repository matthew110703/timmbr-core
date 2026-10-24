import {
  FONT_SANS,
  FONT_SCRIPT,
  FONT_SERIF_DISPLAY,
  TIMMBR_BRAND_LOGO_URL,
  TIMMBR_HOUSE_HEART_URL,
  TIMMBR_OTP_CLOCK_ICON_URL,
  TIMMBR_OTP_SHIELD_ICON_URL,
  OTP_EMAIL_TICKET_NOTCH_SVG,
} from './constants';

export function otpEmailTemplate(
  firstName: string | null,
  otpCode: string,
  expiryMinutes: number,
): string {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Timmbr login code</title>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400&family=DM+Serif+Display&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#f4efeb; font-family:${FONT_SANS};">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    Your Timmbr login code is ${otpCode}. Valid for ${expiryMinutes} minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4efeb;">
    <tr>
      <td align="center" style="padding:32px 40px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

          <tr>
            <td style="padding:26px 0;">
              <img src="${TIMMBR_BRAND_LOGO_URL}"
                   width="212" alt="Timmbr"
                   style="display:block; width:212px; max-width:100%; height:auto;">
            </td>
          </tr>

          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffefc; border-radius:12px; overflow:hidden;">

                <tr>
                  <td bgcolor="#9a502e" style="background:linear-gradient(to right, #9a502e, #d39375); padding:30px 40px;">
                    <p style="margin:0 0 8px 0; font-family:${FONT_SERIF_DISPLAY}; font-size:48px; line-height:1.3; color:#ffffff; font-weight:400;">
                      Let&rsquo;s log you in.
                    </p>
                    <p style="margin:0; font-family:${FONT_SCRIPT}; font-size:32px; line-height:1.1; color:#ffffff; font-weight:400;">
                      Make yourself at home.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td height="5" bgcolor="#9a502e" style="background:linear-gradient(to right, #9a502e, #d39375); font-size:0; line-height:0;">
                    &nbsp;
                  </td>
                </tr>

                <tr>
                  <td style="padding:30px 40px; font-family:${FONT_SANS};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                      <tr>
                        <td style="padding-bottom:24px;">
                          <p style="margin:0 0 6px 0; font-family:${FONT_SANS}; font-size:18px; line-height:1.3; color:#232323; font-weight:600;">
                            ${greeting}
                          </p>
                          <p style="margin:0; font-family:${FONT_SANS}; font-size:16px; line-height:1.3; color:#3c3c3c; font-weight:500;">
                            Enter this one time password on the Timmbr login screen to securely sign in to your account.
                          </p>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding-bottom:24px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f1e6; border-radius:6px;">
                            <tr>
                              <td style="padding:12px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td width="7" valign="middle" align="right" style="font-size:0; line-height:0; padding:0;">
                                      ${OTP_EMAIL_TICKET_NOTCH_SVG}
                                    </td>
                                    <td style="border:1px dashed #e0b29d; border-radius:6px; padding:22px 20px 20px 20px; text-align:center;">
                                      <p style="margin:0 0 17px 0; font-family:${FONT_SANS}; font-size:12px; line-height:normal; color:#525252; font-weight:700; letter-spacing:0.02em;">
                                        YOUR LOGIN CODE
                                      </p>
                                      <p style="margin:0 0 17px 0; font-family:${FONT_SANS}; font-size:48px; line-height:1.1; color:#232323; font-weight:700; letter-spacing:0.04em;">
                                        ${otpCode}
                                      </p>
                                      <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                                        <tr>
                                          <td valign="middle" style="padding-right:6px; font-size:0; line-height:0;">
                                            <img src="${TIMMBR_OTP_CLOCK_ICON_URL}" width="14" height="14" alt=""
                                                 style="display:block; width:14px; height:14px; border:0;">
                                          </td>
                                          <td valign="middle" style="font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:#232323; font-weight:500;">
                                            Valid for ${expiryMinutes} minutes &bull; Use only once
                                          </td>
                                        </tr>
                                      </table>
                                    </td>
                                    <td width="7" valign="middle" align="left" style="font-size:0; line-height:0; padding:0;">
                                      ${OTP_EMAIL_TICKET_NOTCH_SVG}
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="20" valign="top" style="padding-right:12px; font-size:0; line-height:0;">
                                <img src="${TIMMBR_OTP_SHIELD_ICON_URL}" width="20" height="20" alt=""
                                     style="display:block; width:20px; height:20px; border:0;">
                              </td>
                              <td valign="top">
                                <p style="margin:0 0 4px 0; font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:#232323; font-weight:600;">
                                  Just for you. Never share this code.
                                </p>
                                <p style="margin:0; font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:#746762; font-weight:400;">
                                  Timmbr will never ask you for your OTP by phone, email or message.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:18px 0;">
                          <div style="height:1px; background-color:#e7d6cf; width:100%; line-height:1px; font-size:1px;">&nbsp;</div>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <p style="margin:0 0 4px 0; font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:#232323; font-weight:600;">
                            Didn&rsquo;t request this code?
                          </p>
                          <p style="margin:0; font-family:${FONT_SANS}; font-size:14px; line-height:1.3; color:#746762; font-weight:400;">
                            You can safely ignore this email. Without this code, this login request can&rsquo;t be completed.
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="background-color:#f5ede0; padding:22px 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="middle">
                          <p style="margin:0 0 4px 0; font-family:${FONT_SCRIPT}; font-size:24px; font-style:normal; font-weight:400; line-height:normal; color:#3C3C3C;">
                            See you inside,
                          </p>
                          <p style="margin:0; font-family:${FONT_SANS}; font-size:12px; line-height:1.3; color:#232323; font-weight:600; opacity:0.9;">
                            The Timmbr team
                          </p>
                        </td>
                        <td width="38" valign="middle" align="right">
                          <img src="${TIMMBR_HOUSE_HEART_URL}" width="38" height="38" alt=""
                               style="display:block; width:38px; height:38px;">
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
              <p style="margin:0 0 10px 0; font-family:${FONT_SANS}; font-size:12px; line-height:1.3; color:#746762; font-weight:300; text-align:center;">
                This is an automated account email. Please do not reply.
              </p>
              <p style="margin:0; font-family:${FONT_SANS}; font-size:12px; line-height:1.3; color:#746762; font-weight:300; text-align:center;">
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
