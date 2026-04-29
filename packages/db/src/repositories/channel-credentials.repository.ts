import { EntityManager } from '@mikro-orm/postgresql';

import { ChannelCredential } from '../entities/channel-credential.entity';
import { Workspace } from '../entities/workspace.entity';
import { PreferredChannel } from '../enums';

export interface StoredCredentialBlob {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export interface RedactedCredential {
  channel: PreferredChannel;
  configured: boolean;
  updatedAt: Date;
}

export class ChannelCredentialsRepository {
  constructor(private readonly em: EntityManager) {}

  async save(
    workspace: Workspace,
    channel: PreferredChannel,
    blob: StoredCredentialBlob,
  ): Promise<ChannelCredential> {
    const em = this.em.fork();
    const ws = await em.findOneOrFail(Workspace, { id: workspace.id });
    const existing = await em.findOne(ChannelCredential, { workspace: ws, channel });
    if (existing) {
      existing.credentialsCiphertext = blob.ciphertext;
      existing.credentialsIv = blob.iv;
      existing.credentialsAuthTag = blob.authTag;
      await em.flush();
      return existing;
    }
    const row = em.create(
      ChannelCredential,
      {
        workspace: ws,
        channel,
        credentialsCiphertext: blob.ciphertext,
        credentialsIv: blob.iv,
        credentialsAuthTag: blob.authTag,
      },
      { partial: true },
    );
    await em.persistAndFlush(row);
    return row;
  }

  async load(workspace: Workspace, channel: PreferredChannel): Promise<StoredCredentialBlob | null> {
    const row = await this.em.findOne(ChannelCredential, { workspace, channel });
    if (!row) return null;
    return {
      ciphertext: row.credentialsCiphertext,
      iv: row.credentialsIv,
      authTag: row.credentialsAuthTag,
    };
  }

  async list(workspace: Workspace): Promise<RedactedCredential[]> {
    const rows = await this.em.find(ChannelCredential, { workspace });
    return rows.map((r) => ({
      channel: r.channel,
      configured: true,
      updatedAt: r.updatedAt,
    }));
  }

  async remove(workspace: Workspace, channel: PreferredChannel): Promise<void> {
    const em = this.em.fork();
    const row = await em.findOne(ChannelCredential, { workspace, channel });
    if (!row) return;
    em.remove(row);
    await em.flush();
  }
}
