export function otpEmailTemplate(firstName: string | null, otpCode: string): string {
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Timmbr verification code</title>
</head>
<body style="margin:0; padding:0; background-color:#ECE3D2; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    Your Timmbr verification code is ${otpCode}. This code expires in 10 minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ECE3D2; padding:40px 0;">
    <tr>
      <td align="center">

        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#F7F1E6; border-radius:12px; overflow:hidden; max-width:480px; width:100%; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

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
                Your Verification Code
              </h1>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td align="center" style="padding:16px 40px 0 40px;">
              <p style="margin:0; font-size:15px; line-height:24px; color:#6B5F4F;">
                ${greeting} Use the verification code below to securely sign in to your Timmbr account.
              </p>
            </td>
          </tr>

          <!-- OTP Code Box -->
          <tr>
            <td align="center" style="padding:28px 40px 8px 40px;">
              <div style="display:inline-block; padding:16px 36px; font-size:32px; font-weight:700; letter-spacing:8px; color:#3A2E22; background-color:#ECE3D2; border-radius:8px; border:1px solid #E3D7C2;">
                ${otpCode}
              </div>
            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td align="center" style="padding:12px 40px 0 40px;">
              <p style="margin:0; font-size:13px; line-height:20px; color:#9B8F7A;">
                This code expires in 10 minutes. Please do not share it with anyone.
              </p>
            </td>
          </tr>

          <!-- Ignore note -->
          <tr>
            <td align="center" style="padding:24px 40px 0 40px;">
              <p style="margin:0; font-size:12px; line-height:18px; color:#B4A98E;">
                If you didn't request this verification code, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <tr><td style="padding-bottom:40px;"></td></tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}
