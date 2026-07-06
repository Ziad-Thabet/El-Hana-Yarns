import { strings } from "@/lib/i18n/ar";

export const APP_CONFIG = {
  name: "El-Hana Yarns",
  nameAr: strings.invoice.shopName,
  sessionStorageKey: "el_hana_session_id",
  themeStorageKey: "el-hana-theme",
  currencyCode: "EGP",
  currencySymbol: strings.common.currencyShort,
  currencyLabel: strings.common.egyptianPound,
  locale: "ar-EG",
  direction: "rtl" as const,
} as const;
