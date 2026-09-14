import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
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
