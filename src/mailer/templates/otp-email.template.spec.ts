import { OTP_TTL_S } from '@/auth/auth.constants';
import {
  FONT_SANS,
  FONT_SCRIPT,
  FONT_SERIF_DISPLAY,
  TIMMBR_BRAND_LOGO_URL,
  TIMMBR_HOUSE_HEART_URL,
  TIMMBR_OTP_CLOCK_ICON_URL,
  TIMMBR_OTP_SHIELD_ICON_URL,
} from './constants';
import { otpEmailTemplate } from './otp-email.template';

describe('otpEmailTemplate', () => {
  const expiryMinutes = Math.floor(OTP_TTL_S / 60);

  it('includes the OTP code, asset URLs, and dynamic expiry copy', () => {
    const html = otpEmailTemplate(null, '482691', expiryMinutes);

    expect(html).toContain('482691');
    expect(html).toContain(TIMMBR_BRAND_LOGO_URL);
    expect(html).toContain(TIMMBR_HOUSE_HEART_URL);
    expect(html).toContain(TIMMBR_OTP_CLOCK_ICON_URL);
    expect(html).toContain(TIMMBR_OTP_SHIELD_ICON_URL);
    expect(html).toContain(`Valid for ${expiryMinutes} minutes`);
    expect(html).toContain('Hi there,');
    expect(html).toContain('Let&rsquo;s log you in.');
    expect(html).toContain('YOUR LOGIN CODE');
    expect(html).toContain('Just for you. Never share this code.');
    expect(html).toContain(FONT_SCRIPT);
    expect(html).toContain(FONT_SERIF_DISPLAY);
    expect(html).toContain(FONT_SANS);
    expect(html).not.toContain('cursive');
  });

  it('uses a personalized greeting when first name is provided', () => {
    const html = otpEmailTemplate('Dany', '123456', expiryMinutes);

    expect(html).toContain('Hi Dany,');
  });
});
