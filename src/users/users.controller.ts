import { Controller, Get, Param } from '@nestjs/common';
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

}
