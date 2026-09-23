import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tickets')
  getTickets(@Query() query: AdminTicketQuery) {
    return this.adminService.getTickets(query);
  }

  @Patch('tickets/:id')
  updateTicket(@Param('id') id: string, @Body() body: AdminTicketUpdateBody) {
    return this.adminService.updateTicket(id, body);
  }

  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() body: AdminUserUpdateBody) {
    return this.adminService.updateUser(id, body);
  }
}

interface AdminTicketQuery {
  department?: string;
  status?: string;
  search?: string;
}

interface AdminTicketUpdateBody {
  queueId?: string;
  priority?: string;
  status?: string;
}

interface AdminUserUpdateBody {
  role?: string;
  department?: string | null;
}
