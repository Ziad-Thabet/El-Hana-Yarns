export const RADIUS = {
  sm: "0.75rem",
  md: "0.875rem",
  lg: "1rem",
  xl: "1.25rem",
  shell: "1rem",
} as const;

export const SPACING = {
  pageX: "1.5rem",
  pageY: "1.25rem",
  card: "1.5rem",
  section: "1.5rem",
  stack: "1rem",
  dense: "0.75rem",
} as const;

export const SHADOW = {
  card: "var(--shadow-card)",
  elevated: "var(--shadow-elevated)",
  sidebar: "var(--shadow-sidebar)",
  glow: "var(--shadow-glow)",
} as const;

export const MOTION = {
  fast: "150ms",
  base: "200ms",
  slow: "300ms",
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export const Z_INDEX = {
  sidebar: 40,
  header: 30,
  modal: 50,
  toast: 60,
} as const;

export const BRAND = {
  light: {
    background: "#F8F8F6",
    surface: "#FFFFFF",
    card: "#FCFCFA",
    primary: "#1D4ED8",
    accent: "#D4A373",
    text: "#171717",
    textSecondary: "#666666",
    border: "#E8E8E3",
  },
  dark: {
    background: "#0D1117",
    surface: "#161B22",
    card: "#1E2530",
    primary: "#4F8CFF",
    accent: "#E6B980",
    text: "#F3F4F6",
    textSecondary: "#A3A3A3",
    border: "rgba(255,255,255,0.08)",
  },
} as const;
