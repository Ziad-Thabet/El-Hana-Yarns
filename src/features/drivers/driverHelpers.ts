import { strings } from "@/lib/i18n/ar";
import type { DriverType } from "./types";

export const DRIVER_TYPE_LABELS: Record<DriverType, string> = {
  get driver() {
    return strings.drivers.typeDriver;
  },
  get company_next_day() {
    return strings.drivers.typeCompanyNextDay;
  },
  get company_direct() {
    return strings.drivers.typeCompanyDirect;
  },
};

export function getDriverBalanceLabel(balance: number): string {
  if (balance > 0) return strings.drivers.balanceOwedToShop;
  if (balance < 0) return strings.drivers.balanceOwedByShop;
  return strings.drivers.balanceSettled;
}

export function getDriverBalanceColor(balance: number): string {
  if (balance > 0) return "text-amber-600";
  if (balance < 0) return "text-rose-500";
  return "text-emerald-600";
}
