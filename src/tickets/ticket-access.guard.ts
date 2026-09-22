import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtUser } from '../auth/jwt-auth.guard';
import { TicketsService } from './tickets.service';

// Allows the ticket's owner OR a department agent from the ticket's own department queue.
@Injectable()
export class TicketAccessGuard implements CanActivate {
	constructor(private readonly ticketsService: TicketsService) {}

	async canActivate(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<{
			params: { id: string };
			user?: JwtUser;
		}>();
		const ticket = await this.ticketsService.getTicketById(request.params.id);
		const user = request.user;

		if (typeof user?.sub !== 'string' || !user.sub) {
			throw new UnauthorizedException({ error: 'Missing authenticated user' });
		}

		const isOwner = ticket.userId === user.sub;
		const isDepartmentAgent = user.role === 'Department Agent' && user.department === ticket.queue.department;

		if (!isOwner && !isDepartmentAgent) {
			throw new ForbiddenException({
				error: 'Forbidden: you do not have access to this ticket',
			});
		}

		return true;
	}
}
