export type SettingType = "number" | "string" | "boolean";

export type SettingGroup =
  | "shop"
  | "receipt"
  | "inventory"
  | "shift"
  | "alerts"
  | "security"
  | "backup"
  | "barcode";

export type SettingValue = number | string | boolean;

/** One setting with its effective value and the metadata the editor needs. */
export interface SettingEntry {
  key: string;
  value: SettingValue;
  defaultValue: SettingValue;
  type: SettingType;
  group: SettingGroup;
  /** True when an override row exists, i.e. it differs from the shipped default. */
  isCustomised: boolean;
  min: number | null;
  max: number | null;
}

/** The flat key/value map the renderer reads for thresholds and shop details. */
export type ClientSettings = Record<string, SettingValue>;
