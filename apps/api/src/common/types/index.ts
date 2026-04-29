export * from '@hothotleads/types';

// Re-export some legacy aliases that existing agent code still references.
// The canonical source of truth is @hothotleads/types.
export type { SignalSourceName as SignalSource } from '@hothotleads/types';
