import {
  EMAIL_DIVIDER,
  emailButton,
  emailFallbackLink,
  emailGreeting,
  emailIntro,
  emailMutedText,
  emailStack,
  renderEmailLayout,
} from './layout';

export function resetPasswordEmailTemplate(firstName: string, resetUrl: string): string {
  const bodyHtml = emailStack([
    emailIntro(
      emailGreeting(firstName),
      'We received a request to reset the password for your Timmbr account. Click the button below to choose a new password.',
    ),
    emailStack(
      [emailButton('Reset Password', resetUrl), emailMutedText('This link expires in 15 minutes.')],
      12,
    ),
    emailStack(
      [
        emailFallbackLink(
          'Button not working? Copy and paste this link into your browser:',
          resetUrl,
        ),
        EMAIL_DIVIDER,
        emailMutedText(
          'If you didn&rsquo;t request a password reset, you can safely ignore this email. Your password will remain unchanged.',
        ),
      ],
      18,
    ),
  ]);

  return renderEmailLayout({
    title: 'Reset your Timmbr password',
    preheader: 'Reset your Timmbr password. This link expires in 15 minutes.',
    heroTitle: 'Reset your password.',
    heroSubtitle: 'Back in a moment.',
    bodyHtml,
    signOff: 'See you inside,',
    footerNote: 'This is an automated account email. Please do not reply.',
  });
}
