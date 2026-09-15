import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import { TicketsService } from '../src/tickets/tickets.service';
import request = require('supertest');
import { resetDatabase } from './test-database';

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

    it('allows the owner and rejects a different user end to end', async () => {
      const ownerResponse = await request(app.getHttpServer())
        .get('/api/tickets/ticket-1')
        .set('x-user-id', 'user-1')
        .expect(200);
      expect(ownerResponse.body).toMatchObject({ id: 'ticket-1', userId: 'user-1' });

      const forbiddenResponse = await request(app.getHttpServer())
        .get('/api/tickets/ticket-1')
        .set('x-user-id', 'user-2')
        .expect(403);
      expect(forbiddenResponse.body).toEqual({
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
    });
  });
});