import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import { TicketsService } from '../src/tickets/tickets.service';
import request = require('supertest');
import { resetDatabase } from './test-database';

const testPassword = Buffer.from('cGFzc3dvcmQxMjM=', 'base64').toString('utf8');

const invalidTransition = (from: string, to: string) =>
  `Invalid transition: cannot move from '${from}' to '${to}' directly`;

describe('Internal Operations Service Hub', () => {
  it('enforces the lifecycle transition rule in isolation', async () => {
    const prisma = {
      ticket: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ticket-unit', status: 'Submitted' }),
        update: jest.fn().mockResolvedValue({ id: 'ticket-unit', status: 'Pending Review' }),
      },
    } as unknown as PrismaService;
    const service = new TicketsService(prisma);

    await expect(service.updateTicket('ticket-unit', 'Pending Review')).resolves.toEqual({
      id: 'ticket-unit',
      status: 'Pending Review',
    });

    const error = await service.updateTicket('ticket-unit', 'Routed').catch((caught) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual({ error: invalidTransition('Submitted', 'Routed') });
  });

  describe('real database integration', () => {
    let prisma: PrismaService;

    beforeAll(async () => {
      prisma = new PrismaService();
      await prisma.$connect();
    });

    beforeEach(() => resetDatabase(prisma));

    afterAll(async () => {
      await resetDatabase(prisma);
      await prisma.$disconnect();
    });

    it('persists valid tickets and rejects a nonexistent user', async () => {
      const service = new TicketsService(prisma);
      const created = await service.createTicket({
        title: 'Integration ticket',
        description: 'Persist this request.',
        priority: 'urgent',
        userId: 'user-1',
        queueId: 'queue-1',
      });
      const stored = await prisma.ticket.findUnique({ where: { id: created.id } });

      expect(stored).toMatchObject({
        id: created.id,
        title: 'Integration ticket',
        description: 'Persist this request.',
        status: 'Submitted',
        priority: 'urgent',
        userId: 'user-1',
        queueId: 'queue-1',
      });
      expect(created.queue).toMatchObject({
        id: 'queue-1',
        name: 'Technical Support',
        department: 'IT',
      });
      expect(created.user).toEqual({ id: 'user-1', name: 'Alice Smith' });
      expect(created.user).not.toHaveProperty('password');
      expect(created.user).not.toHaveProperty('department');

      const error = await service.createTicket({
        title: 'Invalid ticket',
        description: 'This must not persist.',
        userId: 'user-999',
        queueId: 'queue-1',
      }).catch((caught) => caught);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toEqual({ error: 'Invalid userId: no such user exists' });
    });
  });

  describe('HTTP authorization', () => {
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

    it('allows the owner and rejects an unrelated user end to end', async () => {
      const ownerLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: testPassword })
        .expect(200);
      const unrelatedUserLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'helen@example.com', password: testPassword })
        .expect(200);

      const ownerResponse = await request(app.getHttpServer())
        .get('/api/tickets/ticket-1')
        .set('Authorization', `Bearer ${ownerLogin.body.access_token}`)
        .expect(200);
      expect(ownerResponse.body).toMatchObject({ id: 'ticket-1', userId: 'user-1' });
      expect(ownerResponse.body.queue).toMatchObject({
        id: 'queue-1',
        name: 'Technical Support',
        department: 'IT',
      });
      expect(ownerResponse.body.user).toEqual({ id: 'user-1', name: 'Alice Smith' });
      expect(ownerResponse.body.user).not.toHaveProperty('password');
      expect(ownerResponse.body.user).not.toHaveProperty('department');

      const forbiddenResponse = await request(app.getHttpServer())
        .get('/api/tickets/ticket-1')
        .set('Authorization', `Bearer ${unrelatedUserLogin.body.access_token}`)
        .expect(403);
      expect(forbiddenResponse.body).toEqual({
        error: 'Forbidden: you do not have access to this ticket',
      });

      await request(app.getHttpServer())
        .get('/api/tickets/ticket-1')
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/tickets/ticket-1')
        .set('Authorization', 'Bearer garbage-token')
        .expect(401);

      const missingTicketResponse = await request(app.getHttpServer())
        .get('/api/tickets/ticket-missing')
        .set('Authorization', `Bearer ${ownerLogin.body.access_token}`)
        .expect(404);
      expect(missingTicketResponse.body).toEqual({ error: 'Ticket not found' });
    });

    it('allows a same-department agent to view ticket detail', async () => {
      const itAgentLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'bob@example.com', password: testPassword })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/tickets/ticket-1')
        .set('Authorization', `Bearer ${itAgentLogin.body.access_token}`)
        .expect(200);
      expect(response.body).toMatchObject({ id: 'ticket-1', userId: 'user-1' });
    });

    it('keeps the existing PUT endpoint working through all five lifecycle states', async () => {
      const ownerLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: testPassword })
        .expect(200);
      const headers = { Authorization: `Bearer ${ownerLogin.body.access_token}` };

      for (const status of ['Pending Review', 'Routed', 'In Progress', 'Resolved']) {
        await request(app.getHttpServer())
          .put('/api/tickets/ticket-1')
          .set(headers)
          .send({ status })
          .expect(200);
      }

      const finalTicket = await request(app.getHttpServer())
        .get('/api/tickets/ticket-1')
        .set(headers)
        .expect(200);
      expect(finalTicket.body.status).toBe('Resolved');
    });

    it('scopes department agents to their own queue and rejects employees', async () => {
      const itAgentLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'bob@example.com', password: testPassword })
        .expect(200);
      const employeeLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: testPassword })
        .expect(200);

      const itQueueResponse = await request(app.getHttpServer())
        .get('/api/tickets/queue')
        .set('Authorization', `Bearer ${itAgentLogin.body.access_token}`)
        .expect(200);
      expect(itQueueResponse.body).toHaveLength(2);
      expect(itQueueResponse.body.map((ticket: { id: string }) => ticket.id)).toEqual(['ticket-4', 'ticket-1']);
      expect(itQueueResponse.body.every((ticket: { user: { id: string; name: string } }) =>
        ticket.user.id === 'user-1' && ticket.user.name === 'Alice Smith')).toBe(true);

      await request(app.getHttpServer())
        .get('/api/tickets/queue/queue-3')
        .set('Authorization', `Bearer ${itAgentLogin.body.access_token}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/tickets/queue')
        .set('Authorization', `Bearer ${employeeLogin.body.access_token}`)
        .expect(403);
    });

    it('returns only the authenticated user tickets in newest-first order', async () => {
      const employeeLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: testPassword })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/tickets/mine')
        .set('Authorization', `Bearer ${employeeLogin.body.access_token}`)
        .expect(200);

      expect(response.body.every((ticket: { userId: string }) => ticket.userId === 'user-1')).toBe(true);
      expect(response.body.every((ticket: { user: { id: string; name: string } }) =>
        ticket.user.id === 'user-1' && ticket.user.name === 'Alice Smith')).toBe(true);
      expect(response.body.map((ticket: { id: string }) => ticket.id)).toEqual([
        'ticket-5',
        'ticket-4',
        'ticket-3',
        'ticket-2',
        'ticket-1',
      ]);
    });

    it('allows agents to advance their department tickets and rejects other departments and employees', async () => {
      const itAgentLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'bob@example.com', password: testPassword })
        .expect(200);
      const hrAgentLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'helen@example.com', password: testPassword })
        .expect(200);
      const employeeLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: testPassword })
        .expect(200);

      const resolvedResponse = await request(app.getHttpServer())
        .patch('/api/tickets/ticket-4/status')
        .set('Authorization', `Bearer ${itAgentLogin.body.access_token}`)
        .send({ status: 'Resolved' })
        .expect(200);
      expect(resolvedResponse.body.status).toBe('Resolved');
      expect(resolvedResponse.body.user).toEqual({ id: 'user-1', name: 'Alice Smith' });

      await request(app.getHttpServer())
        .patch('/api/tickets/ticket-3/status')
        .set('Authorization', `Bearer ${itAgentLogin.body.access_token}`)
        .send({ status: 'In Progress' })
        .expect(403);

      await request(app.getHttpServer())
        .patch('/api/tickets/ticket-1/status')
        .set('Authorization', `Bearer ${hrAgentLogin.body.access_token}`)
        .send({ status: 'Resolved' })
        .expect(403);

      await request(app.getHttpServer())
        .patch('/api/tickets/ticket-3/status')
        .set('Authorization', `Bearer ${employeeLogin.body.access_token}`)
        .send({ status: 'In Progress' })
        .expect(403);
    });

    it('lets a same-department agent advance a ticket through the earlier lifecycle transitions', async () => {
      const itAgentLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'bob@example.com', password: testPassword })
        .expect(200);
      const hrAgentLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'helen@example.com', password: testPassword })
        .expect(200);

      // ticket-1 (Submitted) belongs to queue-1 / IT, so the IT agent should succeed on both early transitions.
      const pendingReviewResponse = await request(app.getHttpServer())
        .patch('/api/tickets/ticket-1/status')
        .set('Authorization', `Bearer ${itAgentLogin.body.access_token}`)
        .send({ status: 'Pending Review' })
        .expect(200);
      expect(pendingReviewResponse.body.status).toBe('Pending Review');

      const routedResponse = await request(app.getHttpServer())
        .patch('/api/tickets/ticket-1/status')
        .set('Authorization', `Bearer ${itAgentLogin.body.access_token}`)
        .send({ status: 'Routed' })
        .expect(200);
      expect(routedResponse.body.status).toBe('Routed');

      // ticket-2 (Submitted) belongs to queue-2 / Finance, so the HR agent must be denied.
      await request(app.getHttpServer())
        .patch('/api/tickets/ticket-2/status')
        .set('Authorization', `Bearer ${hrAgentLogin.body.access_token}`)
        .send({ status: 'Pending Review' })
        .expect(403);
    });
  });

  describe('Attachments', () => {
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

    it('lets the ticket owner upload an attachment and see it in the attachment list', async () => {
      const ownerLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: testPassword })
        .expect(200);

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/tickets/ticket-1/attachments')
        .set('Authorization', `Bearer ${ownerLogin.body.access_token}`)
        .attach('file', Buffer.from('test file contents'), 'notes.txt')
        .expect(201);

      expect(uploadResponse.body).toMatchObject({ filename: 'notes.txt', mimetype: 'text/plain' });
      expect(typeof uploadResponse.body.id).toBe('string');

      const ticketResponse = await request(app.getHttpServer())
        .get('/api/tickets/ticket-1')
        .set('Authorization', `Bearer ${ownerLogin.body.access_token}`)
        .expect(200);

      expect(ticketResponse.body.attachments).toHaveLength(1);
      expect(ticketResponse.body.attachments[0]).toMatchObject({
        id: uploadResponse.body.id,
        filename: 'notes.txt',
        mimetype: 'text/plain',
        size: 18,
      });
    });

    it('rejects an upload from an unrelated user', async () => {
      const unrelatedLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'helen@example.com', password: testPassword })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/api/tickets/ticket-1/attachments')
        .set('Authorization', `Bearer ${unrelatedLogin.body.access_token}`)
        .attach('file', Buffer.from('test file contents'), 'notes.txt')
        .expect(403);

      expect(response.body).toEqual({ error: 'Forbidden: you do not have access to this ticket' });
    });

    it('allows the owner to download an attachment and rejects an unrelated user', async () => {
      const ownerLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: testPassword })
        .expect(200);
      const unrelatedLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'helen@example.com', password: testPassword })
        .expect(200);

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/tickets/ticket-1/attachments')
        .set('Authorization', `Bearer ${ownerLogin.body.access_token}`)
        .attach('file', Buffer.from('test file contents'), 'notes.txt')
        .expect(201);

      const downloadResponse = await request(app.getHttpServer())
        .get(`/api/tickets/ticket-1/attachments/${uploadResponse.body.id}`)
        .set('Authorization', `Bearer ${ownerLogin.body.access_token}`)
        .expect(200);
      expect(downloadResponse.text).toBe('test file contents');

      const forbiddenDownload = await request(app.getHttpServer())
        .get(`/api/tickets/ticket-1/attachments/${uploadResponse.body.id}`)
        .set('Authorization', `Bearer ${unrelatedLogin.body.access_token}`)
        .expect(403);
      expect(forbiddenDownload.body).toEqual({ error: 'Forbidden: you do not have access to this ticket' });
    });

    it('lets a same-department agent upload and download an attachment', async () => {
      const agentLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'bob@example.com', password: testPassword })
        .expect(200);

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/tickets/ticket-1/attachments')
        .set('Authorization', `Bearer ${agentLogin.body.access_token}`)
        .attach('file', Buffer.from('agent uploaded file'), 'agent-notes.txt')
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/tickets/ticket-1/attachments/${uploadResponse.body.id}`)
        .set('Authorization', `Bearer ${agentLogin.body.access_token}`)
        .expect(200);
    });
  });

  describe('Employee self-edit', () => {
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

    it('lets the owner edit their own ticket while it is still Submitted', async () => {
      const ownerLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: testPassword })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch('/api/tickets/ticket-1/edit')
        .set('Authorization', `Bearer ${ownerLogin.body.access_token}`)
        .send({ title: 'Updated title', description: 'Updated description', priority: 'urgent' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'ticket-1',
        title: 'Updated title',
        description: 'Updated description',
        priority: 'urgent',
        status: 'Submitted',
      });
    });

    it('rejects editing once the ticket is In Progress', async () => {
      const ownerLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: testPassword })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch('/api/tickets/ticket-4/edit')
        .set('Authorization', `Bearer ${ownerLogin.body.access_token}`)
        .send({ title: 'Should not apply' })
        .expect(403);

      expect(response.body).toEqual({
        error: 'This ticket is already being processed and can no longer be edited.',
      });
    });

    it('rejects a non-owner attempting to edit', async () => {
      const unrelatedLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'bob@example.com', password: testPassword })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch('/api/tickets/ticket-1/edit')
        .set('Authorization', `Bearer ${unrelatedLogin.body.access_token}`)
        .send({ title: 'Should not apply' })
        .expect(403);

      expect(response.body).toEqual({
        error: 'Forbidden: you do not have access to this ticket',
      });
    });
  });

  describe('Week 2 lifecycle regression', () => {
    let prisma: PrismaService;

    beforeAll(async () => {
      prisma = new PrismaService();
      await prisma.$connect();
    });

    beforeEach(() => resetDatabase(prisma));

    afterAll(async () => {
      await resetDatabase(prisma);
      await prisma.$disconnect();
    });

    it('keeps the valid sequence and rejects moving backward', async () => {
      const service = new TicketsService(prisma);
      const created = await service.createTicket({
        title: 'Lifecycle regression ticket',
        description: 'Exercise every documented lifecycle step.',
        userId: 'user-1',
        queueId: 'queue-1',
      });

      await expect(service.updateTicket(created.id, 'Pending Review')).resolves.toMatchObject({
        status: 'Pending Review',
      });
      await expect(service.updateTicket(created.id, 'Routed')).resolves.toMatchObject({
        status: 'Routed',
      });

      const error = await service.updateTicket(created.id, 'Submitted').catch((caught) => caught);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toEqual({ error: invalidTransition('Routed', 'Submitted') });

      await expect(service.updateTicket(created.id, 'In Progress')).resolves.toMatchObject({
        status: 'In Progress',
      });
      await expect(service.updateTicket(created.id, 'Resolved')).resolves.toMatchObject({
        status: 'Resolved',
      });
    });
  });
});