import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtUser {
  sub: string;
  role: string;
  department?: string;
}

type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: JwtUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = this.getBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException({ error: 'Missing or invalid Authorization header' });
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtUser>(token);
      if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
        throw new Error('Invalid JWT payload');
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException({ error: 'Invalid or expired token' });
    }
  }

  private getBearerToken(authorization?: string | string[]) {
    if (typeof authorization !== 'string') {
      return undefined;
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1];
  }
}
