import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { VALID_TICKET_PRIORITIES } from '../ai/ai-provider.interface';

const TICKET_STATUSES = ['Submitted', 'Pending Review', 'Routed', 'In Progress', 'Resolved'] as const;
const USER_ROLES = ['Employee', 'Department Agent', 'System Admin'] as const;
const DEPARTMENTS = ['IT', 'HR', 'Finance'] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  async createEmployee(body: CreateEmployeeBody) {
    const allowedFields = new Set(['name', 'email', 'password']);
    const unsupportedFields = Object.keys(body ?? {}).filter((field) => !allowedFields.has(field));
    if (unsupportedFields.length) {
      throw new BadRequestException({ error: `Unsupported fields: ${unsupportedFields.join(', ')}` });
    }
    if (typeof body?.name !== 'string' || !body.name.trim()) {
      throw new BadRequestException({ error: 'Name is required' });
    }
    if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim())) {
      throw new BadRequestException({ error: 'A valid email is required' });
    }
    if (typeof body.password !== 'string' || body.password.length < 8) {
      throw new BadRequestException({ error: 'Password must be at least 8 characters' });
    }

    const email = body.email.trim();
    const existingUser = await this.prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      throw new ConflictException({ error: 'Email address already exists' });
    }

    return this.prisma.user.create({
      data: {
        id: `user-${Date.now()}`,
        name: body.name.trim(),
        email,
        role: 'Employee',
        department: null,
        password: await bcrypt.hash(body.password, 10),
      },
      select: { id: true, name: true, email: true, role: true, department: true },
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

interface CreateEmployeeBody {
  name?: string;
  email?: string;
  password?: string;
}
