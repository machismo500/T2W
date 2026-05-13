// T2W brand palette — mirrors the web tailwind config so the apps look
// like the same product, not a cousin.
export const colors = {
  bg: "#0f0f1e",
  bgElevated: "#1a1a2e",
  card: "#2a2a4a",
  border: "#3a3a5a",
  textPrimary: "#ffffff",
  textSecondary: "#a0a0b0",
  textMuted: "#707080",
  primary: "#ff4757",
  primaryDim: "#cc3a47",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  pill: 999,
};

export const text = {
  h1: { fontSize: 28, fontWeight: "700" as const, color: colors.textPrimary },
  h2: { fontSize: 22, fontWeight: "700" as const, color: colors.textPrimary },
  h3: { fontSize: 18, fontWeight: "600" as const, color: colors.textPrimary },
  body: { fontSize: 15, color: colors.textPrimary },
  bodySecondary: { fontSize: 15, color: colors.textSecondary },
  caption: { fontSize: 12, color: colors.textSecondary },
};
