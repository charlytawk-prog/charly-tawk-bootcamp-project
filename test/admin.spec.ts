import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './test-database';

const testPassword = Buffer.from('cGFzc3dvcmQxMjM=', 'base64').toString('utf8');

describe('System Admin capabilities', () => {
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

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: testPassword })
      .expect(200);
    return { Authorization: `Bearer ${response.body.access_token}` };
  }

  it('lets an admin list all tickets across multiple departments', async () => {
    const headers = await login('charlie@example.com');

    const response = await request(app.getHttpServer())
      .get('/api/admin/tickets')
      .set(headers)
      .expect(200);

    expect(response.body).toHaveLength(5);
    expect(new Set(response.body.map((ticket: { queue: { department: string } }) => ticket.queue.department)))
      .toEqual(new Set(['IT', 'Finance', 'HR']));
    expect(response.body[0].user).toEqual({ id: 'user-1', name: 'Alice Smith' });
    expect(response.body[0].queue).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
  });

  it('lets an admin filter tickets by department, status, and search', async () => {
    const headers = await login('charlie@example.com');
    const filtered = await request(app.getHttpServer())
      .get('/api/admin/tickets')
      .query({ department: 'Finance', status: 'Submitted', search: 'Payroll' })
      .set(headers)
      .expect(200);

    expect(filtered.body.map((ticket: { id: string }) => ticket.id)).toEqual(['ticket-2']);
  });

  it('lets an admin reassign a ticket to a different department queue', async () => {
    const headers = await login('charlie@example.com');

    const reassigned = await request(app.getHttpServer())
      .patch('/api/admin/tickets/ticket-1')
      .set(headers)
      .send({ queueId: 'queue-3', priority: 'Urgent' })
      .expect(200);

    expect(reassigned.body.queue).toEqual(expect.objectContaining({ id: 'queue-3', department: 'HR' }));
    expect(reassigned.body.priority).toBe('urgent');
  });

  it('lets an admin force a non-adjacent status transition', async () => {
    const headers = await login('charlie@example.com');

    const overridden = await request(app.getHttpServer())
      .patch('/api/admin/tickets/ticket-1')
      .set(headers)
      .send({ status: 'Resolved' })
      .expect(200);

    expect(overridden.body.status).toBe('Resolved');
  });

  it('rejects an invalid admin ticket status', async () => {
    const headers = await login('charlie@example.com');
    await request(app.getHttpServer())
      .patch('/api/admin/tickets/ticket-1')
      .set(headers)
      .send({ status: 'Closed' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/api/admin/tickets/ticket-1')
      .set(headers)
      .send({ queueId: 'queue-missing' })
      .expect(400);
  });

  it('returns 403 when an employee accesses admin ticket endpoints', async () => {
    const headers = await login('alice@example.com');

    await request(app.getHttpServer()).get('/api/admin/tickets').set(headers).expect(403);
    await request(app.getHttpServer()).patch('/api/admin/tickets/ticket-1').set(headers).send({ status: 'Resolved' }).expect(403);
  });

  it('returns 403 when an agent accesses admin ticket endpoints', async () => {
    const headers = await login('bob@example.com');

    await request(app.getHttpServer()).get('/api/admin/tickets').set(headers).expect(403);
    await request(app.getHttpServer()).patch('/api/admin/tickets/ticket-1').set(headers).send({ status: 'Resolved' }).expect(403);
  });

  it('lets an admin list users and update a user role and department', async () => {
    const headers = await login('charlie@example.com');

    const users = await request(app.getHttpServer())
      .get('/api/admin/users')
      .set(headers)
      .expect(200);

    expect(users.body).toHaveLength(5);
    expect(JSON.stringify(users.body)).not.toContain('password');

    const updated = await request(app.getHttpServer())
      .patch('/api/admin/users/user-1')
      .set(headers)
      .send({ role: 'Department Agent', department: 'Finance' })
      .expect(200);

    expect(updated.body).toMatchObject({ id: 'user-1', role: 'Department Agent', department: 'Finance' });
    expect(updated.body).not.toHaveProperty('password');

    const reverted = await request(app.getHttpServer())
      .patch('/api/admin/users/user-1')
      .set(headers)
      .send({ role: 'Employee' })
      .expect(200);

    expect(reverted.body).toMatchObject({ role: 'Employee', department: null });

    await request(app.getHttpServer())
      .patch('/api/admin/users/user-1')
      .set(headers)
      .send({ role: 'Not a role' })
      .expect(400);
  });

  it('returns 403 when an employee accesses user-management endpoints', async () => {
    const headers = await login('alice@example.com');

    await request(app.getHttpServer()).get('/api/admin/users').set(headers).expect(403);
    await request(app.getHttpServer()).patch('/api/admin/users/user-1').set(headers).send({ role: 'Department Agent' }).expect(403);
  });

  it('returns 403 when an agent accesses user-management endpoints', async () => {
    const headers = await login('bob@example.com');

    await request(app.getHttpServer()).get('/api/admin/users').set(headers).expect(403);
    await request(app.getHttpServer()).patch('/api/admin/users/user-1').set(headers).send({ role: 'Employee' }).expect(403);
  });
});
