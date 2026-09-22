import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Put,
	Req,
	Res,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DepartmentGuard } from './department.guard';
import { TicketAccessGuard } from './ticket-access.guard';
import { TicketOwnerGuard } from './ticket-owner.guard';
import { TicketsService } from './tickets.service';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

@Controller('api/tickets')
export class TicketsController {
	constructor(private readonly ticketsService: TicketsService) {}

	@Get()
	getAllTickets() {
		return this.ticketsService.getAllTickets();
	}

	@Get('queue')
	@UseGuards(JwtAuthGuard, DepartmentGuard)
	getDepartmentQueue(@Req() request: DepartmentRequest) {
		return this.ticketsService.getTicketsByDepartment(request.user.department as string);
	}

	@Get('mine')
	@UseGuards(JwtAuthGuard)
	getMyTickets(@Req() request: AuthenticatedRequest) {
		return this.ticketsService.getTicketsByUserId(request.user.sub);
	}

	@Get('queue/:queueId')
	@UseGuards(JwtAuthGuard, DepartmentGuard)
	getQueue(@Param('queueId') queueId: string) {
		return this.ticketsService.getTicketsByQueueId(queueId);
	}

	@Get(':id')
	@UseGuards(JwtAuthGuard, TicketAccessGuard)
	getTicket(@Param('id') id: string) {
		return this.ticketsService.getTicketById(id);
	}

	@Post()
	createTicket(@Body() body: CreateTicketBody) {
		return this.ticketsService.createTicket(body);
	}

	@Put(':id')
	updateTicket(@Param('id') id: string, @Body() body: UpdateTicketBody) {
		return this.ticketsService.updateTicket(id, body.status);
	}

	@Patch(':id/status')
	@UseGuards(JwtAuthGuard, DepartmentGuard)
	updateAgentTicketStatus(@Param('id') id: string, @Body() body: UpdateTicketBody) {
		return this.ticketsService.updateTicket(id, body.status);
	}

	@Patch(':id/edit')
	@UseGuards(JwtAuthGuard, TicketOwnerGuard)
	editTicket(@Param('id') id: string, @Body() body: EditTicketBody) {
		return this.ticketsService.editTicket(id, body);
	}

	@Delete(':id')
	deleteTicket(@Param('id') id: string) {
		return this.ticketsService.deleteTicket(id);
	}

	@Post(':id/attachments')
	@UseGuards(JwtAuthGuard, TicketAccessGuard)
	@UseInterceptors(
		FileInterceptor('file', {
			storage: diskStorage({
				destination: UPLOAD_DIR,
				filename: (_request, file, callback) => {
					callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
				},
			}),
		}),
	)
	async uploadAttachment(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
		if (!file) {
			throw new BadRequestException({ error: 'A file is required' });
		}

		return this.ticketsService.createAttachment(id, {
			filename: file.originalname,
			storedPath: file.path,
			mimetype: file.mimetype,
			size: file.size,
		});
	}

	@Get(':id/attachments/:attachmentId')
	@UseGuards(JwtAuthGuard, TicketAccessGuard)
	async downloadAttachment(
		@Param('id') id: string,
		@Param('attachmentId') attachmentId: string,
		@Res() response: Response,
	) {
		const attachment = await this.ticketsService.getAttachment(id, attachmentId);
		response.download(attachment.storedPath, attachment.filename);
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

interface EditTicketBody {
	title?: string;
	description?: string;
	priority?: string;
}

interface DepartmentRequest {
	user: {
		department?: string;
	};
}

interface AuthenticatedRequest {
	user: {
		sub: string;
	};
}
