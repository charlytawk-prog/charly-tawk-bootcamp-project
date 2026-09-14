"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    await prisma.ticket.deleteMany();
    await prisma.departmentQueue.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.createMany({
        data: [
            { id: 'user-1', name: 'Alice Smith', email: 'alice@example.com', role: 'customer' },
            { id: 'user-2', name: 'Bob Jones', email: 'bob@example.com', role: 'agent' },
            { id: 'user-3', name: 'Charlie Admin', email: 'charlie@example.com', role: 'admin' },
        ],
    });
    await prisma.departmentQueue.createMany({
        data: [
            {
                id: 'queue-1',
                name: 'Technical Support',
                description: 'Hardware and software troubleshooting',
            },
            {
                id: 'queue-2',
                name: 'Billing & Invoicing',
                description: 'Payment issues and subscription inquiries',
            },
        ],
    });
    await prisma.ticket.create({
        data: {
            id: 'ticket-1',
            title: 'Cannot connect to VPN',
            description: 'User is getting a timeout error when trying to access the corporate VPN.',
            status: 'Submitted',
            priority: 'high',
            userId: 'user-1',
            queueId: 'queue-1',
            createdAt: new Date('2026-09-04T08:00:00.000Z'),
        },
    });
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map