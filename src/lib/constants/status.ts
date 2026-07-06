import { strings } from "@/lib/i18n/ar";

export const INVOICE_STATUS_LABELS = {
  get paid() {
    return strings.debts.statusPaid;
  },
  get partial() {
    return strings.debts.statusPartial;
  },
  get unpaid() {
    return strings.debts.statusUnpaid;
  },
};
export const USER_ROLE_LABELS = {
  get admin() {
    return strings.employees.roleAdmin;
  },
  get staff() {
    return strings.employees.roleStaff;
  },
};
export const CONNECTION_STATUS = {
  get online() {
    return strings.app.connectionOnline;
  },
};
