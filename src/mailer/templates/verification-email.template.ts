export function verificationEmailTemplate(firstName: string, verificationUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verify your Timmbr account</title>
</head>
<body style="margin:0; padding:0; background-color:#ECE3D2; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    Confirm your email to start furnishing your space with Timmbr. This link expires in 24 hours.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ECE3D2; padding:40px 0;">
    <tr>
      <td align="center">

        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#F7F1E6; border-radius:12px; overflow:hidden; max-width:480px; width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:44px 40px 8px 40px;">
              <img src="https://pub-dc2a8fc90be54a65b2d2000bed9fc8d2.r2.dev/Timmbr_Logo_OnCream.png"
                   width="160" alt="Timmbr"
                   style="display:block; width:160px; height:auto;">
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <div style="height:1px; background-color:#E3D7C2; width:100%;"></div>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td align="center" style="padding:32px 40px 0 40px;">
              <h1 style="margin:0; font-size:22px; line-height:30px; color:#3A2E22; font-weight:700;">
                Confirm your email address
              </h1>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td align="center" style="padding:16px 40px 0 40px;">
              <p style="margin:0; font-size:15px; line-height:24px; color:#6B5F4F;">
                Hi ${firstName}, welcome to Timmbr. We're glad you're here.
                Click the button below to verify your email and sign in to your account.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:32px 40px 8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:8px; background-color:#D16731;">
                    <a href="${verificationUrl}" target="_blank" style="display:inline-block; padding:14px 36px; font-size:15px; font-weight:600; color:#F7F1E6; text-decoration:none; border-radius:8px;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td align="center" style="padding:8px 40px 0 40px;">
              <p style="margin:0; font-size:13px; line-height:20px; color:#9B8F7A;">
                This link expires in 24 hours.
              </p>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td align="center" style="padding:24px 40px 0 40px;">
              <p style="margin:0; font-size:12px; line-height:18px; color:#9B8F7A; word-break:break-all;">
                Button not working? Copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color:#D16731; text-decoration:underline;">${verificationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Ignore note -->
          <tr>
            <td align="center" style="padding:28px 40px 0 40px;">
              <p style="margin:0; font-size:12px; line-height:18px; color:#B4A98E;">
                If you didn't create a Timmbr account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <tr><td style="padding-bottom:40px;"></td></tr>

        </table>

        <!-- Footer -->
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
