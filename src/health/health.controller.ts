import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('api/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    const health = await this.healthService.check();
    if (health.status === 'degraded') {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }
}
