import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AgentModelTier,
  Lead,
  PredefinedProspect,
  Product,
  ProductIcp,
  ProductSalesChannel,
  ProductSource,
  ProductsRepository,
  Signal,
  SourceType,
} from '@hothotleads/db';

class IcpDto {
  @IsArray()
  @IsString({ each: true })
  targetIndustries: string[] = [];

  @IsArray()
  @IsString({ each: true })
  companySizes: string[] = [];

  @IsArray()
  @IsString({ each: true })
  geographies: string[] = [];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class CreateProductDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  generalInfo?: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => IcpDto)
  icp!: IcpDto;
}

class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  generalInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  salesStrategy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  pricing?: string;

  @IsOptional()
  @IsEnum(AgentModelTier)
  agentModelTier?: AgentModelTier;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  agentExtraInstructions?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  icpStrictness?: number;
}

class PutIcpDto {
  @IsArray()
  @IsString({ each: true })
  targetIndustries!: string[];

  @IsArray()
  @IsString({ each: true })
  companySizes!: string[];

  @IsArray()
  @IsString({ each: true })
  fundingStages!: string[];

  @IsArray()
  @IsString({ each: true })
  geographies!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class SalesChannelDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  template?: string;
}

class SourceDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(SourceType)
  type?: SourceType;
}

class ProspectDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  companySize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  fundingStage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  icpFitNotes?: string;
}

