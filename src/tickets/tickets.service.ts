import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketsService {
	private readonly ticketStatuses = ['Submitted', 'Pending Review', 'Routed', 'In Progress', 'Resolved'];
	private readonly editableStatuses = ['Submitted', 'Pending Review', 'Routed'];
	private readonly ticketRelations = {
		queue: true,
		user: { select: { id: true, name: true } },
		attachments: {
			select: { id: true, filename: true, mimetype: true, size: true, uploadedAt: true },
			orderBy: { uploadedAt: 'asc' as const },
		},
	};

	constructor(private readonly prisma: PrismaService) {}

	getAllTickets() {
		return this.prisma.ticket.findMany({ include: this.ticketRelations });
	}

	getTicketsByDepartment(department: string) {
		return this.prisma.ticket.findMany({
			where: { queue: { department } },
			orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
			include: this.ticketRelations,
		});
	}

	getTicketsByQueueId(queueId: string) {
		return this.prisma.ticket.findMany({ where: { queueId }, include: this.ticketRelations });
	}

	getTicketsByUserId(userId: string) {
		return this.prisma.ticket.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			include: this.ticketRelations,
		});
	}

	getTicketById(id: string) {
		return this.prisma.ticket.findUnique({ where: { id }, include: this.ticketRelations }).then((ticket) => {
			if (!ticket) {
				throw new NotFoundException({ error: 'Ticket not found' });
			}

			return ticket;
		});
	}

	async createTicket(body: CreateTicketBody) {
		if (!(await this.prisma.user.findUnique({ where: { id: body.userId ?? '' } }))) {
			throw new BadRequestException({ error: 'Invalid userId: no such user exists' });
		}

		if (!(await this.prisma.departmentQueue.findUnique({ where: { id: body.queueId ?? '' } }))) {
			throw new BadRequestException({ error: 'Invalid queueId: no such queue exists' });
		}

		return this.prisma.ticket.create({
			data: {
				id: `ticket-${Date.now()}`,
				title: body.title as string,
				description: body.description as string,
				status: 'Submitted',
				priority: body.priority || 'medium',
				userId: body.userId as string,
				queueId: body.queueId as string,
				createdAt: new Date(),
			},
			include: this.ticketRelations,
		});
	}

	async updateTicket(id: string, nextStatus?: string) {
		const ticket = await this.prisma.ticket.findUnique({ where: { id } });

		if (!ticket) {
			throw new NotFoundException({ error: 'Ticket not found' });
		}

		if (!nextStatus) {
			throw new BadRequestException({ error: 'Status is required' });
		}

		const currentStatusIndex = this.ticketStatuses.indexOf(ticket.status);

		if (
			currentStatusIndex === -1
			|| this.ticketStatuses.indexOf(nextStatus) !== currentStatusIndex + 1
		) {
			throw new BadRequestException({
				error: `Invalid transition: cannot move from '${ticket.status}' to '${nextStatus}' directly`,
			});
		}

		return this.prisma.ticket.update({
			where: { id },
			data: { status: nextStatus },
			include: this.ticketRelations,
		});
	}

	async deleteTicket(id: string) {
		const ticket = await this.prisma.ticket.findUnique({ where: { id } });

		if (!ticket) {
			throw new NotFoundException({ error: 'Ticket not found' });
		}

		const deletedTicket = await this.prisma.ticket.delete({ where: { id }, include: this.ticketRelations });

		return { message: 'Ticket deleted successfully', ticket: deletedTicket };
	}

	async editTicket(id: string, updates: EditTicketBody) {
		const ticket = await this.prisma.ticket.findUnique({ where: { id } });

		if (!ticket) {
			throw new NotFoundException({ error: 'Ticket not found' });
		}

		if (!this.editableStatuses.includes(ticket.status)) {
			throw new ForbiddenException({
				error: 'This ticket is already being processed and can no longer be edited.',
			});
		}

		return this.prisma.ticket.update({
			where: { id },
			data: {
				...(updates.title !== undefined ? { title: updates.title } : {}),
				...(updates.description !== undefined ? { description: updates.description } : {}),
				...(updates.priority !== undefined ? { priority: updates.priority } : {}),
			},
			include: this.ticketRelations,
		});
	}

	async createAttachment(ticketId: string, file: { filename: string; storedPath: string; mimetype: string; size: number }) {
		const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });

		if (!ticket) {
			throw new NotFoundException({ error: 'Ticket not found' });
		}

		return this.prisma.attachment.create({
			data: {
				id: `attachment-${Date.now()}`,
				ticketId,
				filename: file.filename,
				storedPath: file.storedPath,
				mimetype: file.mimetype,
				size: file.size,
				uploadedAt: new Date(),
			},
			select: { id: true, filename: true, mimetype: true, size: true, uploadedAt: true },
		});
	}

	async getAttachment(ticketId: string, attachmentId: string) {
		const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });

		if (!attachment || attachment.ticketId !== ticketId) {
			throw new NotFoundException({ error: 'Attachment not found' });
		}

		return attachment;
	}
}

interface CreateTicketBody {
	title?: string;
	description?: string;
	priority?: string;
	userId?: string;
	queueId?: string;
}

interface EditTicketBody {
	title?: string;
	description?: string;
	priority?: string;
}
