import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { APP_CONFIG } from '@/config/app.config';
import { env } from '@/config/env';

export function setupSwagger(app: NestFastifyApplication): void {
  if (env.NODE_ENV === 'prod') return;

  for (const version of APP_CONFIG.versions) {
    const config = new DocumentBuilder()
      .setTitle(`${APP_CONFIG.name} v${version}`)
      .setVersion(version)
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    // Keep only paths for this version + version-neutral paths (no /vN/ segment)
    const thisVersion = new RegExp(`/v${version}/`);
    const anyVersion = /\/v\d+\//;
    document.paths = Object.fromEntries(
      Object.entries(document.paths).filter(
        ([path]) => thisVersion.test(path) || !anyVersion.test(path),
      ),
    );

    SwaggerModule.setup(`${APP_CONFIG.apiPrefix}/v${version}/docs`, app, document);
  }
}
