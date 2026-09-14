import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get()
	getAllUsers() {
		return this.usersService.getAllUsers();
	}

	@Get(':id')
	getUserById(@Param('id') id: string) {
		return this.usersService.getUserById(id);
	}

	@Post()
	createUser(@Body() body: CreateUserBody) {
		return this.usersService.createUser(body);
	}
}

interface CreateUserBody {
	name?: string;
	email?: string;
	role?: string;
}
