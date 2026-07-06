import { APP_CONFIG } from "@/lib/config/app";
import { formatArabicNumber } from "@/lib/utils";
export function formatCurrency(amount: number): string {
  return `${formatArabicNumber(amount)} ${APP_CONFIG.currencySymbol}`;
}
export function formatCurrencyLabel(amount: number): string {
  return `${formatArabicNumber(amount)} ${APP_CONFIG.currencyLabel}`;
}