import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const invalidCredentials = () =>
  new UnauthorizedException({ error: 'Invalid email or password' });

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email?: string, password?: string) {
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw invalidCredentials();
    }

    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw invalidCredentials();
    }

    return {
      access_token: await this.jwtService.signAsync({
        sub: user.id,
        role: user.role,
        department: user.department ?? undefined,
      }),
    };
  }
}
