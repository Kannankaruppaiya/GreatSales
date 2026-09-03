import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '@greatsales/shared';
import { CurrentUser } from '../common/decorators';
import { LookupsService } from './lookups.service';

@ApiTags('lookups')
@ApiBearerAuth()
@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  @Get()
  all(@CurrentUser() user: RequestUser) {
    return this.lookups.all(user);
  }
}
