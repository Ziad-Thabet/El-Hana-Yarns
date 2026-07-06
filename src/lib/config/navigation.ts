import type { LucideIcon } from "lucide-react";
import {
  ShoppingCart,
  Package,
  FileText,
  BarChart3,
  Receipt,
  CreditCard,
  Users,
  Wallet,
  Truck,
  Contact,
} from "lucide-react";
import { strings } from "@/lib/i18n/ar";
export type NavTabId =
  | "sales"
  | "products"
  | "sales-invoices"
  | "invoices"
  | "debts"
  | "online-orders"
  | "online-customers"
  | "drivers"
  | "reports"
  | "employees"
  | "expenses";
export interface NavItem {
  id: NavTabId;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}
function buildNavItems(): NavItem[] {
  return [
    { id: "sales", label: strings.nav.sales, icon: ShoppingCart },
    { id: "products", label: strings.nav.products, icon: Package },
    { id: "sales-invoices", label: strings.nav.salesInvoices, icon: Receipt },
    {
      id: "invoices",
      label: strings.nav.purchaseInvoices,
      icon: FileText,
      adminOnly: true,
    },
    { id: "debts", label: strings.nav.debts, icon: CreditCard },
    { id: "online-orders", label: strings.nav.onlineOrders, icon: Package },
    {
      id: "online-customers",
      label: strings.nav.onlineCustomers,
      icon: Contact,
    },
    {
      id: "drivers",
      label: strings.nav.drivers,
      icon: Truck,
    },
    {
      id: "employees",
      label: strings.nav.employees,
      icon: Users,
      adminOnly: true,
    },
    {
      id: "expenses",
      label: strings.nav.expenses,
      icon: Wallet,
      adminOnly: true,
    },
    {
      id: "reports",
      label: strings.nav.reports,
      icon: BarChart3,
      adminOnly: true,
    },
  ];
}
export function getNavItemsForRole(isAdmin: boolean): NavItem[] {
  return buildNavItems().filter((item) => !item.adminOnly || isAdmin);
}
