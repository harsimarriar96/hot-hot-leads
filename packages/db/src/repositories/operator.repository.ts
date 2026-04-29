import { EntityManager } from '@mikro-orm/postgresql';

import { Operator } from '../entities/operator.entity';
import { Workspace } from '../entities/workspace.entity';
import { PreferredChannel } from '../enums';

export interface UpsertOperatorInput {
  name: string;
  email: string;
  preferredChannel?: PreferredChannel;
}

export class OperatorRepository {
  constructor(private readonly em: EntityManager) {}

  async getCurrent(): Promise<Operator | null> {
    const rows = await this.em.find(Operator, {}, { populate: ['workspace'], limit: 1 });
    return rows[0] ?? null;
  }

  async upsert(workspace: Workspace, input: UpsertOperatorInput): Promise<Operator> {
    const em = this.em.fork();
    const ws = await em.findOneOrFail(Workspace, { id: workspace.id });
    const existing = await em.findOne(Operator, { workspace: ws });
    if (existing) {
      existing.name = input.name;
      existing.email = input.email;
      if (input.preferredChannel !== undefined) existing.preferredChannel = input.preferredChannel;
      await em.flush();
      return existing;
    }
    const operator = em.create(
      Operator,
      {
        workspace: ws,
        name: input.name,
        email: input.email,
        preferredChannel: input.preferredChannel,
      },
      { partial: true },
    );
    await em.persistAndFlush(operator);
    return operator;
  }
}
