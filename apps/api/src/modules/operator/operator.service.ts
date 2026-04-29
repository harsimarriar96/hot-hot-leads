import { ConflictException, Injectable } from '@nestjs/common';
import {
  Operator,
  OperatorRepository,
  Workspace,
  type UpsertOperatorInput,
} from '@hothotleads/db';

@Injectable()
export class OperatorService {
  constructor(private readonly operatorRepo: OperatorRepository) {}

  async getCurrent(): Promise<Operator | null> {
    return this.operatorRepo.getCurrent();
  }

  async upsert(workspace: Workspace, input: UpsertOperatorInput): Promise<Operator> {
    try {
      return await this.operatorRepo.upsert(workspace, input);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException('An operator with that email already exists');
      }
      throw err;
    }
  }
}
