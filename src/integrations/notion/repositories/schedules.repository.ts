import { Injectable, Logger } from '@nestjs/common';

import { NotionService } from '../notion.service';
import { Schedule } from '../../../common/types';

// Dedicated top-level database ID for schedules (not product-scoped)
const SCHEDULES_DB_ENV = 'NOTION_SCHEDULES_DATABASE_ID';

export interface SaveScheduleInput {
  name: string;
  taskPrompt: string;
  frequency: Schedule['frequency'];
  userId: string;
  chatId: string;
  channel: Schedule['channel'];
  productName?: string;
  cronExpression?: string;
}

@Injectable()
export class SchedulesRepository {
  private readonly logger = new Logger(SchedulesRepository.name);

  constructor(private readonly notion: NotionService) {}

  private get databaseId(): string {
    const id = process.env[SCHEDULES_DB_ENV];
    if (!id) throw new Error(`${SCHEDULES_DB_ENV} is not configured`);
    return id;
  }

  isConfigured(): boolean {
    return !!process.env[SCHEDULES_DB_ENV];
  }

  async saveSchedule(input: SaveScheduleInput): Promise<{ notionPageId: string; name: string }> {
    const props: Record<string, any> = {
      Name: this.notion.titleProp(input.name),
      'Task Prompt': this.notion.richTextProp(input.taskPrompt),
      Frequency: this.notion.selectProp(input.frequency),
      'User ID': this.notion.richTextProp(input.userId),
      'Chat ID': this.notion.richTextProp(input.chatId),
      Channel: this.notion.selectProp(input.channel),
      Active: this.notion.checkboxProp(true),
    };
    if (input.productName) props['Product'] = this.notion.richTextProp(input.productName);
    if (input.cronExpression) props['Cron Expression'] = this.notion.richTextProp(input.cronExpression);

    const page = await this.notion.createPage(this.databaseId, props);
    this.logger.log(`Schedule saved: ${input.name}`);
    return { notionPageId: page.id, name: input.name };
  }

  async getActiveSchedules(): Promise<Schedule[]> {
    if (!this.isConfigured()) {
      this.logger.warn(`${SCHEDULES_DB_ENV} is not configured — skipping schedule loading`);
      return [];
    }
    const pages = await this.notion.queryDatabase(this.databaseId, {
      property: 'Active',
      checkbox: { equals: true },
    });

    return pages.map((p) => ({
      id: p.id,
      notionPageId: p.id,
      name: this.notion.extractText(p.properties['Name']),
      taskPrompt: this.notion.extractText(p.properties['Task Prompt']),
      frequency: this.notion.extractText(p.properties['Frequency']) as Schedule['frequency'],
      cronExpression: this.notion.extractText(p.properties['Cron Expression']) || undefined,
      userId: this.notion.extractText(p.properties['User ID']),
      chatId: this.notion.extractText(p.properties['Chat ID']),
      channel: this.notion.extractText(p.properties['Channel']) as Schedule['channel'],
      productName: this.notion.extractText(p.properties['Product']) || undefined,
      isActive: true,
      lastRun: this.notion.extractText(p.properties['Last Run']) || undefined,
      createdAt: p.created_time,
    }));
  }

  async markLastRun(notionPageId: string): Promise<void> {
    await this.notion.updatePage(notionPageId, {
      'Last Run': this.notion.dateProp(new Date().toISOString()),
    });
  }
}
