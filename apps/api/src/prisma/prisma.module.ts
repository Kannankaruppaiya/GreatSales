import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

/**
 * Global so any feature module can inject PrismaService without re-importing.
 * The client is built from the validated DATABASE_URL (greatsales_app role).
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: (config: ConfigService) =>
        new PrismaService(config.getOrThrow<string>('DATABASE_URL')),
      inject: [ConfigService],
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
