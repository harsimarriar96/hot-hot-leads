import { ConfigService } from '@nestjs/config';

/** Absolute link into the web app for invite / reset flows. */
export function publicUrl(config: ConfigService): string {
  const configured = config.get<string>('app.publicUrl');
  return (configured ?? 'http://localhost:5173').replace(/\/+$/, '');
}

export const inviteUrl = (config: ConfigService, token: string): string =>
  `${publicUrl(config)}/accept-invite?token=${encodeURIComponent(token)}`;

export const resetUrl = (config: ConfigService, token: string): string =>
  `${publicUrl(config)}/reset-password?token=${encodeURIComponent(token)}`;
