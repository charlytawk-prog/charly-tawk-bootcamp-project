import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

	getAllUsers() {
		return this.prisma.user.findMany({
			select: { id: true, name: true, email: true, role: true, department: true },
		});
	}

	async getUserById(id: string) {
		const user = await this.prisma.user.findUnique({
			where: { id },
			select: { id: true, name: true, email: true, role: true, department: true },
		});

		if (!user) {
			throw new NotFoundException({ error: 'User not found' });
		}

		return user;
	}

}
