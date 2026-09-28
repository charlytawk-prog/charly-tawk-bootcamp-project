import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const { version }: { version: string } = require(`${process.cwd()}/package.json`);

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  version: string;
  commit: string;
  uptimeSeconds: number;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const metadata = {
      version,
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
      uptimeSeconds: Math.floor(process.uptime()),
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', ...metadata };
    } catch {
      return { status: 'degraded', database: 'down', ...metadata };
    }
  }
}
