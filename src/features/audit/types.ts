export type AuditStatus = "ok" | "failed" | "denied";

export interface AuditEntry {
  id: string;
  occurredAt: string;
  /** YYYY-MM-DD, for cheap range filtering. */
  date: string;
  /** Null for a failed login, where nobody was authenticated. */
  actorUserId: string | null;
  /** Denormalised, so the trail survives the account being deleted. */
  actorUsername: string;
  actorRole: string | null;
  channel: string;
  /** Stable dotted name, e.g. "sale.void". */
  action: string;
  entity: string;
  entityId: string | null;
  summary: string | null;
  detail: unknown;
  status: AuditStatus;
  error: string | null;
}

export interface AuditQuery {
  from?: string;
  to?: string;
  actorUserId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  status?: AuditStatus;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  total: number;
  limit: number;
  offset: number;
  entries: AuditEntry[];
}

export interface AuditFilterOptions {
  actions: string[];
  actors: { id: string; username: string }[];
}
