/** Why a backup was taken. Encoded in the filename so the folder is readable
 *  without the app. */
export type BackupReason =
  | "startup"
  | "periodic"
  | "manual"
  | "pre-restore"
  | "pre-migration";

export interface BackupEntry {
  fileName: string;
  /** Bytes on disk. */
  size: number;
  /** YYYYMMDD, taken from the filename. */
  date: string;
  /** Local ISO-like timestamp, taken from the filename. */
  createdAt: string;
  reason: BackupReason;
}

export interface BackupListResult {
  directory: string;
  entries: BackupEntry[];
}

export interface BackupRestoreResult {
  restored: string;
  safetyBackup: string | null;
  requiresRestart: boolean;
}
