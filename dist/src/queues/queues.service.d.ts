import { PrismaService } from '../prisma/prisma.service';
export declare class QueuesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAllQueues(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        description: string | null;
        name: string;
    }[]>;
    getQueueById(id: string): Promise<{
        id: string;
        description: string | null;
        name: string;
    }>;
}
