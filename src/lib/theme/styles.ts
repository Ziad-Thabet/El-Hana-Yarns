import { cn } from "@/lib/utils";
export const surfaces = {
  page: "min-h-screen bg-background text-foreground",
  shell: "flex min-h-screen bg-background",
  main: "flex-1 overflow-auto",
  content: "mx-auto w-full max-w-[1600px] px-6 py-5",
  panel:
    "rounded-[var(--radius-lg)] border border-border bg-card shadow-[var(--shadow-card)]",
  muted: "rounded-[var(--radius-md)] border border-border bg-muted/40",
} as const;
export const cards = {
  base: "rounded-[var(--radius-lg)] border border-border bg-card text-card-foreground shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200",
  interactive:
    "rounded-[var(--radius-lg)] border border-border bg-card shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-elevated)] hover:border-primary/20 cursor-pointer",
  elevated:
    "rounded-[var(--radius-xl)] border border-border bg-card shadow-[var(--shadow-elevated)] backdrop-blur-sm",
  inset: "rounded-[var(--radius-md)] bg-muted/30 border border-border/60",
} as const;
export const buttons = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all duration-200 active:scale-[0.98]",
  accent:
    "bg-accent text-accent-foreground hover:bg-accent/90 transition-all duration-200",
  premium:
    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow)] transition-all duration-200",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-all duration-200",
  ghost: "hover:bg-muted/80 text-foreground transition-colors duration-200",
  icon: "rounded-[var(--radius-md)] h-10 w-10",
} as const;
export const inputs = {
  base: "rounded-[var(--radius-md)] border-border bg-background/80 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all duration-200",
  search:
    "rounded-[var(--radius-md)] border-border bg-muted/20 ps-10 focus-visible:ring-2 focus-visible:ring-primary/25",
} as const;
export const tables = {
  wrapper:
    "rounded-[var(--radius-lg)] border border-border overflow-hidden bg-card",
  head: "bg-muted/50 text-muted-foreground font-medium text-sm",
  row: "border-b border-border transition-colors hover:bg-muted/30",
  cell: "text-foreground text-sm py-3 px-4",
  cellMuted: "text-muted-foreground text-sm",
  empty: "text-center py-10 text-muted-foreground",
} as const;
export const sidebar = {
  container:
    "fixed top-[calc(var(--titlebar-height)+1rem)] bottom-4 z-40 flex w-[4.5rem] flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-border bg-card/95 p-2 shadow-[var(--shadow-sidebar)] backdrop-blur-xl",
  item: cn(
    "flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)]",
    "text-muted-foreground transition-all duration-200",
    "hover:bg-muted/60 hover:text-foreground",
  ),
  itemActive: cn(
    "bg-primary/12 text-primary shadow-[var(--shadow-glow)]",
    "ring-1 ring-primary/25",
  ),
  label: "text-[11px] font-semibold leading-tight",
} as const;
export const typography = {
  pageTitle: "text-2xl font-semibold tracking-tight text-foreground",
  sectionTitle: "text-lg font-semibold text-foreground",
  label: "text-sm font-medium text-foreground",
  caption: "text-xs text-muted-foreground",
  stat: "text-2xl font-semibold tabular-nums text-foreground",
} as const;
export const layout = {
  header:
    "flex items-center justify-between gap-4 border-b border-border px-6 py-4",
  section: "space-y-4",
  stack: "flex flex-col gap-3",
  row: "flex flex-wrap items-center gap-3",
  gridProducts: "grid grid-cols-2 md:grid-cols-3 gap-3",
} as const;
export const images = {
  product: "w-full aspect-square object-cover rounded-t-[var(--radius-lg)]",
  productLg: "w-full aspect-square object-cover rounded-t-lg",
} as const;
export function cardClass(...extra: Parameters<typeof cn>) {
  return cn(cards.base, ...extra);
}
export function premiumButtonClass(...extra: Parameters<typeof cn>) {
  return cn(buttons.premium, "rounded-[var(--radius-md)]", ...extra);
}
