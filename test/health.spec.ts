import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const packageVersion = require('../package.json').version;

describe('Health endpoint', () => {
  let app: INestApplication;
  let queryRaw: jest.Mock;

  beforeAll(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns an unauthenticated healthy status when the database is reachable', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      database: 'up',
      version: packageVersion,
      commit: expect.any(String),
      uptimeSeconds: expect.any(Number),
    });
  });

  it('returns a sanitized degraded status when the database query fails', async () => {
    queryRaw.mockRejectedValue(new Error('sensitive connection details'));

    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(503);

    expect(response.body).toMatchObject({
      status: 'degraded',
      database: 'down',
      version: expect.any(String),
      commit: expect.any(String),
      uptimeSeconds: expect.any(Number),
    });
    expect(JSON.stringify(response.body)).not.toContain('sensitive connection details');
  });
});
