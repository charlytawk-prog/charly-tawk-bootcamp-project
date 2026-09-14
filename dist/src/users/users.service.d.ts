import { PrismaService } from '../prisma/prisma.service';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAllUsers(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        email: string;
        role: string;
    }[]>;
    getUserById(id: string): Promise<{
        id: string;
        name: string;
        email: string;
        role: string;
    }>;
    createUser(body: CreateUserBody): Promise<{
        id: string;
        name: string;
        email: string;
        role: string;
    }>;
}
interface CreateUserBody {
    name?: string;
    email?: string;
    role?: string;
}
export {};