@Controller('api/products')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class ProductsController {
  constructor(
    private readonly em: EntityManager,
    private readonly productsRepo: ProductsRepository,
  ) {}

  @Get()
  async list() {
    const em = this.em.fork();
    const products = await em.find(Product, {}, { populate: ['icp'] });

    const summaries = await Promise.all(
      products.map(async (p) => {
        const [leadCount, signalCount, lastMessageAt] = await Promise.all([
          em.count(Lead, { product: p }),
          em.count(Signal, {
            product: p,
            detectedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          }),
          this.lastChatActivityAt(p.id, em),
        ]);
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          generalInfo: p.generalInfo ?? '',
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          leadCount,
          activeSignalCount: signalCount,
          lastChatActivityAt: lastMessageAt,
        };
      }),
    );
    return summaries;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const product = await this.productsRepo.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    const em = this.em.fork();
    const withRelations = await em.findOneOrFail(
      Product,
      { id },
      { populate: ['icp', 'salesChannels', 'sources', 'predefinedProspects'] },
    );
    return {
      id: withRelations.id,
      name: withRelations.name,
      slug: withRelations.slug,
      generalInfo: withRelations.generalInfo ?? '',
      salesStrategy: withRelations.salesStrategy ?? '',
      pricing: withRelations.pricing ?? '',
      agentModelTier: withRelations.agentModelTier,
      agentExtraInstructions: withRelations.agentExtraInstructions ?? '',
      icpStrictness: withRelations.icpStrictness,
      icp: withRelations.icp
        ? {
            targetIndustries: withRelations.icp.targetIndustries ?? [],
            companySizes: withRelations.icp.companySizes ?? [],
            geographies: withRelations.icp.geographies ?? [],
            fundingStages: withRelations.icp.fundingStages ?? [],
            notes: withRelations.icp.notes ?? '',
          }
        : null,
      salesChannels: withRelations.salesChannels.getItems().map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? '',
        template: c.template ?? null,
      })),
      sources: withRelations.sources.getItems().map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url ?? '',
        description: s.description ?? '',
        type: s.type,
      })),
      predefinedProspects: withRelations.predefinedProspects.getItems().map((p) => ({
        id: p.id,
        company: p.company,
        domain: p.domain ?? '',
        industry: p.industry ?? '',
        companySize: p.companySize ?? '',
        fundingStage: p.fundingStage ?? '',
        icpFitNotes: p.icpFitNotes ?? '',
      })),
    };
  }

  @Post()
  async create(@Body() dto: CreateProductDto) {
    const em = this.em.fork();
    const existing = await em.findOne(Product, { name: dto.name });
    if (existing) throw new ConflictException(`Product "${dto.name}" already exists`);

    const product = await em.transactional(async (tx) => {
      const p = tx.create(
        Product,
        { name: dto.name, slug: slugify(dto.name), generalInfo: dto.generalInfo },
        { partial: true },
      );
      tx.create(
        ProductIcp,
        {
          product: p,
          targetIndustries: dto.icp.targetIndustries ?? [],
          companySizes: dto.icp.companySizes ?? [],
          geographies: dto.icp.geographies ?? [],
          notes: dto.icp.notes,
        },
        { partial: true },
      );
      await tx.flush();
      return p;
    });
    return { id: product.id, name: product.name, slug: product.slug };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const em = this.em.fork();
    const product = await em.findOneOrFail(Product, { id });
    if (dto.name !== undefined && dto.name !== product.name) {
      const newSlug = slugify(dto.name);
      const conflict = await em.findOne(Product, {
        id: { $ne: id },
        $or: [{ name: dto.name }, { slug: newSlug }],
      });
      if (conflict) {
        throw new ConflictException(
          conflict.name === dto.name
            ? `Product "${dto.name}" already exists`
            : `Slug "${newSlug}" collides with product "${conflict.name}"`,
        );
      }
      product.name = dto.name;
      product.slug = newSlug;
    }
    if (dto.generalInfo !== undefined) product.generalInfo = dto.generalInfo;
    if (dto.salesStrategy !== undefined) product.salesStrategy = dto.salesStrategy;
    if (dto.pricing !== undefined) product.pricing = dto.pricing;
    if (dto.agentModelTier !== undefined) product.agentModelTier = dto.agentModelTier;
    if (dto.agentExtraInstructions !== undefined)
      product.agentExtraInstructions = dto.agentExtraInstructions;
    if (dto.icpStrictness !== undefined) product.icpStrictness = dto.icpStrictness;
    await em.flush();
    return { id: product.id, name: product.name };
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    const em = this.em.fork();
    const product = await em.findOne(Product, { id });
    if (!product) return;
    em.remove(product);
    await em.flush();
  }

  // ----- ICP -----

  @Put(':id/icp')
  async putIcp(@Param('id') id: string, @Body() dto: PutIcpDto) {
    const em = this.em.fork();
    const product = await em.findOneOrFail(Product, { id });
    let icp = await em.findOne(ProductIcp, { product });
    if (!icp) {
      icp = em.create(
        ProductIcp,
        { product, ...sanitizeIcp(dto) },
        { partial: true },
      );
    } else {
      assignIcp(icp, dto);
    }
    await em.persistAndFlush(icp);
    return {
      targetIndustries: icp.targetIndustries ?? [],
      companySizes: icp.companySizes ?? [],
      fundingStages: icp.fundingStages ?? [],
      geographies: icp.geographies ?? [],
      notes: icp.notes ?? '',
    };
  }

  // ----- Sales channels -----

  @Post(':id/sales-channels')
  async addSalesChannel(@Param('id') id: string, @Body() dto: SalesChannelDto) {
    const em = this.em.fork();
    const product = await em.findOneOrFail(Product, { id });
    const channel = em.create(
      ProductSalesChannel,
      { product, name: dto.name, description: dto.description, template: dto.template },
      { partial: true },
    );
    await em.persistAndFlush(channel);
    return { id: channel.id, name: channel.name };
  }

  @Patch(':id/sales-channels/:childId')
  async updateSalesChannel(
    @Param('id') id: string,
    @Param('childId') childId: string,
    @Body() dto: SalesChannelDto,
  ) {
    const em = this.em.fork();
    const channel = await em.findOneOrFail(ProductSalesChannel, { id: childId, product: id });
    if (dto.name !== undefined) channel.name = dto.name;
    if (dto.description !== undefined) channel.description = dto.description;
    if (dto.template !== undefined) channel.template = dto.template;
    await em.flush();
    return { id: channel.id };
  }

  @Delete(':id/sales-channels/:childId')
  @HttpCode(204)
  async deleteSalesChannel(
    @Param('id') id: string,
    @Param('childId') childId: string,
  ): Promise<void> {
    const em = this.em.fork();
    const channel = await em.findOne(ProductSalesChannel, { id: childId, product: id });
    if (!channel) return;
    em.remove(channel);
    await em.flush();
  }

  // ----- Sources -----

  @Post(':id/sources')
  async addSource(@Param('id') id: string, @Body() dto: SourceDto) {
    const em = this.em.fork();
    const product = await em.findOneOrFail(Product, { id });
    const source = em.create(
      ProductSource,
      {
        product,
        name: dto.name,
        url: dto.url,
        description: dto.description,
        type: dto.type ?? SourceType.OTHER,
      },
      { partial: true },
    );
    await em.persistAndFlush(source);
    return { id: source.id, name: source.name };
  }

  @Patch(':id/sources/:childId')
  async updateSource(
    @Param('id') id: string,
    @Param('childId') childId: string,
    @Body() dto: SourceDto,
  ) {
    const em = this.em.fork();
    const source = await em.findOneOrFail(ProductSource, { id: childId, product: id });
    if (dto.name !== undefined) source.name = dto.name;
    if (dto.url !== undefined) source.url = dto.url;
    if (dto.description !== undefined) source.description = dto.description;
    if (dto.type !== undefined) source.type = dto.type;
    await em.flush();
    return { id: source.id };
  }

  @Delete(':id/sources/:childId')
  @HttpCode(204)
  async deleteSource(@Param('id') id: string, @Param('childId') childId: string): Promise<void> {
    const em = this.em.fork();
    const source = await em.findOne(ProductSource, { id: childId, product: id });
    if (!source) return;
    em.remove(source);
    await em.flush();
  }

  // ----- Predefined prospects -----

  @Post(':id/predefined-prospects')
  async addProspect(@Param('id') id: string, @Body() dto: ProspectDto) {
    const em = this.em.fork();
    const product = await em.findOneOrFail(Product, { id });
    const prospect = em.create(
      PredefinedProspect,
      { product, ...dto },
      { partial: true },
    );
    await em.persistAndFlush(prospect);
    return { id: prospect.id, company: prospect.company };
  }

  @Patch(':id/predefined-prospects/:childId')
  async updateProspect(
    @Param('id') id: string,
    @Param('childId') childId: string,
    @Body() dto: ProspectDto,
  ) {
    const em = this.em.fork();
    const prospect = await em.findOneOrFail(PredefinedProspect, { id: childId, product: id });
    if (dto.company !== undefined) prospect.company = dto.company;
    if (dto.domain !== undefined) prospect.domain = dto.domain;
    if (dto.industry !== undefined) prospect.industry = dto.industry;
    if (dto.companySize !== undefined) prospect.companySize = dto.companySize;
    if (dto.fundingStage !== undefined) prospect.fundingStage = dto.fundingStage;
    if (dto.icpFitNotes !== undefined) prospect.icpFitNotes = dto.icpFitNotes;
    await em.flush();
    return { id: prospect.id };
  }

  @Delete(':id/predefined-prospects/:childId')
  @HttpCode(204)
  async deleteProspect(@Param('id') id: string, @Param('childId') childId: string): Promise<void> {
    const em = this.em.fork();
    const prospect = await em.findOne(PredefinedProspect, { id: childId, product: id });
    if (!prospect) return;
    em.remove(prospect);
    await em.flush();
  }

  private async lastChatActivityAt(productId: string, em: EntityManager): Promise<Date | null> {
    const result = await em
      .getConnection()
      .execute(
        `select max(pcm.created_at) as last from product_chat_messages pcm
         join product_chats pc on pc.id = pcm.chat_id
         where pc.product_id = ?`,
        [productId],
      );
    const first = (result as Array<{ last: Date | null }>)[0];
    return first?.last ? new Date(first.last) : null;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function assignIcp(icp: ProductIcp, dto: PutIcpDto): void {
  icp.targetIndustries = dto.targetIndustries ?? [];
  icp.companySizes = dto.companySizes ?? [];
  icp.fundingStages = dto.fundingStages ?? [];
  icp.geographies = dto.geographies ?? [];
  icp.notes = dto.notes;
}

function sanitizeIcp(dto: PutIcpDto): {
  targetIndustries: string[];
  companySizes: string[];
  fundingStages: string[];
  geographies: string[];
  notes?: string;
} {
  return {
    targetIndustries: dto.targetIndustries ?? [],
    companySizes: dto.companySizes ?? [],
    fundingStages: dto.fundingStages ?? [],
    geographies: dto.geographies ?? [],
    notes: dto.notes,
  };
}
