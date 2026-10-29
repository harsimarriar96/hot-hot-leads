import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

import { TelegramService } from './telegram.service';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { __esModule: true, ...actual, default: { post: jest.fn() } };
});

const post = axios.post as jest.Mock;

function httpError(status: number, description: string): AxiosError {
  return new AxiosError(description, 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data: { description },
  } as never);
}

function makeService(secret: string | undefined): TelegramService {
  const config = {
    get: (key: string) => (key === 'telegram.webhookSecret' ? secret : 'bot-token'),
  } as unknown as ConfigService;
  return new TelegramService(config);
}

describe('TelegramService.verifySecretToken', () => {
  it('rejects every request when no secret is configured', () => {
    const svc = makeService('');
    expect(svc.verifySecretToken('anything')).toBe(false);
    expect(svc.verifySecretToken(undefined)).toBe(false);
  });

  it('rejects a missing or mismatched header', () => {
    const svc = makeService('s3cret');
    expect(svc.verifySecretToken(undefined)).toBe(false);
    expect(svc.verifySecretToken('')).toBe(false);
    expect(svc.verifySecretToken('wrong')).toBe(false);
    expect(svc.verifySecretToken('s3cret-but-longer')).toBe(false);
  });

  it('accepts the exact secret Telegram echoes back', () => {
    const svc = makeService('s3cret');
    expect(svc.verifySecretToken('s3cret')).toBe(true);
  });
});

describe('TelegramService.send', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { ok: true } });
  });

  it('converts markdown to HTML and sends with parse_mode HTML', async () => {
    await makeService('s').send({
      chatId: '42',
      text: '## Hi\n\n**bold** <b>',
      replyToMessageId: '7',
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe('https://api.telegram.org/botbot-token/sendMessage');
    expect(post.mock.calls[0][1]).toEqual({
      chat_id: '42',
      text: '<b>Hi</b>\n\n<b>bold</b> &lt;b&gt;',
      parse_mode: 'HTML',
      reply_to_message_id: '7',
    });
  });

  it('sends plain text without a parse mode when format is plain', async () => {
    await makeService('s').send({ chatId: '42', text: '**not converted**', format: 'plain' });

    expect(post.mock.calls[0][1]).toEqual({ chat_id: '42', text: '**not converted**' });
  });

  it('resends a part as plain text after Telegram rejects the HTML with 400', async () => {
    post.mockRejectedValueOnce(httpError(400, "Bad Request: can't parse entities"));

    await makeService('s').send({ chatId: '42', text: '**bold** [x](https://x.io)' });

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1]).toMatchObject({ parse_mode: 'HTML' });
    expect(post.mock.calls[1][1]).toEqual({ chat_id: '42', text: 'bold x (https://x.io)' });
  });

  it('wraps other failures without exposing the axios error', async () => {
    post.mockRejectedValueOnce(httpError(403, 'Forbidden: bot was blocked by the user'));

    await expect(makeService('s').send({ chatId: '42', text: 'hi' })).rejects.toThrow(
      'Telegram sendMessage failed: 403 Forbidden: bot was blocked by the user',
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('sends long messages as sequential chunks, replying only on the first', async () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `${i}${'p'.repeat(1000)}`);
    await makeService('s').send({
      chatId: '42',
      text: paragraphs.join('\n\n'),
      replyToMessageId: '7',
    });

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1]).toMatchObject({ reply_to_message_id: '7', parse_mode: 'HTML' });
    expect(post.mock.calls[0][1].text.length).toBeLessThanOrEqual(4096);
    expect(post.mock.calls[1][1]).not.toHaveProperty('reply_to_message_id');
    expect(post.mock.calls[1][1].text.startsWith('4')).toBe(true);
  });
});
