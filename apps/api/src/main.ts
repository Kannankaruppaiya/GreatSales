import './load-env'; // MUST be first — see load-env.ts (RLS role correctness).
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { initObservability } from './observability';

async function bootstrap() {
  // Before the app is created: a crash during module init is exactly the kind
  // of failure that otherwise leaves no trace anywhere.
  initObservability();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Behind a reverse proxy, X-Forwarded-For is only trustworthy once Express
  // is told how many hops to trust — and rate limiting plus the auth audit
  // trail both depend on the real client IP.
  const trustProxy = config.get<string>('TRUST_PROXY') ?? 'false';
  app.set(
    'trust proxy',
    trustProxy === 'true'
      ? true
      : trustProxy === 'false'
        ? false
        : /^\d+$/.test(trustProxy)
          ? Number(trustProxy)
          : trustProxy,
  );

  app.use(helmet());
  // The refresh token travels as an httpOnly cookie; without this the auth
  // controller cannot read it back.
  app.use(cookieParser());

  // Credentialed CORS forbids a wildcard origin — a browser rejects
  // `Access-Control-Allow-Origin: *` when credentials are included — so an
  // explicit allow-list is required for the cookie flow to work at all.
  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? '*';
  const corsSuffix = (config.get<string>('CORS_ORIGIN_SUFFIX') ?? '').trim();
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  if (corsOrigin === '*' && !corsSuffix && nodeEnv !== 'development') {
    throw new Error(
      `CORS_ORIGIN="*" is not permitted when NODE_ENV="${nodeEnv}". ` +
        'Credentialed requests require an explicit origin allow-list, or a ' +
        'CORS_ORIGIN_SUFFIX for subdomain-per-tenant deployments.',
    );
  }

  const exactOrigins =
    corsOrigin === '*'
      ? []
      : corsOrigin
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);

  /**
   * Subdomain-per-tenant means the set of valid origins cannot be enumerated
   * ahead of time — a new tenant must work without a redeploy. Matching is
   * done on the parsed HOSTNAME (never the raw string) and requires https, so
   * `https://x.app.example.io.attacker.com` cannot slip past a naive
   * `endsWith`. The leading dot in the suffix supplies the label boundary,
   * which is what stops `evil-app.example.io` matching `.app.example.io`.
   */
  const matchesSuffix = (origin: string): boolean => {
    if (!corsSuffix) return false;
    try {
      const url = new URL(origin);
      if (url.protocol !== 'https:') return false;
      return url.hostname.endsWith(corsSuffix);
    } catch {
      return false; // unparseable Origin header — not ours
    }
  };

  app.enableCors({
    origin:
      corsOrigin === '*' && !corsSuffix
        ? true // dev only: reflect the requesting origin
        : (origin, callback) => {
            // No Origin header: same-origin navigation or a non-browser
            // client. There is no cookie-theft vector to defend against here.
            if (!origin) return callback(null, true);
            if (exactOrigins.includes(origin)) return callback(null, true);
            if (matchesSuffix(origin)) return callback(null, true);
            // Refuse by withholding the Allow-Origin header, which is what a
            // browser enforces. Passing an Error instead turned every
            // cross-origin probe — preflight included — into a 500, which is
            // a server fault in the logs for what is a correct refusal.
            return callback(null, false);
          },
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter());

  // The explorer enumerates every endpoint and its shape, including routes an
  // attacker has not found. It is opt-in, and the env contract refuses to let
  // it be enabled when NODE_ENV=production at all.
  const swaggerEnabled = config.get<boolean>('SWAGGER_ENABLED') === true;
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('GreatSales API')
      .setDescription('Multi-tenant sales CRM API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `GreatSales API on http://localhost:${port}/api/v1` +
      (swaggerEnabled ? ' (docs: /api/docs)' : ' (docs disabled)'),
  );
}
// Explicitly voided: nothing can await the top-level bootstrap, and an
// unhandled rejection here must surface as a process-level failure so the
// orchestrator restarts the task rather than leaving it half-started.
void bootstrap();
