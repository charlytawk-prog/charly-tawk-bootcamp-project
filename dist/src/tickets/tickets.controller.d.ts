import { TicketsService } from './tickets.service';
export declare class TicketsController {
    private readonly ticketsService;
    constructor(ticketsService: TicketsService);
    getAllTickets(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        title: string;
        description: string;
        status: string;
        priority: string;
        createdAt: Date;
        userId: string;
        queueId: string;
    }[]>;
    createTicket(body: CreateTicketBody): Promise<{
        id: string;
        title: string;
        description: string;
        status: string;
        priority: string;
        createdAt: Date;
        userId: string;
        queueId: string;
    }>;
    updateTicket(id: string, body: UpdateTicketBody): Promise<{
        id: string;
        title: string;
        description: string;
        status: string;
        priority: string;
        createdAt: Date;
        userId: string;
        queueId: string;
    }>;
    deleteTicket(id: string): Promise<{
        message: string;
        ticket: {
            id: string;
            title: string;
            description: string;
            status: string;
            priority: string;
            createdAt: Date;
            userId: string;
            queueId: string;
        };
    }>;
}
interface CreateTicketBody {
    title?: string;
    description?: string;
    priority?: string;
    userId?: string;
    queueId?: string;
}
interface UpdateTicketBody {
    status?: string;
}
export {};
