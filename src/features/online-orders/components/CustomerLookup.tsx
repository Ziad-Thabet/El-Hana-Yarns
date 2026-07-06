import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, User, MapPin } from "lucide-react";
import { useCustomers } from "@/features/customers-debts/hooks";
import { useCustomerTrustLevel } from "@/features/online-orders/hooks";
import {
  TRUST_LEVEL_LABELS,
  TRUST_LEVEL_COLORS,
} from "@/lib/constants/onlineOrdersStatus";
import { strings } from "@/lib/i18n/ar";
import { MIN_PHONE_LOOKUP_LENGTH } from "@/lib/constants/customerLookup";
import type { Customer } from "@/features/customers-debts/types";

interface CustomerLookupProps {
  customerPhone: string;
  customerName: string;
  addressText: string;
  addressLabel: string;
  saveCustomer: boolean;
  onChange: (
    field: "customerPhone" | "customerName" | "addressText" | "addressLabel",
    value: string,
  ) => void;
  onSaveCustomerChange: (value: boolean) => void;
  onMatchedCustomer: (customer: Customer | null) => void;
}

export function CustomerLookup({
  customerPhone,
  customerName,
  addressText,
  addressLabel,
  saveCustomer,
  onChange,
  onSaveCustomerChange,
  onMatchedCustomer,
}: CustomerLookupProps) {
  const { data: customers = [] } = useCustomers();

  const matched = useMemo(() => {
    if (!customerPhone || customerPhone.length < MIN_PHONE_LOOKUP_LENGTH)
      return null;
    const found = customers.find((c) => c.phone === customerPhone);
    return found ?? null;
  }, [customers, customerPhone]);

  const { data: trustData } = useCustomerTrustLevel(
    matched?.id ?? "",
    !!matched,
  );

  const handlePhoneChange = (value: string) => {
    onChange("customerPhone", value);
    const found = customers.find((c) => c.phone === value) ?? null;
    onMatchedCustomer(found);
    if (found && found.name !== customerName) {
      onChange("customerName", found.name);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" />
          {strings.onlineOrders.customerPhone} *
        </Label>
        <Input
          value={customerPhone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder="01xxxxxxxxx"
        />
      </div>

      {matched && trustData && (
        <div className="grid grid-cols-2 gap-3 bg-secondary border border-border rounded-lg p-4">
          <div className="col-span-2 flex items-center justify-between">
            <p className="font-semibold text-foreground">{matched.name}</p>
            <Badge
              variant="outline"
              className={TRUST_LEVEL_COLORS[trustData.trustLevel]}
            >
              {TRUST_LEVEL_LABELS[trustData.trustLevel]}
            </Badge>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">
              {strings.onlineOrders.totalOnlineOrders}
            </Label>
            <p className="text-sm font-medium text-foreground">
              {trustData.totalOrders}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">
              {strings.onlineOrders.successRate}
            </Label>
            <p className="text-sm font-medium text-foreground">
              {Math.round(trustData.successRate * 100)}%
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">
              {strings.onlineOrders.successfulOrders}
            </Label>
            <p className="text-sm font-medium text-emerald-600">
              {trustData.successfulOrders}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">
              {strings.onlineOrders.cancelledOrders} /{" "}
              {strings.onlineOrders.notReceivedOrders}
            </Label>
            <p className="text-sm font-medium text-rose-500">
              {trustData.cancelledOrders} / {trustData.notReceivedOrders}
            </p>
          </div>
        </div>
      )}

      <div>
        <Label className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          {strings.onlineOrders.customerName} *
        </Label>
        <Input
          value={customerName}
          onChange={(e) => onChange("customerName", e.target.value)}
          disabled={!!matched}
        />
      </div>

      <div>
        <Label className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          {strings.onlineOrders.address} *
        </Label>
        <Input
          value={addressText}
          onChange={(e) => onChange("addressText", e.target.value)}
          placeholder={strings.onlineOrdersExtra.addressDetailPlaceholder}
        />
      </div>

      <div>
        <Label className="text-muted-foreground text-xs">
          {strings.onlineOrders.addressLabel}
        </Label>
        <Input
          value={addressLabel}
          onChange={(e) => onChange("addressLabel", e.target.value)}
          placeholder={strings.onlineOrdersExtra.addressLabelPlaceholder}
        />
      </div>

      {!matched && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="saveCustomer"
            checked={saveCustomer}
            onCheckedChange={(v) => onSaveCustomerChange(!!v)}
          />
          <Label htmlFor="saveCustomer" className="text-sm cursor-pointer">
            {strings.onlineOrdersExtra.saveCustomerToList}
          </Label>
        </div>
      )}
    </div>
  );
}
