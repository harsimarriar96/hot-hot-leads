import { ChannelType } from './message.types';

export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'custom';

export interface Schedule {
  id: string;
  notionPageId?: string;
  name: string;
  productName?: string;
  taskPrompt: string;
  frequency: ScheduleFrequency;
  cronExpression?: string; // Required when frequency === 'custom'
  userId: string;
  chatId: string;
  channel: ChannelType;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}
