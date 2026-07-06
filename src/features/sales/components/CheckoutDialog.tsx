import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  User,
  CreditCard,
  Loader2,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { Money } from "@/lib/domain";
import { PremiumButton } from "@/components/ui/premium";
import { strings } from "@/lib/i18n/ar";
import { PaymentSplitEditor } from "./PaymentSplitEditor";
import type { PaymentSplit } from "./salesInterfaceTypes";
import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCustomers } from "@/features/customers-debts/hooks";
import type { Customer } from "@/features/customers-debts/types";
import type {
  OrderSource,
  OrderPaymentMethod,
} from "@/features/online-orders/types";
import type { CustomerAddress } from "@/lib/types";
import {
  TRUST_LEVEL_LABELS,
  TRUST_LEVEL_COLORS,
  ORDER_SOURCE_LABELS,
  ORDER_PAYMENT_METHOD_LABELS,
} from "@/lib/constants/onlineOrdersStatus";
import type { TrustLevelValue } from "@/lib/constants/onlineOrdersStatus";
import { MIN_PHONE_LOOKUP_LENGTH } from "@/lib/constants/customerLookup";

interface TrustData {
  trustLevel: TrustLevelValue;
  totalOrders: number;
  successfulOrders: number;
  cancelledOrders: number;
  notReceivedOrders: number;
  successRate: number;
}

interface CustomerInfo {
  name: string;
  phone: string;
  notes: string;
}

export interface OnlineOrderInfo {
  customerName: string;
  customerPhone: string;
  addressText: string;
  addressLabel: string;
  source: OrderSource;
  paymentMethod: OrderPaymentMethod;
  deliveryFee: number;
  prepaidAmount: number;
  notes: string;
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // onsite
  customerInfo: CustomerInfo;
  onCustomerInfoChange: (field: keyof CustomerInfo, value: string) => void;
  total: number;
  totalPaid: number;
  changeDue: number;
  remainingDebt: number;
  needsCustomerInfo: boolean;
  hasMissingReceipt: boolean;
  paymentSplits: PaymentSplit[];
  onAddSplit: () => void;
  onUpdateSplit: (id: string, updates: Partial<PaymentSplit>) => void;
  onRemoveSplit: (id: string) => void;
  // mode
  saleMode: "onsite" | "online";
  onSaleModeChange: (mode: "onsite" | "online") => void;
  // online
  onlineOrderInfo: OnlineOrderInfo;
  onOnlineOrderInfoChange: <K extends keyof OnlineOrderInfo>(
    field: K,
    value: OnlineOrderInfo[K],
  ) => void;
  // shared
  isProcessing: boolean;
  onConfirm: () => void;
  onSaveAsPreparing?: () => void;
  onCancel: () => void;
}

async function fetchCustomerDetails(customerId: string) {
  try {
    const addrRes = await window.api.customers.getAddresses(customerId);
    const addresses: CustomerAddress[] = addrRes.success
      ? (addrRes.data ?? [])
      : [];
    let trust: TrustData | null = null;
    try {
      const trustRes =
        await window.api.onlineOrders.calculateTrustLevel(customerId);
      if (trustRes.success && trustRes.data) {
        trust = trustRes.data as TrustData;
      }
    } catch {
      trust = null;
    }
    return { addresses, trust };
  } catch {
    return {
      addresses: [] as CustomerAddress[],
      trust: null as TrustData | null,
    };
  }
}

async function lookupCustomerByPhone(phone: string) {
  if (phone.length < MIN_PHONE_LOOKUP_LENGTH) return null;
  try {
    const res = await window.api.customers.getByAnyPhone(phone);
    if (!res.success || !res.data) return null;
    const customer = res.data;
    const { addresses, trust } = await fetchCustomerDetails(customer.id);
    return { customer, addresses, trust };
  } catch {
    return null;
  }
}

