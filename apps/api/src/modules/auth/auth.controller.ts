import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { Public } from './public.decorator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request): { token: string } {
    const key = req.ip ?? 'unknown';
    if (this.auth.isLockedOut(key)) {
      throw new HttpException('Too many failed attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!this.auth.verifyPassword(dto.password)) {
      this.auth.recordFailure(key);
      throw new UnauthorizedException('Invalid password');
    }
    this.auth.clearFailures(key);
    return { token: this.auth.issueToken() };
  }

  /** Cheap "is my token still valid" probe for the web app. */
  @Get('me')
  me(): { ok: true } {
    return { ok: true };
  }
}
