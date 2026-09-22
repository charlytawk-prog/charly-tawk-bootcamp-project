import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const testPassword = Buffer.from('cGFzc3dvcmQxMjM=', 'base64').toString('utf8');

export async function resetDatabase(prisma: PrismaService) {
  await prisma.ticket.deleteMany();
  await prisma.departmentQueue.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash(testPassword, 10);

  await prisma.user.createMany({
    data: [
      { id: 'user-1', name: 'Alice Smith', email: 'alice@example.com', role: 'Employee', password },
      { id: 'user-2', name: 'Bob Jones', email: 'bob@example.com', role: 'Department Agent', department: 'IT', password },
      { id: 'user-3', name: 'Charlie Admin', email: 'charlie@example.com', role: 'System Admin', password },
      { id: 'user-4', name: 'Helen Agent', email: 'helen@example.com', role: 'Department Agent', department: 'HR', password },
      { id: 'user-5', name: 'Frank Agent', email: 'frank@example.com', role: 'Department Agent', department: 'Finance', password },
    ],
  });

  await prisma.departmentQueue.createMany({
    data: [
      { id: 'queue-1', name: 'Technical Support', department: 'IT', description: 'Hardware and software troubleshooting' },
      { id: 'queue-2', name: 'Billing & Invoicing', department: 'Finance', description: 'Payment issues and subscription inquiries' },
      { id: 'queue-3', name: 'HR Requests', department: 'HR', description: 'Human resources service requests' },
    ],
  });

  await prisma.ticket.create({
    data: {
      id: 'ticket-1',
      title: 'Cannot connect to VPN',
      description: 'User is getting a timeout error when trying to access the corporate VPN.',
      status: 'Submitted',
      priority: 'high',
      userId: 'user-1',
      queueId: 'queue-1',
      createdAt: new Date('2026-09-04T08:00:00.000Z'),
    },
  });

  await prisma.ticket.createMany({
    data: [
      {
        id: 'ticket-2',
        title: 'Payroll question',
        description: 'Question about a payroll deduction.',
        status: 'Submitted',
        priority: 'medium',
        userId: 'user-1',
        queueId: 'queue-2',
        createdAt: new Date('2026-09-04T09:00:00.000Z'),
      },
      {
        id: 'ticket-3',
        title: 'Employment verification letter',
        description: 'Request for an employment verification letter.',
        status: 'Submitted',
        priority: 'medium',
        userId: 'user-1',
        queueId: 'queue-3',
        createdAt: new Date('2026-09-04T10:00:00.000Z'),
      },
      {
        id: 'ticket-4',
        title: 'VPN access follow-up',
        description: 'Follow-up on a VPN access request.',
        status: 'In Progress',
        priority: 'urgent',
        userId: 'user-1',
        queueId: 'queue-1',
        createdAt: new Date('2026-09-05T08:00:00.000Z'),
      },
      {
        id: 'ticket-5',
        title: 'Invoice correction',
        description: 'Corrected vendor invoice request.',
        status: 'Resolved',
        priority: 'high',
        userId: 'user-1',
        queueId: 'queue-2',
        createdAt: new Date('2026-09-05T09:00:00.000Z'),
      },
    ],
  });
}