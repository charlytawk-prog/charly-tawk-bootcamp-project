import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { TicketsService } from './tickets.service';

@Controller('api/tickets')
export class TicketsController {
	constructor(private readonly ticketsService: TicketsService) {}

	@Get()
	getAllTickets() {
		return this.ticketsService.getAllTickets();
	}

	@Post()
	createTicket(@Body() body: CreateTicketBody) {
		return this.ticketsService.createTicket(body);
	}

	@Put(':id')
	updateTicket(@Param('id') id: string, @Body() body: UpdateTicketBody) {
		return this.ticketsService.updateTicket(id, body.status);
	}

	@Delete(':id')
	deleteTicket(@Param('id') id: string) {
		return this.ticketsService.deleteTicket(id);
	}
}

interface CreateTicketBody {
	title?: string;
	description?: string;
	priority?: string;
	userId?: string;
	queueId?: string;
}

interface UpdateTicketBody {
	status?: string;
}
