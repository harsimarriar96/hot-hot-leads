import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@notionhq/client';

@Injectable()
export class NotionService {
  public readonly client: Client;
  public readonly knowledgePageId: string;
  public readonly outputPageId: string;

  constructor(private readonly config: ConfigService) {
    this.client = new Client({ auth: this.config.get<string>('notion.apiKey') });
    this.knowledgePageId = this.config.get<string>('notion.knowledgePageId')!;
    this.outputPageId = this.config.get<string>('notion.outputPageId')!;
  }

  /** Get all child pages/blocks of a page */
  async getChildren(blockId: string): Promise<any[]> {
    const response = await this.client.blocks.children.list({ block_id: blockId });
    return response.results;
  }

  /** Get a page's properties */
  async getPage(pageId: string): Promise<any> {
    return this.client.pages.retrieve({ page_id: pageId });
  }

  /** Get plain text content from a page (all child blocks) */
  async getPageText(pageId: string): Promise<string> {
    const blocks = await this.getChildren(pageId);
    return this.extractTextFromBlocks(blocks);
  }

  /** Query a Notion database with optional filters */
  async queryDatabase(databaseId: string, filter?: any, sorts?: any[]): Promise<any[]> {
    const params: any = { database_id: databaseId, page_size: 100 };
    if (filter) params.filter = filter;
    if (sorts) params.sorts = sorts;
    const response = await this.client.databases.query(params);
    return response.results;
  }

  /** Create a page in a database */
  async createPage(databaseId: string, properties: Record<string, any>): Promise<any> {
    return this.client.pages.create({
      parent: { database_id: databaseId },
      properties,
    });
  }

  /** Update a page's properties */
  async updatePage(pageId: string, properties: Record<string, any>): Promise<any> {
    return this.client.pages.update({ page_id: pageId, properties });
  }

  /** Find a child page by title within a parent page */
  async findChildPageByTitle(parentId: string, title: string): Promise<any | null> {
    const children = await this.getChildren(parentId);
    for (const block of children) {
      if (block.type === 'child_page' && block.child_page?.title === title) {
        return block;
      }
      // Also check child_database
      if (block.type === 'child_database' && block.child_database?.title === title) {
        return block;
      }
    }
    return null;
  }

  /** Extract plain text from a Notion property */
  extractText(property: any): string {
    if (!property) return '';
    switch (property.type) {
      case 'title':
        return property.title?.map((t: any) => t.plain_text).join('') ?? '';
      case 'rich_text':
        return property.rich_text?.map((t: any) => t.plain_text).join('') ?? '';
      case 'select':
        return property.select?.name ?? '';
      case 'multi_select':
        return property.multi_select?.map((s: any) => s.name).join(', ') ?? '';
      case 'number':
        return String(property.number ?? '');
      case 'url':
        return property.url ?? '';
      case 'email':
        return property.email ?? '';
      case 'checkbox':
        return String(property.checkbox ?? false);
      case 'date':
        return property.date?.start ?? '';
      default:
        return '';
    }
  }

  /** Extract text from blocks array */
  extractTextFromBlocks(blocks: any[]): string {
    return blocks
      .map((block) => {
        const type = block.type;
        const content = block[type];
        if (!content) return '';
        if (content.rich_text) {
          return content.rich_text.map((t: any) => t.plain_text).join('');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  /** Build a title property */
  titleProp(text: string): any {
    return { title: [{ text: { content: text } }] };
  }

  /** Build a rich_text property */
  richTextProp(text: string): any {
    return { rich_text: [{ text: { content: text.slice(0, 2000) } }] };
  }

  /** Build a select property */
  selectProp(name: string): any {
    return { select: { name } };
  }

  /** Build a multi_select property */
  multiSelectProp(names: string[]): any {
    return { multi_select: names.map((n) => ({ name: n.slice(0, 100) })) };
  }

  /** Build a number property */
  numberProp(value: number): any {
    return { number: value };
  }

  /** Build a date property */
  dateProp(iso: string): any {
    return { date: { start: iso } };
  }

  /** Build a checkbox property */
  checkboxProp(value: boolean): any {
    return { checkbox: value };
  }

  /** Build a url property */
  urlProp(url: string): any {
    return { url };
  }
}
