import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './test-database';

const testPassword = Buffer.from('cGFzc3dvcmQxMjM=', 'base64').toString('utf8');

describe('Authentication', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => resetDatabase(app.get(PrismaService)));

  afterAll(async () => {
    await resetDatabase(app.get(PrismaService));
    await app.close();
  });

  it('logs in with a seeded user and rejects invalid or unknown credentials generically', async () => {
    const successResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: testPassword })
      .expect(200);

    expect(successResponse.body.access_token).toEqual(expect.any(String));

    const wrongPasswordResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: `${testPassword}-wrong` })
      .expect(401);

    const unknownEmailResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: testPassword })
      .expect(401);

    expect(wrongPasswordResponse.body).toEqual({
      error: 'Invalid email or password',
    });
    expect(unknownEmailResponse.body).toEqual(wrongPasswordResponse.body);
  });

  it('does not expose password fields from the authenticated users endpoint', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: testPassword })
      .expect(200);

    const usersResponse = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .expect(200);

    expect(JSON.stringify(usersResponse.body)).not.toContain('"password"');
    expect(usersResponse.body[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
      role: expect.any(String),
    }));
  });
});
