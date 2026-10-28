/**
 * Cross-product dashboard overview (`GET /api/dashboard/overview`), computed server-side.
 */

export interface DashboardOverview {
  totals: { products: number; leads: number; hotLeads: number; pendingSignals: number; enrichedLeads: number };
  pipeline: { hot: number; warm: number; cool: number; unscored: number };
  hotLeads: Array<{ id: string; productId: string; productName: string; company: string; score: number; signalSummary: string | null; updatedAt: string }>;
  pendingSignals: Array<{ id: string; productId: string; productName: string; company: string | null; type: string; description: string; detectedAt: string; relevanceScore: number | null }>;
  products: Array<{ id: string; name: string; slug: string; leads: number; hot: number; pendingSignals: number; enrichedPct: number | null }>;
  hasDemoData: boolean;
  signalsEnabled: boolean;
}
