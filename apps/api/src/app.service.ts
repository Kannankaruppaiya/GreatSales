import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      status: 'ok',
      service: 'greatsales-api',
      timestamp: new Date().toISOString(),
    };
  }
}
