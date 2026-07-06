import { useMemo, useState } from "react";
import { Contact, Search, Loader2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PremiumButton } from "@/components/ui/premium";
import { useCustomers } from "@/features/customers-debts/hooks";
import { CustomerProfileDialog } from "./CustomerProfileDialog";
import { AddCustomerDialog } from "./AddCustomerDialog";
import { strings } from "@/lib/i18n/ar";
import type { Customer } from "@/features/customers-debts/types";

interface CustomerProfilesSectionProps {
  isAdmin: boolean;
}

export function CustomerProfilesSection({
  isAdmin,
}: CustomerProfilesSectionProps) {
  const { data: customers = [], isLoading } = useCustomers();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.includes(q) || (c.phone ?? "").includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Contact className="w-5 h-5 text-primary" />
          {strings.customerProfiles.title}
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={strings.customerProfiles.searchPlaceholder}
              className="ps-9"
            />
          </div>
          <PremiumButton onClick={() => setAddOpen(true)} className="shrink-0">
            <UserPlus className="w-4 h-4 me-1.5" />
            {strings.customerProfiles.addCustomer}
          </PremiumButton>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          {strings.customerProfiles.noCustomers}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((customer) => (
            <button
              key={customer.id}
              onClick={() => setSelected(customer)}
              className="text-start bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
            >
              <p className="font-semibold text-foreground">{customer.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {customer.phone || "—"}
              </p>
            </button>
          ))}
        </div>
      )}

      <CustomerProfileDialog
        customer={selected}
        isAdmin={isAdmin}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
      <AddCustomerDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
