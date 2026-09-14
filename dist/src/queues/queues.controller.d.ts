import { QueuesService } from './queues.service';
export declare class QueuesController {
    private readonly queuesService;
    constructor(queuesService: QueuesService);
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
