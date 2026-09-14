import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';

@Injectable()
export class TicketOwnerGuard implements CanActivate {
	constructor(private readonly ticketsService: TicketsService) {}

	async canActivate(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<{
			params: { id: string };
			headers: Record<string, string | string[] | undefined>;
		}>();
		const ticket = await this.ticketsService.getTicketById(request.params.id);
		const userId = request.headers['x-user-id'];

		if (typeof userId !== 'string' || !userId) {
			throw new UnauthorizedException({ error: 'Missing x-user-id header' });
		}

		if (ticket.userId !== userId) {
			throw new ForbiddenException({
				error: 'Forbidden: you do not have access to this ticket',
			});
		}

		return true;
	}
}