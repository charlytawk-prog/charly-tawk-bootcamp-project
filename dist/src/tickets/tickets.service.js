"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TicketsService = class TicketsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.ticketStatuses = ['Submitted', 'Pending Review', 'Routed'];
    }
    getAllTickets() {
        return this.prisma.ticket.findMany();
    }
    async createTicket(body) {
        if (!(await this.prisma.user.findUnique({ where: { id: body.userId ?? '' } }))) {
            throw new common_1.BadRequestException({ error: 'Invalid userId: no such user exists' });
        }
        if (!(await this.prisma.departmentQueue.findUnique({ where: { id: body.queueId ?? '' } }))) {
            throw new common_1.BadRequestException({ error: 'Invalid queueId: no such queue exists' });
        }
        return this.prisma.ticket.create({
            data: {
                id: `ticket-${Date.now()}`,
                title: body.title,
                description: body.description,
                status: 'Submitted',
                priority: body.priority || 'medium',
                userId: body.userId,
                queueId: body.queueId,
                createdAt: new Date(),
            },
        });
    }
    async updateTicket(id, nextStatus) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id } });
        if (!ticket) {
            throw new common_1.NotFoundException({ error: 'Ticket not found' });
        }
        if (!nextStatus) {
            throw new common_1.BadRequestException({ error: 'Status is required' });
        }
        const currentStatusIndex = this.ticketStatuses.indexOf(ticket.status);
        if (currentStatusIndex === -1
            || this.ticketStatuses.indexOf(nextStatus) !== currentStatusIndex + 1) {
            throw new common_1.BadRequestException({
                error: `Invalid transition: cannot move from '${ticket.status}' to '${nextStatus}' directly`,
            });
        }
        return this.prisma.ticket.update({
            where: { id },
            data: { status: nextStatus },
        });
    }
    async deleteTicket(id) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id } });
        if (!ticket) {
            throw new common_1.NotFoundException({ error: 'Ticket not found' });
        }
        const deletedTicket = await this.prisma.ticket.delete({ where: { id } });
        return { message: 'Ticket deleted successfully', ticket: deletedTicket };
    }
};
exports.TicketsService = TicketsService;
exports.TicketsService = TicketsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TicketsService);
//# sourceMappingURL=tickets.service.js.map