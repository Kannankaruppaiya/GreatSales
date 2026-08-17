import './load-env'; // MUST be first — see load-env.ts (RLS role correctness).
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN') ?? '*',
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter());

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

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `GreatSales API on http://localhost:${port}/api/v1 (docs: /api/docs)`,
  );
}
bootstrap();
