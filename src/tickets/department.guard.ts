import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtUser } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      params: { queueId?: string; id?: string };
      user?: JwtUser;
    }>();
    const user = request.user;

    if (user?.role !== 'Department Agent' || !user.department) {
      throw new ForbiddenException({
        error: 'Department Agent access required',
      });
    }

    const queueId = request.params.queueId;
    if (!queueId && !request.params.id) {
      return true;
    }

    const ticket = request.params.id
      ? await this.prisma.ticket.findUnique({ where: { id: request.params.id } })
      : null;
    const resolvedQueueId = queueId ?? ticket?.queueId;
    const queue = resolvedQueueId
      ? await this.prisma.departmentQueue.findUnique({ where: { id: resolvedQueueId } })
      : null;

    if (!queue || queue.department !== user.department) {
      throw new ForbiddenException({
        error: 'Forbidden: queue is outside your department',
      });
    }

    return true;
  }
}
