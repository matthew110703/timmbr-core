import { escapeHtml } from '@/invoice/pdf/invoice-html.template';
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

export function inviteUserEmailTemplate(
  firstName: string,
  role: string,
  inviteUrl: string,
): string {
  const formattedRole =
    role.toUpperCase() === 'ADMIN'
      ? 'Console Admin'
      : role.toUpperCase() === 'STAFF'
        ? 'Companion Staff'
        : escapeHtml(role);

  const bodyHtml = emailStack([
    emailIntro(
      emailGreeting(firstName),
      `You have been invited to join Timmbr as <strong>${formattedRole}</strong>. Click the button below to set your password and activate your account.`,
    ),
    emailStack(
      [
        emailButton('Set Your Password', inviteUrl),
        emailMutedText(
          'This link expires in 24 hours. After setting your password, sign in with your email and new credentials.',
        ),
      ],
      12,
    ),
    emailStack(
      [
        emailFallbackLink('Button not working? Open or copy this link:', inviteUrl),
        EMAIL_DIVIDER,
        emailMutedText(
          'If you weren&rsquo;t expecting this invitation, you can safely ignore this email.',
        ),
      ],
      18,
    ),
  ]);

  return renderEmailLayout({
    title: 'You&rsquo;re invited to join Timmbr',
    preheader: `You&rsquo;ve been invited to join Timmbr as ${formattedRole}. This link expires in 24 hours.`,
    heroTitle: 'Welcome to Timmbr.',
    heroSubtitle: 'Make yourself at home.',
    bodyHtml,
    signOff: 'Welcome aboard,',
    footerNote: 'This is an automated account email. Please do not reply.',
  });
}
