import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Receipt, Loader2 } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import {
  usePurchaseInvoices,
  useSavePurchase,
  useAddPurchasePayment,
} from "@/features/purchases/hooks";
import { useCategories } from "@/lib/hooks";
import type { PurchaseInvoice } from "@/features/purchases/types";
import type { InvoiceItem, PaymentMethod } from "@/lib/types";
import { StatusFilterBar } from "./StatusFilterBar";
import { PurchaseInvoiceRow } from "./PurchaseInvoiceRow";
import { AddPurchaseInvoiceDialog } from "./AddPurchaseInvoiceDialog";
import { PurchaseInvoiceDetailsDialog } from "./PurchaseInvoiceDetailsDialog";
import { AddPaymentDialog } from "./AddPaymentDialog";
import { ReceiptPreviewDialog } from "./ReceiptPreviewDialog";
import { EMPTY_ITEM, EMPTY_INVOICE, getStatus } from "./purchaseInvoiceHelpers";
import { Money } from "@/lib/domain";
import { strings } from "@/lib/i18n/ar";
import { getLanguage } from "@/lib/i18n/store";

interface PurchaseInvoicesProps {
  isAdmin: boolean;
}
const PurchaseInvoices = ({ isAdmin }: PurchaseInvoicesProps) => {
  const { data: invoices = [], isLoading: loadingInv } =
    usePurchaseInvoices(isAdmin);
  const { data: categories = [], isLoading: loadingCats } = useCategories();
  const savePurchase = useSavePurchase();
  const addPayment = useAddPurchasePayment();
  const loading = loadingInv || loadingCats;
  const [saving, setSaving] = useState(false);
  const [selectedInvoice, setSelectedInvoice] =
    useState<PurchaseInvoice | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState(EMPTY_INVOICE);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    { ...EMPTY_ITEM },
  ]);
  const [paymentData, setPaymentData] = useState<{
    amount: number;
    receiptImage: string;
    method: PaymentMethod;
  }>({
    amount: 0,
    receiptImage: "",
    method: "cash",
  });
  const [statusFilter, setStatusFilter] = useState<
    "all" | "paid" | "partial" | "unpaid"
  >("all");
  const { toast } = useToast();
  if (!isAdmin) return null;
  const calcTotal = () =>
    invoiceItems.reduce((s, i) => s + (i.itemTotal ?? 0), 0);
  const filteredInvoices = invoices.filter(
    (inv) => statusFilter === "all" || inv.status === statusFilter,
  );
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = calcTotal();
    if (!invoiceData.supplier || !invoiceData.date) {
      toast({
        title: strings.common.missingData,
        description: strings.common.fillRequiredFields,
        variant: "destructive",
      });
      return;
    }
    const validItems = invoiceItems.filter(
      (i) => i.barcode && i.quantity > 0 && (i.itemTotal ?? 0) > 0,
    );
    if (validItems.length === 0) {
      toast({
        title: strings.purchases.incompleteItemsTitle,
        description: strings.purchases.incompleteItemsDesc,
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const locale = getLanguage() === "ar" ? "ar-EG" : "en-US";
      const saved = await savePurchase.mutateAsync({
        invoiceNumber: invoiceData.invoiceNumber,
        supplier: invoiceData.supplier,
        date: invoiceData.date,
        time: new Date().toLocaleTimeString(locale),
        items: validItems,
        total,
        status: getStatus(invoiceData.paidAmount, total),

        paidAmount: invoiceData.paidAmount,
        paymentHistory: [],
        receiptImage: invoiceData.receiptImage || undefined,
        method: invoiceData.method,
      });
      toast({
        title: strings.purchases.invoiceSaved,
        description: strings.purchases.invoiceNumberDesc.replace(
          "{invoiceNumber}",
          saved.invoiceNumber,
        ),
      });
      const newProds =
        (saved as typeof saved & { newProducts?: string[] }).newProducts ?? [];
      if (newProds.length > 0) {
        setTimeout(() => {
          toast({
            title: strings.purchases.newProductsAddedTitle.replace(
              "{count}",
              String(newProds.length),
            ),
            description: strings.purchases.newProductsAddedDesc,
            variant: "destructive",
          });
        }, 800);
      }
      setIsAddOpen(false);
      setInvoiceData(EMPTY_INVOICE);
      setInvoiceItems([{ ...EMPTY_ITEM }]);
    } catch (err) {
      toast({
        title: strings.purchases.saveError,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  const handlePaymentUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (paymentData.amount <= 0) {
      toast({ title: strings.common.invalidAmount, variant: "destructive" });
      return;
    }
    if (
      selectedInvoice.paidAmount + paymentData.amount >
      selectedInvoice.total
    ) {
      toast({
        title: strings.purchases.amountExceedsRemaining,
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      await addPayment.mutateAsync({
        invoiceId: selectedInvoice.id,
        paymentData: {
          amount: paymentData.amount,
          receiptImage:
            paymentData.method === "cash"
              ? undefined
              : paymentData.receiptImage,
          method: paymentData.method,
        },
      });
      toast({
        title: strings.purchases.paymentUpdated,
        description: Money.from(paymentData.amount).toString(),
      });
      setIsPaymentOpen(false);
      setPaymentData({
        amount: 0,
        receiptImage: "",
        method: "cash",
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
  const updateItem = (
    idx: number,
    field: keyof InvoiceItem,
    value: string | number,
  ) =>
    setInvoiceItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  const removeItem = (idx: number) => {
    if (invoiceItems.length > 1)
      setInvoiceItems((prev) => prev.filter((_, i) => i !== idx));
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ms-3 text-muted-foreground">
          {strings.purchases.loadingInvoices}
        </span>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <Card className="bg-card backdrop-blur-sm border border-border shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FileText className="w-6 h-6" />
                {strings.nav.purchaseInvoices}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {strings.purchases.totalInvoicesLabel.replace(
                  "{count}",
                  String(invoices.length),
                )}
              </p>
            </div>
            <AddPurchaseInvoiceDialog
              open={isAddOpen}
              onOpenChange={setIsAddOpen}
              invoiceData={invoiceData}
              onInvoiceDataChange={(updates) =>
                setInvoiceData((p) => ({ ...p, ...updates }))
              }
              invoiceItems={invoiceItems}
              onUpdateItem={updateItem}
              onAddItemRow={() =>
                setInvoiceItems((p) => [...p, { ...EMPTY_ITEM }])
              }
              onRemoveItemRow={removeItem}
              categories={categories}
              calcTotal={calcTotal}
              saving={saving}
              onSubmit={handleSubmit}
            />{" "}
          </div>
        </CardHeader>
      </Card>
      <StatusFilterBar statusFilter={statusFilter} onChange={setStatusFilter} />

      <Card className="bg-card backdrop-blur-sm border border-border shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Receipt className="w-5 h-5" />
            {strings.purchases.invoiceListTitle.replace(
              "{count}",
              String(filteredInvoices.length),
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4" />
              <p>{strings.purchases.noInvoices}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <PurchaseInvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    setIsDetailsOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <PurchaseInvoiceDetailsDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        invoice={selectedInvoice}
        categories={categories}
        onAddPayment={() => {
          setPaymentData({ amount: 0, receiptImage: "", method: "cash" });
          setIsPaymentOpen(true);
        }}
        onPreviewImage={setPreviewImage}
      />
      <AddPaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        paymentData={paymentData}
        onPaymentDataChange={(updates) =>
          setPaymentData((p) => ({ ...p, ...updates }))
        }
        selectedInvoice={selectedInvoice}
        saving={saving}
        onSubmit={handlePaymentUpdate}
      />
      <ReceiptPreviewDialog
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};
export default PurchaseInvoices;
