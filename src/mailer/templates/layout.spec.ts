import { EMAIL_THEME } from './constants';
import { renderEmailLayout } from './layout';

describe('renderEmailLayout', () => {
  const html = renderEmailLayout({
    title: 'Title',
    preheader: 'Inbox preview sentence',
    heroTitle: 'Hero.',
    heroSubtitle: 'Subtitle.',
    bodyHtml: '<p>Body</p>',
    signOff: 'Bye,',
    footerNote: 'Automated.',
  });

  it('swaps every theme token to its dark value under prefers-color-scheme: dark', () => {
    const darkBlock = /@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}/.exec(html)?.[1];
    expect(darkBlock).toBeDefined();

    for (const [role, token] of Object.entries(EMAIL_THEME)) {
      expect(darkBlock).toMatch(
        new RegExp(`\\.t-${role}\\s*\\{\\s*${token.property}:\\s*${token.dark}`),
      );
    }
  });

  it('renders the preheader in a hidden element', () => {
    const style = /<div style="([^"]*)">\s*Inbox preview sentence/.exec(html)?.[1];

    expect(style).toContain('display:none');
  });

  it('renders the caller content', () => {
    expect(html).toContain('<p>Body</p>');
    expect(html).toContain('Hero.');
    expect(html).toContain('Bye,');
    expect(html).toContain('Automated.');
  });
});
