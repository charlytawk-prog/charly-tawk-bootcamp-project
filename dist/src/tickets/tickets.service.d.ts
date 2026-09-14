import { PrismaService } from '../prisma/prisma.service';
export declare class TicketsService {
    private readonly prisma;
    private readonly ticketStatuses;
    constructor(prisma: PrismaService);
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
    updateTicket(id: string, nextStatus?: string): Promise<{
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
export {};
