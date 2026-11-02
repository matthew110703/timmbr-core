import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Browser, chromium } from 'playwright';
import { TIMMBR_BRAND_LOGO_URL } from '@/mailer/templates/constants';
import { InvoiceWithItems } from '../invoice.repository';
import { INVOICE_TEMPLATE_VERSION_V1 } from '../queue/invoice.queue.constants';
import { InvoiceTemplateAssets, renderInvoiceHtmlV1 } from './invoice-html.template';

@Injectable()
export class PdfRendererService implements OnApplicationShutdown {
  private readonly logger = new Logger(PdfRendererService.name);
  private browserPromise: Promise<Browser> | null = null;
  private cachedAssets: InvoiceTemplateAssets | null = null;
  private logoDataUriPromise: Promise<string> | null = null;

  /**
   * Resolves the brand logo URL (`TIMMBR_BRAND_LOGO_URL`) and template assets synchronously.
   */
  loadBundledAssets(): InvoiceTemplateAssets {
    if (this.cachedAssets) {
      return this.cachedAssets;
    }

    if (!TIMMBR_BRAND_LOGO_URL) {
      throw new Error('Missing required TIMMBR_BRAND_LOGO_URL constant for invoice rendering.');
    }

    this.cachedAssets = {
      logoDataUri: TIMMBR_BRAND_LOGO_URL,
      fontCss: '',
    };

    return this.cachedAssets;
  }

  /**
   * Pre-fetches and caches the brand logo as a `data:` URI once per worker process so Playwright
   * renders completely in-memory without making live external HTTP requests on every PDF render.
   * Falls back to `TIMMBR_BRAND_LOGO_URL` if offline or in test environments.
   */
  private async resolveBundledAssets(): Promise<InvoiceTemplateAssets> {
    const baseAssets = this.loadBundledAssets();
    if (baseAssets.logoDataUri?.startsWith('data:')) {
      return baseAssets;
    }

    if (!this.logoDataUriPromise) {
      this.logoDataUriPromise = fetch(TIMMBR_BRAND_LOGO_URL, {
        signal: AbortSignal.timeout(3_000),
      })
        .then(async (res) => {
          if (!res.ok) return TIMMBR_BRAND_LOGO_URL;
          const contentType = res.headers.get('content-type') || 'image/png';
          const buf = Buffer.from(await res.arrayBuffer());
          return `data:${contentType};base64,${buf.toString('base64')}`;
        })
        .catch(() => TIMMBR_BRAND_LOGO_URL);
    }

    const resolvedUri = await this.logoDataUriPromise;
    this.cachedAssets = {
      ...baseAssets,
      logoDataUri: resolvedUri,
    };
    return this.cachedAssets;
  }

  /**
   * Renders an immutable Invoice record to an A4 PDF Buffer using Playwright Chromium.
   * Reuses a single Chromium browser instance per worker process and creates an isolated context per render.
   */
  async renderInvoicePdf(invoice: InvoiceWithItems): Promise<Buffer> {
    const assets = await this.resolveBundledAssets();
    const html = this.renderHtmlForTemplateVersion(invoice, assets);

    const browser = await this.getBrowser();
    const context = await browser.newContext();

    try {
      // Allow only data:, about:, and the whitelisted TIMMBR_BRAND_LOGO_URL during PDF rendering
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('data:') || url.startsWith('about:') || url === TIMMBR_BRAND_LOGO_URL) {
          return route.continue();
        }
        return route.abort();
      });

      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'load' });

      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="width: 100%; font-size: 9px; font-family: Arial, sans-serif; color: #888888; padding: 0 18mm; text-align: right;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        `,
      });

      return Buffer.from(pdfBytes);
    } finally {
      await context
        .close()
        .catch((err) =>
          this.logger.warn({ err }, 'Failed to close Playwright browser context cleanly'),
        );
    }
  }

  private renderHtmlForTemplateVersion(
    invoice: InvoiceWithItems,
    assets: InvoiceTemplateAssets,
  ): string {
    const version = invoice.templateVersion || INVOICE_TEMPLATE_VERSION_V1;
    switch (version) {
      case INVOICE_TEMPLATE_VERSION_V1:
        return renderInvoiceHtmlV1({ invoice, assets });
      default:
        throw new Error(
          `Unsupported invoice templateVersion "${version}" on invoice ${invoice.id}.`,
        );
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browserPromise) {
      const existing = await this.browserPromise.catch(() => null);
      if (existing && existing.isConnected()) {
        return existing;
      }
      this.browserPromise = null;
    }

    this.browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      return await this.browserPromise;
    } catch (error) {
      this.browserPromise = null;
      this.logger.error({ err: error }, 'Failed to launch Playwright Chromium browser');
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.browserPromise) return;
    const browser = await this.browserPromise.catch(() => null);
    this.browserPromise = null;
    if (browser) {
      await browser
        .close()
        .catch((err) =>
          this.logger.warn({ err }, 'Failed to close Playwright Chromium browser on shutdown'),
        );
    }
  }
}
