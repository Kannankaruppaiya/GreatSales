import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuthGuard } from './platform-auth.guard';
import { ManagementsController } from './managements.controller';
import { ManagementsService } from './managements.service';
import { PlatformPrismaService } from './platform-prisma.service';

/**
 * The platform (owner / super-admin) surface — F14. Imports AuthModule to reuse
 * its token machinery (AuthService.issueSessionForUser) for the assume
 * token-exchange, so all JWT minting stays in one place.
 *
 * The privileged {@link PlatformPrismaService} (owner connection) is provided
 * HERE and nowhere else, so it can only be injected by platform code. It is
 * built from DIRECT_URL — required for the platform surface even though the
 * tenant API does not need it; the factory fails fast if it is absent.
 */
@Module({
  imports: [JwtModule.register({}), AuthModule],
  controllers: [PlatformAuthController, ManagementsController],
  providers: [
    PlatformAuthService,
    ManagementsService,
    PlatformAuthGuard,
    {
      provide: PlatformPrismaService,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DIRECT_URL');
        if (!url) {
          throw new Error(
            'DIRECT_URL is required for the platform (owner) surface: the ' +
              'privileged owner connection reads platform tables and lists ' +
              'tenants across RLS. Set it, or the platform module cannot start.',
          );
        }
        return new PlatformPrismaService(url);
      },
      inject: [ConfigService],
    },
  ],
})
export class PlatformModule {}
