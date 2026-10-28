/** Human review state of a signal. Only approved signals feed buying-intent / scoring. */
export enum SignalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SNOOZED = 'snoozed',
}
