import { EntityManager } from '@mikro-orm/postgresql';

import { ChannelCredential } from '../entities/channel-credential.entity';
import { Organization } from '../entities/organization.entity';
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
    orgId: string,
    channel: PreferredChannel,
    blob: StoredCredentialBlob,
  ): Promise<ChannelCredential> {
    const em = this.em.fork();
    const organization = em.getReference(Organization, orgId);
    const existing = await em.findOne(ChannelCredential, { organization, channel });
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
        organization,
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

  async load(orgId: string, channel: PreferredChannel): Promise<StoredCredentialBlob | null> {
    const row = await this.em.fork().findOne(ChannelCredential, { organization: orgId, channel });
    if (!row) return null;
    return {
      ciphertext: row.credentialsCiphertext,
      iv: row.credentialsIv,
      authTag: row.credentialsAuthTag,
    };
  }

  async list(orgId: string): Promise<RedactedCredential[]> {
    const rows = await this.em.fork().find(ChannelCredential, { organization: orgId });
    return rows.map((r) => ({
      channel: r.channel,
      configured: true,
      updatedAt: r.updatedAt,
    }));
  }

  async remove(orgId: string, channel: PreferredChannel): Promise<void> {
    const em = this.em.fork();
    const row = await em.findOne(ChannelCredential, { organization: orgId, channel });
    if (!row) return;
    em.remove(row);
    await em.flush();
  }
}
