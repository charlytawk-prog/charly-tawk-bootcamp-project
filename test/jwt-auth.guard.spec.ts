import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';

const createContext = (headers: Record<string, string | string[] | undefined>) => {
  const request: { headers: typeof headers; user?: unknown } = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
};

describe('JwtAuthGuard', () => {
  it('rejects a request without a bearer token', async () => {
    const guard = new JwtAuthGuard({ verifyAsync: jest.fn() } as unknown as JwtService);
    const { context } = createContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token that fails signature verification', async () => {
    const verifyAsync = jest.fn().mockRejectedValue(new Error('invalid signature'));
    const guard = new JwtAuthGuard({ verifyAsync } as unknown as JwtService);
    const { context } = createContext({ authorization: 'Bearer garbage-token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyAsync).toHaveBeenCalledWith('garbage-token');
  });

  it('attaches a verified JWT payload to the request', async () => {
    const payload = { sub: 'user-1', role: 'Employee' };
    const verifyAsync = jest.fn().mockResolvedValue(payload);
    const guard = new JwtAuthGuard({ verifyAsync } as unknown as JwtService);
    const { context, request } = createContext({ authorization: 'Bearer verified-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });
});