export const CheckoutDialog = ({
  open,
  onOpenChange,
  customerInfo,
  onCustomerInfoChange,
  total,
  totalPaid,
  changeDue,
  remainingDebt,
  needsCustomerInfo,
  hasMissingReceipt,
  paymentSplits,
  onAddSplit,
  onUpdateSplit,
  onRemoveSplit,
  saleMode,
  onSaleModeChange,
  onlineOrderInfo,
  onOnlineOrderInfoChange,
  isProcessing,
  onConfirm,
  onSaveAsPreparing,
  onCancel,
}: CheckoutDialogProps) => {
  const [foundAddresses, setFoundAddresses] = useState<CustomerAddress[]>([]);
  const [foundCustomerName, setFoundCustomerName] = useState<string>("");
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [trustData, setTrustData] = useState<TrustData | null>(null);
  const [nameComboOpen, setNameComboOpen] = useState(false);

  const { data: allCustomers = [] } = useCustomers(saleMode === "online");

  const filteredCustomers = useMemo(() => {
    const q = onlineOrderInfo.customerName.trim().toLowerCase();
    if (!q) return allCustomers.slice(0, 20);
    return allCustomers
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [allCustomers, onlineOrderInfo.customerName]);

  const handleSelectCustomerByName = async (customer: Customer) => {
    setNameComboOpen(false);
    setFoundCustomerName(customer.name);
    onOnlineOrderInfoChange("customerName", customer.name);
    if (customer.phone) {
      onOnlineOrderInfoChange("customerPhone", customer.phone);
    }
    const { addresses, trust } = await fetchCustomerDetails(customer.id);
    setFoundAddresses(addresses);
    setTrustData(trust);
    setUseCustomAddress(false);
    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
    if (defaultAddr) {
      onOnlineOrderInfoChange("addressText", defaultAddr.addressText);
      onOnlineOrderInfoChange("addressLabel", defaultAddr.label ?? "");
    } else {
      onOnlineOrderInfoChange("addressText", "");
      onOnlineOrderInfoChange("addressLabel", "");
    }
  };

  const handleClearMatchedCustomer = () => {
    setFoundCustomerName("");
    setFoundAddresses([]);
    setTrustData(null);
    setUseCustomAddress(false);
    onOnlineOrderInfoChange("customerName", "");
  };

  const onlineValid =
    saleMode === "online"
      ? onlineOrderInfo.customerPhone.trim().length > 0 &&
        onlineOrderInfo.addressText.trim().length > 0 &&
        (foundCustomerName.trim().length > 0 ||
          onlineOrderInfo.customerName.trim().length > 0)
      : true;

  const handlePhoneBlur = async () => {
    const phone = onlineOrderInfo.customerPhone.trim();
    if (!phone) return;
    const result = await lookupCustomerByPhone(phone);
    if (result) {
      setFoundAddresses(result.addresses);
      setTrustData(result.trust);
      setFoundCustomerName(result.customer.name);
      onOnlineOrderInfoChange("customerName", result.customer.name);
      const defaultAddr =
        result.addresses.find((a) => a.isDefault) ?? result.addresses[0];
      if (defaultAddr && !onlineOrderInfo.addressText) {
        onOnlineOrderInfoChange("addressText", defaultAddr.addressText);
        onOnlineOrderInfoChange("addressLabel", defaultAddr.label ?? "");
      }
    } else {
      setFoundAddresses([]);
      setTrustData(null);
    }
  };

  // reset when dialog closes
  useEffect(() => {
    if (!open) {
      setFoundAddresses([]);
      setFoundCustomerName("");
      setUseCustomAddress(false);
      setTrustData(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto space-y-6">
        <DialogHeader>
          <DialogTitle>{strings.sales.checkoutDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSaleModeChange("onsite")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                saleMode === "onsite"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              {strings.sales.saleModeOnsite}
            </button>
            <button
              type="button"
              onClick={() => onSaleModeChange("online")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                saleMode === "online"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Truck className="w-4 h-4" />
              {strings.sales.saleModeOnline}
            </button>
          </div>

          {/* ONSITE mode */}
          {saleMode === "onsite" && (
            <>
              <Card className="bg-secondary/50 border border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {strings.sales.customerInfoTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm font-semibold">
                        {strings.sales.customerNameLabel}
                      </Label>
                      <Input
                        value={customerInfo.name}
                        onChange={(e) =>
                          onCustomerInfoChange("name", e.target.value)
                        }
                        placeholder={strings.sales.customerNamePlaceholder}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">
                        {strings.sales.customerPhoneLabel}
                      </Label>
                      <Input
                        value={customerInfo.phone}
                        onChange={(e) =>
                          onCustomerInfoChange("phone", e.target.value)
                        }
                        placeholder={strings.sales.customerPhonePlaceholder}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">
                      {strings.sales.notesLabel}
                    </Label>
                    <Textarea
                      value={customerInfo.notes}
                      onChange={(e) =>
                        onCustomerInfoChange("notes", e.target.value)
                      }
                      placeholder={strings.sales.notesPlaceholder}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-secondary/50 border border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    {strings.sales.paymentDetailsTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted p-4 rounded-[var(--radius-lg)]">
                    <p className="text-sm text-muted-foreground">
                      {strings.sales.totalAmountLabel}
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {Money.from(total).toString()}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Label className="text-base font-semibold">
                        {strings.sales.paymentMethodsLabel}
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onAddSplit}
                      >
                        <Plus className="w-4 h-4 me-1" />
                        {strings.sales.addPaymentMethod}
                      </Button>
                    </div>
                    {paymentSplits.map((split, idx) => (
                      <PaymentSplitEditor
                        key={split.id}
                        split={split}
                        index={idx}
                        canRemove={paymentSplits.length > 1}
                        onUpdate={onUpdateSplit}
                        onRemove={onRemoveSplit}
                      />
                    ))}
                    <div className="bg-secondary p-3 rounded-[var(--radius-lg)] space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{strings.sales.totalPaidLabel}</span>
                        <span className="font-semibold text-green-600">
                          {Money.from(totalPaid).toString()}
                        </span>
                      </div>
                      {changeDue > 0 ? (
                        <div className="flex justify-between text-sm">
                          <span>{strings.sales.changeDueLabel}</span>
                          <span className="font-semibold text-blue-600">
                            {Money.from(changeDue).toString()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-sm">
                          <span>{strings.sales.remainingAmountLabel}</span>
                          <span
                            className={`font-semibold ${remainingDebt > 0 ? "text-red-600" : "text-green-600"}`}
                          >
                            {Money.from(remainingDebt).toString()}
                          </span>
                        </div>
                      )}
                      {needsCustomerInfo && (
                        <p className="text-sm text-red-600 font-semibold pt-1">
                          {strings.sales.needsCustomerInfoWarning}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ONLINE mode */}
          {saleMode === "online" && (
            <>
              <Card className="bg-secondary/50 border border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {strings.sales.customerDeliveryTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm font-semibold">
                        {strings.sales.customerNameRequired}
                      </Label>
                      {foundCustomerName ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={foundCustomerName}
                            disabled
                            className="opacity-60"
                          />
                          <button
                            type="button"
                            className="text-xs text-primary underline whitespace-nowrap shrink-0"
                            onClick={handleClearMatchedCustomer}
                          >
                            {strings.sales.changeLink}
                          </button>
                        </div>
                      ) : (
                        <Popover
                          open={nameComboOpen}
                          onOpenChange={setNameComboOpen}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full flex items-center justify-between gap-2 h-10 px-3 rounded-md border border-input bg-transparent text-sm"
                            >
                              <span
                                className={
                                  onlineOrderInfo.customerName
                                    ? ""
                                    : "text-muted-foreground"
                                }
                              >
                                {onlineOrderInfo.customerName ||
                                  strings.sales.customerNameLabel}{" "}
                              </span>
                              <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[--radix-popover-trigger-width] p-0"
                            align="start"
                          >
                            <Command shouldFilter={false}>
                              <input
                                value={onlineOrderInfo.customerName}
                                onChange={(e) =>
                                  onOnlineOrderInfoChange(
                                    "customerName",
                                    e.target.value,
                                  )
                                }
                                placeholder={
                                  strings.sales.searchOrTypeNamePlaceholder
                                }
                                className="w-full h-9 px-3 text-sm bg-transparent border-b border-border outline-none"
                              />
                              <CommandList>
                                <CommandEmpty className="p-3 text-xs text-muted-foreground text-center">
                                  {strings.sales.noCustomerFoundWillCreate}
                                </CommandEmpty>
                                <CommandGroup>
                                  {filteredCustomers.map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.id}
                                      onSelect={() =>
                                        handleSelectCustomerByName(c)
                                      }
                                    >
                                      <div className="flex flex-col">
                                        <span>{c.name}</span>
                                        {c.phone && (
                                          <span
                                            className="text-xs text-muted-foreground"
                                            dir="ltr"
                                          >
                                            {c.phone}
                                          </span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">
                        {strings.sales.customerPhoneRequired}
                      </Label>
                      <Input
                        value={onlineOrderInfo.customerPhone}
                        onChange={(e) => {
                          onOnlineOrderInfoChange(
                            "customerPhone",
                            e.target.value,
                          );
                          setFoundCustomerName("");
                          setFoundAddresses([]);
                          setUseCustomAddress(false);
                          setTrustData(null);
                        }}
                        onBlur={handlePhoneBlur}
                        placeholder="01xxxxxxxxx"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {trustData && (
                    <div className="grid grid-cols-2 gap-3 bg-secondary border border-border rounded-lg p-4">
                      <div className="col-span-2 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {strings.sales.customerClassification}
                        </p>
                        <Badge
                          variant="outline"
                          className={TRUST_LEVEL_COLORS[trustData.trustLevel]}
                        >
                          {TRUST_LEVEL_LABELS[trustData.trustLevel]}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          {strings.sales.totalOrdersLabel}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {trustData.totalOrders}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          {strings.sales.successRateLabel}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {Math.round(trustData.successRate * 100)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          {strings.sales.successfulOrdersLabel}
                        </p>
                        <p className="text-sm font-medium text-emerald-600">
                          {trustData.successfulOrders}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          {strings.sales.cancelledNotReceivedLabel}
                        </p>
                        <p className="text-sm font-medium text-rose-500">
                          {trustData.cancelledOrders} /{" "}
                          {trustData.notReceivedOrders}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm font-semibold">
                        {strings.sales.addressRequired}
                      </Label>{" "}
                      {foundAddresses.length > 0 && !useCustomAddress ? (
                        <Select
                          value={onlineOrderInfo.addressText}
                          onValueChange={(v) => {
                            if (v === "__custom__") {
                              onOnlineOrderInfoChange("addressText", "");
                              onOnlineOrderInfoChange("addressLabel", "");
                              setUseCustomAddress(true);
                              return;
                            }
                            setUseCustomAddress(false);
                            const addr = foundAddresses.find(
                              (a) => a.addressText === v,
                            );
                            onOnlineOrderInfoChange("addressText", v);
                            onOnlineOrderInfoChange(
                              "addressLabel",
                              addr?.label ?? "",
                            );
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                strings.sales.selectAddressPlaceholder
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {foundAddresses.map((addr) => (
                              <SelectItem
                                key={addr.id}
                                value={addr.addressText}
                              >
                                {addr.label ? `${addr.label} — ` : ""}
                                {addr.addressText}
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__">
                              {strings.sales.newAddressOption}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-1">
                          <Input
                            value={onlineOrderInfo.addressText}
                            onChange={(e) =>
                              onOnlineOrderInfoChange(
                                "addressText",
                                e.target.value,
                              )
                            }
                            placeholder={strings.sales.addressDetailPlaceholder}
                          />
                          {foundAddresses.length > 0 && useCustomAddress && (
                            <button
                              type="button"
                              className="text-xs text-primary underline"
                              onClick={() => {
                                setUseCustomAddress(false);
                                onOnlineOrderInfoChange("addressText", "");
                                onOnlineOrderInfoChange("addressLabel", "");
                              }}
                            >
                              {strings.sales.savedAddressesBack}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">
                        {strings.sales.addressLabelField}
                      </Label>
                      <Input
                        value={onlineOrderInfo.addressLabel}
                        onChange={(e) =>
                          onOnlineOrderInfoChange(
                            "addressLabel",
                            e.target.value,
                          )
                        }
                        placeholder={strings.sales.addressLabelPlaceholder}
                        disabled={
                          foundAddresses.length > 0 && !useCustomAddress
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm font-semibold">
                        {strings.sales.orderSourceLabel}
                      </Label>
                      <Select
                        value={onlineOrderInfo.source}
                        onValueChange={(v) =>
                          onOnlineOrderInfoChange("source", v as OrderSource)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.entries(ORDER_SOURCE_LABELS) as [
                              OrderSource,
                              string,
                            ][]
                          ).map(([val, label]) => (
                            <SelectItem key={val} value={val}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">
                        {strings.sales.paymentMethodLabel}
                      </Label>
                      <Select
                        value={onlineOrderInfo.paymentMethod}
                        onValueChange={(v) =>
                          onOnlineOrderInfoChange(
                            "paymentMethod",
                            v as OrderPaymentMethod,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.entries(ORDER_PAYMENT_METHOD_LABELS) as [
                              OrderPaymentMethod,
                              string,
                            ][]
                          ).map(([val, label]) => (
                            <SelectItem key={val} value={val}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm font-semibold">
                        {strings.sales.deliveryFeeLabel}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={onlineOrderInfo.deliveryFee}
                        onChange={(e) =>
                          onOnlineOrderInfoChange(
                            "deliveryFee",
                            Number(e.target.value),
                          )
                        }
                        placeholder="0"
                        dir="ltr"
                      />
                    </div>
                    {onlineOrderInfo.paymentMethod === "partial" && (
                      <div>
                        <Label className="text-sm font-semibold">
                          {strings.sales.prepaidAmountLabel}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={onlineOrderInfo.prepaidAmount}
                          onChange={(e) =>
                            onOnlineOrderInfoChange(
                              "prepaidAmount",
                              Number(e.target.value),
                            )
                          }
                          placeholder="0"
                          dir="ltr"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">
                      {strings.sales.notesLabel}
                    </Label>
                    <Textarea
                      value={onlineOrderInfo.notes}
                      onChange={(e) =>
                        onOnlineOrderInfoChange("notes", e.target.value)
                      }
                      placeholder={strings.sales.driverNotesPlaceholder}
                      rows={2}
                    />
                  </div>

                  {/* Summary */}
                  <div className="bg-muted p-4 rounded-[var(--radius-lg)] space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {strings.sales.productsTotalLabel}
                      </span>
                      <span className="font-semibold">
                        {Money.from(total).toString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {strings.sales.deliveryFeeColonLabel}
                      </span>
                      <span className="font-semibold">
                        {Money.from(onlineOrderInfo.deliveryFee).toString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-border pt-1 mt-1">
                      <span>{strings.sales.grandTotalLabel}</span>
                      <span className="text-primary">
                        {Money.from(
                          total + onlineOrderInfo.deliveryFee,
                        ).toString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {saleMode === "online" && onSaveAsPreparing && (
              <Button
                variant="outline"
                className="flex-1 border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                onClick={onSaveAsPreparing}
                disabled={isProcessing || !onlineValid}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                ) : null}
                {strings.onlineOrders.saveAsPreparing}
              </Button>
            )}
            <PremiumButton
              className="flex-1"
              onClick={onConfirm}
              disabled={
                isProcessing ||
                (saleMode === "onsite" &&
                  (needsCustomerInfo || hasMissingReceipt)) ||
                (saleMode === "online" && !onlineValid)
              }
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : null}
              {isProcessing
                ? strings.sales.processingLabel
                : saleMode === "online"
                  ? strings.sales.createOrderButton
                  : strings.sales.confirmSaleButton}
            </PremiumButton>
            <Button variant="outline" className="sm:w-40" onClick={onCancel}>
              {strings.sales.cancel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
