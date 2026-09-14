import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketsService {
	private readonly ticketStatuses = ['Submitted', 'Pending Review', 'Routed'];

	constructor(private readonly prisma: PrismaService) {}

	getAllTickets() {
		return this.prisma.ticket.findMany();
	}

	getTicketById(id: string) {
		return this.prisma.ticket.findUnique({ where: { id } }).then((ticket) => {
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
		});
	}

	async deleteTicket(id: string) {
		const ticket = await this.prisma.ticket.findUnique({ where: { id } });

		if (!ticket) {
			throw new NotFoundException({ error: 'Ticket not found' });
		}

		const deletedTicket = await this.prisma.ticket.delete({ where: { id } });

		return { message: 'Ticket deleted successfully', ticket: deletedTicket };
	}
}

interface CreateTicketBody {
	title?: string;
	description?: string;
	priority?: string;
	userId?: string;
	queueId?: string;
}
