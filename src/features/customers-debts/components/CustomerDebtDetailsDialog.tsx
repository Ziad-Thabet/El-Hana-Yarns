import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Money } from "@/lib/domain";
import {
  useAddDebtPayment,
  useAddBulkDebtPayment,
} from "@/features/customers-debts/hooks";
import type { CustomerDebt } from "@/features/customers-debts/types";
import { SuccessButton } from "@/components/ui/premium";
import type { CustomerDebtGroup } from "./customerDebtsHelpers";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payment";
import { strings } from "@/lib/i18n/ar";

type SimplePaymentMethod = "cash" | "vodafone" | "instapay";
const SIMPLE_PAYMENT_METHODS: SimplePaymentMethod[] = [
  "cash",
  "vodafone",
  "instapay",
];
function readFileAsDataURL(file: File, onLoaded: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = (ev) => onLoaded(ev.target?.result as string);
  reader.readAsDataURL(file);
}

interface CustomerDebtDetailsDialogProps {
  group: CustomerDebtGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDebtDetailsDialog({
  group,
  open,
  onOpenChange,
}: CustomerDebtDetailsDialogProps) {
  const addDebtPayment = useAddDebtPayment();
  const addBulkDebtPayment = useAddBulkDebtPayment();
  const { toast } = useToast();

  const [localGroup, setLocalGroup] = useState<CustomerDebtGroup | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "vodafone" | "instapay">(
    "cash",
  );
  const [payReceipt, setPayReceipt] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [bulkPayAmount, setBulkPayAmount] = useState("");
  const [bulkPayMethod, setBulkPayMethod] = useState<
    "cash" | "vodafone" | "instapay"
  >("cash");

  const [bulkPayReceipt, setBulkPayReceipt] = useState("");
  const [bulkPayNotes, setBulkPayNotes] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalGroup(group);
      setPayingInvoiceId(null);
      resetPaymentForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.customerId]);

  const resetPaymentForm = () => {
    setPayAmount("");
    setPayMethod("cash");
    setPayReceipt("");
    setPayNotes("");
  };

  const handlePayment = async (debt: CustomerDebt) => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast({ title: strings.common.invalidAmount, variant: "destructive" });
      return;
    }
    if (amount > debt.remainingAmount) {
      toast({
        title: strings.debts.amountExceedsInvoiceRemaining,
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const updated = await addDebtPayment.mutateAsync({
        debtId: debt.id,
        paymentData: {
          amount,
          method: payMethod,
          receiptImage: payReceipt || undefined,
          notes: payNotes || undefined,
        },
      });
      setLocalGroup((prev) => {
        if (!prev) return prev;
        const updatedInvoices = prev.invoices.map((inv) =>
          inv.id === updated.id ? updated : inv,
        );
        return {
          ...prev,
          invoices: updatedInvoices,
          paidAmount: updatedInvoices.reduce((s, i) => s + i.paidAmount, 0),
          remainingAmount: updatedInvoices.reduce(
            (s, i) => s + i.remainingAmount,
            0,
          ),
        };
      });
      toast({
        title: strings.debts.paymentRecorded,
        description: `${Money.from(amount).toString()} — ${updated.customerName}`,
      });
      resetPaymentForm();
      setPayingInvoiceId(null);
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkPayment = async () => {
    if (!localGroup) return;
    const amount = parseFloat(bulkPayAmount);
    if (!amount || amount <= 0) {
      toast({ title: strings.common.invalidAmount, variant: "destructive" });
      return;
    }
    if (amount > localGroup.remainingAmount) {
      toast({
        title: strings.debts.amountExceedsTotalRemaining,
        variant: "destructive",
      });
      return;
    }
    try {
      setBulkSaving(true);
      const updatedDebts = await addBulkDebtPayment.mutateAsync({
        customerId: localGroup.customerId,
        amount,
        paymentData: {
          method: bulkPayMethod,
          receiptImage: bulkPayReceipt || undefined,
          notes: bulkPayNotes || undefined,
        },
      });
      setLocalGroup((prev) => {
        if (!prev) return prev;
        const updatedMap = new Map(updatedDebts.map((d) => [d.id, d]));
        const updatedInvoices = prev.invoices.map(
          (inv) => updatedMap.get(inv.id) ?? inv,
        );
        return {
          ...prev,
          invoices: updatedInvoices,
          paidAmount: updatedInvoices.reduce((s, i) => s + i.paidAmount, 0),
          remainingAmount: updatedInvoices.reduce(
            (s, i) => s + i.remainingAmount,
            0,
          ),
        };
      });
      toast({
        title: strings.debts.bulkPaymentRecorded,
        description: `${Money.from(amount).toString()} — ${localGroup.customerName}`,
      });
      setBulkPayAmount("");
      setBulkPayMethod("cash");
      setBulkPayReceipt("");
      setBulkPayNotes("");
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {strings.debts.debtDetailsTitle}
          </DialogTitle>
        </DialogHeader>
        {localGroup && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 bg-secondary border border-border rounded-lg p-5">
              {[
                {
                  label: strings.common.customer,
                  value: localGroup.customerName,
                },
                {
                  label: strings.debts.phoneNumberLabel,
                  value: localGroup.customerPhone || strings.debts.notAvailable,
                },
                {
                  label: strings.debts.totalAllInvoicesLabel,
                  value: Money.from(localGroup.totalAmount).toString(),
                },
                {
                  label: strings.debts.totalRemainingLabel,
                  value: Money.from(localGroup.remainingAmount).toString(),
                  red: true,
                },
              ].map((item) => (
                <div key={item.label}>
                  <Label className="text-muted-foreground">{item.label}</Label>
                  <p
                    className={`font-semibold ${item.red ? "text-rose-400" : "text-foreground"}`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            {localGroup.remainingAmount > 0 && (
              <div className="bg-secondary border border-border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {strings.debts.bulkPaymentTitle}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {strings.debts.bulkPaymentDesc}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">
                      {strings.common.amount}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bulkPayAmount}
                      onChange={(e) => setBulkPayAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-secondary text-foreground border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      {strings.common.paymentMethod}
                    </Label>
                    <Select
                      value={bulkPayMethod}
                      onValueChange={(v) =>
                        setBulkPayMethod(v as typeof bulkPayMethod)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIMPLE_PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      {strings.debts.receiptImageLabel}
                    </Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        readFileAsDataURL(f, setBulkPayReceipt);
                      }}
                      className="bg-secondary text-foreground border-border"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    {strings.sales.notesLabel}
                  </Label>
                  <Textarea
                    value={bulkPayNotes}
                    onChange={(e) => setBulkPayNotes(e.target.value)}
                    placeholder={strings.sales.notesPlaceholder}
                    rows={2}
                    className="bg-secondary text-foreground border-border"
                  />
                </div>
                <SuccessButton
                  onClick={handleBulkPayment}
                  disabled={bulkSaving}
                  className="w-full"
                >
                  {bulkSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  ) : null}
                  {strings.debts.bulkPayButton.replace(
                    "{amount}",
                    bulkPayAmount || "0",
                  )}
                </SuccessButton>
              </div>
            )}
            <div className="space-y-4">
              <Label className="text-base font-semibold block text-foreground">
                {strings.debts.customerInvoicesTitle}
              </Label>
              {localGroup.invoices.map((debt) => (
                <div
                  key={debt.id}
                  className="border border-border rounded-lg p-4 space-y-3 bg-secondary/40"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {debt.invoiceNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {debt.createdDate}
                      </p>
                    </div>
                    <div className="text-end space-y-0.5">
                      <p className="text-sm">
                        {strings.debts.totalColon}{" "}
                        <span className="font-semibold">
                          {Money.from(debt.totalAmount).toString()}
                        </span>
                      </p>
                      <p className="text-sm text-green-600">
                        {strings.debts.paidColon}{" "}
                        {Money.from(debt.paidAmount).toString()}
                      </p>
                      <p className="text-sm text-rose-400 font-semibold">
                        {strings.debts.remainingColon}{" "}
                        {Money.from(debt.remainingAmount).toString()}
                      </p>
                    </div>
                  </div>
                  {debt.paymentHistory.length > 0 && (
                    <div className="space-y-1.5">
                      {debt.paymentHistory.map((p) => (
                        <div
                          key={p.id}
                          className="flex justify-between text-xs bg-secondary border border-border rounded p-2"
                        >
                          <span className="font-semibold text-emerald-300">
                            {Money.from(p.amount).toString()}
                          </span>
                          <span className="text-muted-foreground">
                            {p.date} — {p.method}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {debt.remainingAmount > 0 ? (
                    payingInvoiceId === debt.id ? (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-muted-foreground text-xs">
                              {strings.common.amount}
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              placeholder="0.00"
                              className="bg-secondary text-foreground border-border"
                            />
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">
                              {strings.common.paymentMethod}
                            </Label>
                            <Select
                              value={payMethod}
                              onValueChange={(v) =>
                                setPayMethod(v as typeof payMethod)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SIMPLE_PAYMENT_METHODS.map((m) => (
                                  <SelectItem key={m} value={m}>
                                    {PAYMENT_METHOD_LABELS[m]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">
                              {strings.debts.receiptImageLabel}
                            </Label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                readFileAsDataURL(f, setPayReceipt);
                              }}
                              className="bg-secondary text-foreground border-border"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">
                            {strings.sales.notesLabel}
                          </Label>
                          <Textarea
                            value={payNotes}
                            onChange={(e) => setPayNotes(e.target.value)}
                            placeholder={strings.sales.notesPlaceholder}
                            rows={2}
                            className="bg-secondary text-foreground border-border"
                          />
                        </div>
                        <div className="flex gap-2">
                          <SuccessButton
                            onClick={() => handlePayment(debt)}
                            disabled={saving}
                            className="flex-1"
                          >
                            {saving ? (
                              <Loader2 className="w-4 h-4 animate-spin me-2" />
                            ) : null}
                            {strings.debts.registerPaymentButton}
                          </SuccessButton>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setPayingInvoiceId(null);
                              resetPaymentForm();
                            }}
                          >
                            {strings.sales.cancel}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          resetPaymentForm();
                          setPayingInvoiceId(debt.id);
                        }}
                      >
                        {strings.debts.registerPaymentOnInvoice}
                      </Button>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {strings.debts.fullyPaidCheck}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {strings.common.close}
              </Button>
            </div>{" "}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
