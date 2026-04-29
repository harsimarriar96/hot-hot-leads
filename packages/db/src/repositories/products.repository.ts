import { EntityManager } from '@mikro-orm/postgresql';

import { Product } from '../entities/product.entity';
import { ProductIcp } from '../entities/product-icp.entity';
import { ProductSalesChannel } from '../entities/product-sales-channel.entity';
import { ProductSource } from '../entities/product-source.entity';
import { PredefinedProspect } from '../entities/predefined-prospect.entity';

export interface ProductSummary {
  id: string;
  productName: string;
  slug: string;
}

export class ProductsRepository {
  constructor(private readonly em: EntityManager) {}

  /** Return all products as lightweight summaries. */
  async listProducts(): Promise<ProductSummary[]> {
    const products = await this.em.find(Product, {}, { fields: ['id', 'name', 'slug'] });
    return products.map((p) => ({ id: p.id, productName: p.name, slug: p.slug }));
  }

  /**
   * Load a product with every related record (ICP, channels, sources, prospects).
   * Returns `null` if the product doesn't exist.
   */
  async getProduct(productName: string): Promise<Product | null> {
    const em = this.em.fork();
    return em.findOne(
      Product,
      { name: productName },
      { populate: ['icp', 'salesChannels', 'sources', 'predefinedProspects'] },
    );
  }

  /**
   * Load product knowledge in the legacy `ProductKnowledge` shape the agents expect.
   * Kept for tool-schema stability.
   */
  async getProductKnowledge(productName: string): Promise<ProductKnowledgeView> {
    const product = await this.getProduct(productName);
    if (!product) {
      throw new Error(`Product "${productName}" not found`);
    }
    return toKnowledgeView(product);
  }

  async getProductSources(productName: string): Promise<SourceView[]> {
    const product = await this.getProduct(productName);
    if (!product) return [];
    return product.sources.getItems().map(toSourceView);
  }

  /** No-op cache shim — kept so agent code compiled against the legacy API still calls it. */
  invalidateCache(_productName: string): void {
    // Postgres reads are fast; no per-process cache layer.
  }

  /** Upsert a product. Used by onboarding + product-management features. */
  async upsertProduct(input: UpsertProductInput): Promise<Product> {
    const em = this.em.fork();
    let product = await em.findOne(Product, { name: input.name });
    if (!product) {
      product = em.create(
        Product,
        {
          name: input.name,
          slug: input.slug ?? slugify(input.name),
          generalInfo: input.generalInfo,
          salesStrategy: input.salesStrategy,
          pricing: input.pricing,
        },
        { partial: true },
      );
    } else {
      if (input.slug !== undefined) product.slug = input.slug;
      if (input.generalInfo !== undefined) product.generalInfo = input.generalInfo;
      if (input.salesStrategy !== undefined) product.salesStrategy = input.salesStrategy;
      if (input.pricing !== undefined) product.pricing = input.pricing;
    }
    await em.flush();
    return product;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    return this.em.findOne(Product, { slug });
  }

  async findById(id: string): Promise<Product | null> {
    return this.em.findOne(Product, { id });
  }
}

export interface UpsertProductInput {
  name: string;
  slug?: string;
  generalInfo?: string;
  salesStrategy?: string;
  pricing?: string;
}

export interface ProductKnowledgeView {
  id: string;
  productName: string;
  generalInfo: string;
  salesStrategy: string;
  pricing: string;
  icp: IcpView | null;
  predefinedProspects: PredefinedProspectView[];
  salesChannels: ChannelView[];
  sources: SourceView[];
  signals: unknown[];
}

export interface IcpView {
  targetIndustries: string[];
  companySizes: string[];
  fundingStages: string[];
  geographies: string[];
  notes?: string;
}

export interface PredefinedProspectView {
  id: string;
  company: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  fundingStage?: string;
  icpFitNotes?: string;
}

export interface ChannelView {
  id: string;
  name: string;
  description?: string;
  template?: string;
}

export interface SourceView {
  id: string;
  name: string;
  url?: string;
  description?: string;
  type: string;
}

function toKnowledgeView(p: Product): ProductKnowledgeView {
  return {
    id: p.id,
    productName: p.name,
    generalInfo: p.generalInfo ?? '',
    salesStrategy: p.salesStrategy ?? '',
    pricing: p.pricing ?? '',
    icp: p.icp ? toIcpView(p.icp) : null,
    predefinedProspects: p.predefinedProspects.getItems().map((pp: PredefinedProspect) => ({
      id: pp.id,
      company: pp.company,
      domain: pp.domain,
      industry: pp.industry,
      companySize: pp.companySize,
      fundingStage: pp.fundingStage,
      icpFitNotes: pp.icpFitNotes,
    })),
    salesChannels: p.salesChannels.getItems().map((c: ProductSalesChannel) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      template: c.template,
    })),
    sources: p.sources.getItems().map(toSourceView),
    signals: [],
  };
}

function toIcpView(icp: ProductIcp): IcpView {
  return {
    targetIndustries: icp.targetIndustries ?? [],
    companySizes: icp.companySizes ?? [],
    fundingStages: icp.fundingStages ?? [],
    geographies: icp.geographies ?? [],
    notes: icp.notes,
  };
}

function toSourceView(s: ProductSource): SourceView {
  return {
    id: s.id,
    name: s.name,
    url: s.url,
    description: s.description,
    type: s.type,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
