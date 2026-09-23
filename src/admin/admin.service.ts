import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VALID_TICKET_PRIORITIES } from '../ai/ai-provider.interface';

const TICKET_STATUSES = ['Submitted', 'Pending Review', 'Routed', 'In Progress', 'Resolved'] as const;
const USER_ROLES = ['Employee', 'Department Agent', 'System Admin'] as const;
const DEPARTMENTS = ['IT', 'HR', 'Finance'] as const;

@Injectable()
export class AdminService {
  private readonly ticketRelations = {
    queue: { select: { id: true, name: true, department: true } },
    user: { select: { id: true, name: true } },
    attachments: {
      select: { id: true, filename: true, mimetype: true, size: true, uploadedAt: true },
      orderBy: { uploadedAt: 'asc' as const },
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  getTickets(filters: { department?: string; status?: string; search?: string }) {
    const search = filters.search?.trim();
    return this.prisma.ticket.findMany({
      where: {
        ...(filters.department ? { queue: { department: filters.department } } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(search ? { OR: [{ id: { contains: search } }, { title: { contains: search } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: this.ticketRelations,
    });
  }

  async updateTicket(id: string, updates: AdminTicketUpdate) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException({ error: 'Ticket not found' });
    }

    if (updates.queueId !== undefined) {
      const queue = await this.prisma.departmentQueue.findUnique({ where: { id: updates.queueId } });
      if (!queue) {
        throw new BadRequestException({ error: 'Invalid queueId: no such queue exists' });
      }
    }

    const data: { queueId?: string; priority?: string; status?: string } = {};
    if (updates.queueId !== undefined) data.queueId = updates.queueId;
    if (updates.priority !== undefined) data.priority = this.normalizePriority(updates.priority);
    if (updates.status !== undefined) data.status = this.validateStatus(updates.status);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({ error: 'At least one ticket field is required' });
    }

    return this.prisma.ticket.update({
      where: { id },
      data,
      include: this.ticketRelations,
    });
  }

  getUsers() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, department: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateUser(id: string, updates: AdminUserUpdate) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({ error: 'User not found' });
    }

    const role = updates.role !== undefined ? this.validateRole(updates.role) : user.role;
    let department = updates.department !== undefined
      ? this.validateDepartment(updates.department)
      : user.department;

    if (role === 'Department Agent' && !department) {
      throw new BadRequestException({ error: 'Department Agent users require a department' });
    }
    if (role !== 'Department Agent') {
      department = null;
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(updates.role !== undefined ? { role } : {}),
        ...(updates.department !== undefined || updates.role !== undefined ? { department } : {}),
      },
      select: { id: true, name: true, email: true, role: true, department: true },
    });
  }

  private normalizePriority(value: string) {
    const match = VALID_TICKET_PRIORITIES.find((priority) => priority.toLowerCase() === value.trim().toLowerCase());
    if (!match) {
      throw new BadRequestException({ error: `Invalid priority: ${value}` });
    }
    return match.toLowerCase();
  }

  private validateStatus(value: string) {
    const match = TICKET_STATUSES.find((status) => status.toLowerCase() === value.trim().toLowerCase());
    if (!match) {
      throw new BadRequestException({ error: `Invalid status: ${value}` });
    }
    return match;
  }

  private validateRole(value: string) {
    if (!USER_ROLES.includes(value as typeof USER_ROLES[number])) {
      throw new BadRequestException({ error: `Invalid role: ${value}` });
    }
    return value;
  }

  private validateDepartment(value: string | null) {
    if (value === null) return null;
    if (!DEPARTMENTS.includes(value as typeof DEPARTMENTS[number])) {
      throw new BadRequestException({ error: `Invalid department: ${value}` });
    }
    return value;
  }
}

interface AdminTicketUpdate {
  queueId?: string;
  priority?: string;
  status?: string;
}

interface AdminUserUpdate {
  role?: string;
  department?: string | null;
}
