import { Controller, Get, Param } from '@nestjs/common';
import { QueuesService } from './queues.service';

@Controller('api/queues')
export class QueuesController {
	constructor(private readonly queuesService: QueuesService) {}

	@Get()
	getAllQueues() {
		return this.queuesService.getAllQueues();
	}

	@Get(':id')
	getQueueById(@Param('id') id: string) {
		return this.queuesService.getQueueById(id);
	}
}
