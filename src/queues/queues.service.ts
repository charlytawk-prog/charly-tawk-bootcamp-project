import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QueuesService {
	constructor(private readonly prisma: PrismaService) {}

	getAllQueues() {
		return this.prisma.departmentQueue.findMany();
	}

	async getQueueById(id: string) {
		const queue = await this.prisma.departmentQueue.findUnique({ where: { id } });

		if (!queue) {
			throw new NotFoundException({ error: 'Queue not found' });
		}

		return queue;
	}
}
