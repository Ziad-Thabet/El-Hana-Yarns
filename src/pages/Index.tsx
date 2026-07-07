import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import SalesInterface from "@/features/sales/components/SalesInterface";
import { useTheme } from "@/components/ThemeProvider";
import logoDark from "@/assets/logo-dark1.png";
import logoLight from "@/assets/logo-light1.png";
import ProductManagement from "@/features/products/components/ProductManagement";
import PurchaseInvoices from "@/features/purchases/components/PurchaseInvoices";
import ReportsSection from "@/features/reports/components/ReportsSection";
import SalesInvoices from "@/features/sales/components/SalesInvoices";
import CustomerDebts from "@/features/customers-debts/components/CustomerDebts";
import { OnlineOrdersSection } from "@/features/online-orders/components/OnlineOrdersSection";
import { CustomerProfilesSection } from "@/features/customers-debts/components/CustomerProfilesSection";
import { DriversSection } from "@/features/drivers/components/DriversSection";
import EmployeeManagement from "@/features/employees/components/EmployeeManagement";
import ExpensesSection from "@/features/expenses/components/ExpensesSection";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import {
  useActiveSession,
  useHasAnyUsers,
  useLogout,
} from "@/features/auth/hooks";
import type { AuthSession, Shift } from "@/lib/types";
import { getNavItemsForRole, type NavTabId } from "@/lib/config/navigation";
import { strings } from "@/lib/i18n/ar";
import { USER_ROLE_LABELS } from "@/lib/constants/status";
import { AppShell } from "@/components/layout/AppShell";
import { FloatingSidebar } from "@/components/layout/FloatingSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { TitleBar } from "@/components/layout/TitleBar";
import { surfaces } from "@/lib/theme/styles";
import { cn } from "@/lib/utils";
import { pad, formatDateYMD } from "../../shared/dateRules.mjs";
const ACTIVE_TAB_STORAGE_KEY = "el_hana_active_tab";
const DEFAULT_TAB: NavTabId = "sales";
const Index = () => {
  const [activeTab, setActiveTab] = useState<NavTabId>(() => {
    const storedTab = localStorage.getItem(
      ACTIVE_TAB_STORAGE_KEY,
    ) as NavTabId | null;
    return storedTab ?? DEFAULT_TAB;
  });
  const { data: authSession, isLoading: isRestoringSession } =
    useActiveSession();
  const { data: hasAnyUsers, isLoading: isCheckingFirstRun } =
    useHasAnyUsers();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const logout = useLogout();
  const isAdmin = authSession?.role === "admin";
  const navItems = useMemo(() => getNavItemsForRole(!!isAdmin), [isAdmin]);
  useEffect(() => {
    const s = authSession as (AuthSession & { shiftId?: string }) | undefined;
    if (!s?.shiftId) {
      setActiveShift(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const todayDate = formatDateYMD(new Date());
        const shiftRes = await window.api.shifts.getActive(s.userId, todayDate);
        if (!cancelled && shiftRes.success && shiftRes.data) {
          setActiveShift(shiftRes.data as Shift);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authSession]);
  useEffect(() => {
    if (
      !isRestoringSession &&
      !isAdmin &&
      (activeTab === "invoices" ||
        activeTab === "employees" ||
        activeTab === "expenses")
    )
      setActiveTab("sales");
  }, [activeTab, isAdmin, isRestoringSession]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);
  const handleLogout = async () => {
    if (authSession?.sessionId) {
      try {
        await logout.mutateAsync(authSession.sessionId);
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
    setActiveShift(null);
  };
  const { theme } = useTheme();
  const brandIcon = (
    <div
      className="flex items-center justify-center rounded-[var(--radius-xl)] overflow-hidden"
      style={{
        width: "80px",
        height: "80px",
        background: theme === "dark" ? "hsl(216 28% 12%)" : "hsl(220 30% 96%)",
        boxShadow:
          "0 4px 20px hsl(var(--primary) / 0.25), 0 0 0 1px hsl(var(--border))",
        padding: "6px",
      }}
    >
      <img
        src={theme === "dark" ? logoDark : logoLight}
        alt={strings.app.logoAlt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center",
        }}
      />
    </div>
  );
  if (isRestoringSession || isCheckingFirstRun) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <TitleBar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!authSession) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <TitleBar />
        <div
          className="flex flex-1 items-center justify-center px-4 py-8"
          style={{
            background: `
              radial-gradient(ellipse 70% 60% at 50% 40%,
                hsl(var(--primary) / 0.07) 0%,
                transparent 70%),
              radial-gradient(ellipse 40% 40% at 20% 80%,
                hsl(var(--accent) / 0.05) 0%,
                transparent 60%),
              hsl(var(--background))
            `,
          }}
        >
          {hasAnyUsers === false ? (
            <RegisterForm
              brandIcon={brandIcon}
              onSuccess={() => setActiveTab(DEFAULT_TAB)}
            />
          ) : (
            <LoginForm
              brandIcon={brandIcon}
              onSuccess={() => setActiveTab(DEFAULT_TAB)}
            />
          )}
        </div>
      </div>
    );
  }
  const statItems = [
    {
      label: strings.app.currentRole,
      value: isAdmin ? USER_ROLE_LABELS.admin : USER_ROLE_LABELS.staff,
    },
    { label: strings.app.username, value: authSession.username },
    {
      label: strings.app.sessionStarted,
      value: (() => {
        const d = new Date(authSession.startedAt);
        const hours = d.getHours();
        const hours12 = hours % 12 === 0 ? 12 : hours % 12;
        const meridiem =
          hours >= 12 ? strings.common.meridiemPm : strings.common.meridiemAm;
        return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}, ${pad(hours12)}:${pad(d.getMinutes())} ${meridiem}`;
      })(),
    },
  ];
  const renderTab = () => {
    switch (activeTab) {
      case "sales":
        return (
          <SalesInterface
            cashier={authSession.displayName}
            userId={authSession.userId}
            onShiftCreated={setActiveShift}
          />
        );
      case "products":
        return <ProductManagement isAdmin={isAdmin} />;
      case "sales-invoices":
        return (
          <SalesInvoices
            session={authSession}
            activeShift={activeShift}
            onShiftEnded={() => setActiveShift(null)}
          />
        );
      case "invoices":
        return <PurchaseInvoices isAdmin={isAdmin} />;
      case "debts":
        return <CustomerDebts />;
      case "online-orders":
        return <OnlineOrdersSection session={authSession} />;
      case "online-customers":
        return <CustomerProfilesSection isAdmin={isAdmin} />;
      case "drivers":
        return <DriversSection isAdmin={isAdmin} />;
      case "reports":
        return <ReportsSection isAdmin={isAdmin} />;
      case "employees":
        return isAdmin ? <EmployeeManagement /> : null;
      case "expenses":
        return isAdmin ? <ExpensesSection /> : null;
      default:
        return null;
    }
  };
  return (
    <AppShell
      sidebar={
        <FloatingSidebar
          items={navItems}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
      header={
        <AppHeader
          session={authSession}
          isAdmin={isAdmin}
          onLogout={handleLogout}
          statItems={statItems}
          brandIcon={brandIcon}
        />
      }
    >
      <div className="animate-fade-in pb-8">{renderTab()}</div>
    </AppShell>
  );
};
export default Index;
