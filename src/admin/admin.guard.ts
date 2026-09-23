import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtUser } from '../auth/jwt-auth.guard';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();

    if (request.user?.role !== 'System Admin') {
      throw new ForbiddenException({ error: 'System Admin access required' });
    }

    return true;
  }
}
