import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Liveness. Cheap, no dependencies — a failure here means the process is
   * wedged and should be RESTARTED.
   */
  @Public()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness — process is running' })
  health() {
    return this.appService.liveness();
  }

  /**
   * Readiness. Checks the database, and answers **503** when it cannot be
   * reached, so the load balancer stops routing here instead of sending
   * requests to an instance that will fail every one of them.
   *
   * The status code is what orchestrators act on — the body is for humans, so
   * it must not be the only signal. Written through `@Res({ passthrough })`
   * because the code varies per call.
   */
  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness — dependencies reachable' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const state = await this.appService.readiness();
    res.status(
      state.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );
    return state;
  }
}
