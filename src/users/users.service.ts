import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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

	async createUser(body: CreateUserBody) {
		if (!body.name || !body.email || !body.password) {
			throw new BadRequestException({ error: 'Name, email, and password are required' });
		}

		return this.prisma.user.create({
			data: {
				id: `user-${Date.now()}`,
				name: body.name,
				email: body.email,
				role: body.role || 'Employee',
				password: await bcrypt.hash(body.password, 10),
			},
			select: { id: true, name: true, email: true, role: true, department: true },
		});
	}
}

interface CreateUserBody {
	name?: string;
	email?: string;
	role?: string;
	password?: string;
}
