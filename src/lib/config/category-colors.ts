export const CATEGORY_COLOR_PRESETS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#84CC16",
  "#F97316",
] as const;

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_PRESETS[0];
export const FALLBACK_CATEGORY_COLOR = "hsl(var(--muted-foreground))";
