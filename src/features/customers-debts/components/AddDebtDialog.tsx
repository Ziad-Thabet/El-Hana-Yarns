import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAddDebt } from "@/features/customers-debts/hooks";
import type { Customer } from "@/features/customers-debts/types";
import { PremiumButton } from "@/components/ui/premium";
import { strings } from "@/lib/i18n/ar";
import { getLanguage } from "@/lib/i18n/store";

interface AddDebtDialogProps {
  customers: Customer[];
}

export function AddDebtDialog({ customers }: AddDebtDialogProps) {
  const addDebt = useAddDebt();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDebt, setNewDebt] = useState({
    customerId: "",
    customerName: "",
    invoiceNumber: "",
    totalAmount: "",
    paidAmount: "0",
    notes: "",
  });

  const handleAddDebt = async () => {
    if (
      !newDebt.customerId ||
      !newDebt.totalAmount ||
      !newDebt.invoiceNumber.trim()
    ) {
      toast({
        title: strings.common.missingData,
        description: strings.common.fillRequiredFields,
        variant: "destructive",
      });
      return;
    }
    const total = parseFloat(newDebt.totalAmount);
    const paid = parseFloat(newDebt.paidAmount) || 0;
    if (total <= 0) {
      toast({ title: strings.common.invalidAmount, variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const customer = customers.find((c) => c.id === newDebt.customerId)!;
      const locale = getLanguage() === "ar" ? "ar-EG" : "en-US";
      await addDebt.mutateAsync({
        customerId: newDebt.customerId,
        customerName: customer.name,
        invoiceNumber: newDebt.invoiceNumber.trim(),
        invoiceId: undefined,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: total - paid,
        createdDate: new Date().toLocaleDateString(locale),
        lastUpdated: new Date().toLocaleDateString(locale),
        notes: newDebt.notes || undefined,
      });
      toast({ title: strings.debts.debtAdded });
      setOpen(false);
      setNewDebt({
        customerId: "",
        customerName: "",
        invoiceNumber: "",
        totalAmount: "",
        paidAmount: "0",
        notes: "",
      });
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="fixed bottom-6 left-6">
          <PremiumButton
            size="icon"
            className="rounded-full h-14 w-14 shadow-glow"
          >
            <Plus className="w-6 h-6" />
          </PremiumButton>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{strings.debts.addDebtTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{strings.debts.customerRequired}</Label>
            <Select
              value={newDebt.customerId}
              onValueChange={(v) => {
                const c = customers.find((c) => c.id === v);
                setNewDebt((p) => ({
                  ...p,
                  customerId: v,
                  customerName: c?.name ?? "",
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={strings.debts.selectCustomerPlaceholder}
                />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{strings.debts.invoiceNumberRequired}</Label>
            <Input
              value={newDebt.invoiceNumber}
              onChange={(e) =>
                setNewDebt((p) => ({ ...p, invoiceNumber: e.target.value }))
              }
              placeholder={strings.debts.invoiceNumberPlaceholder}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{strings.debts.totalAmountRequired}</Label>
              <Input
                type="number"
                step="0.01"
                value={newDebt.totalAmount}
                onChange={(e) =>
                  setNewDebt((p) => ({ ...p, totalAmount: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{strings.debts.prepaidAmountLabel}</Label>
              <Input
                type="number"
                step="0.01"
                value={newDebt.paidAmount}
                onChange={(e) =>
                  setNewDebt((p) => ({ ...p, paidAmount: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <Label>{strings.sales.notesLabel}</Label>
            <Textarea
              value={newDebt.notes}
              onChange={(e) =>
                setNewDebt((p) => ({ ...p, notes: e.target.value }))
              }
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <PremiumButton
              onClick={handleAddDebt}
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : null}
              {strings.debts.addButton}
            </PremiumButton>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {strings.sales.cancel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
