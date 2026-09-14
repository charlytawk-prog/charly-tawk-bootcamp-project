import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

	getAllUsers() {
		return this.prisma.user.findMany();
	}

	async getUserById(id: string) {
		const user = await this.prisma.user.findUnique({ where: { id } });

		if (!user) {
			throw new NotFoundException({ error: 'User not found' });
		}

		return user;
	}

	async createUser(body: CreateUserBody) {
		if (!body.name || !body.email) {
			throw new BadRequestException({ error: 'Name and email are required' });
		}

		return this.prisma.user.create({
			data: {
				id: `user-${Date.now()}`,
				name: body.name,
				email: body.email,
				role: body.role || 'customer',
			},
		});
	}
}

interface CreateUserBody {
	name?: string;
	email?: string;
	role?: string;
}
