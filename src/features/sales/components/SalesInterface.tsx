import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

import { ProductModel, Money } from "@/lib/domain";
import { productsApi } from "@/lib/api";
import { useProductsForSales } from "@/lib/hooks";
import {
  useCompleteSale,
  useCreateOnlineOrderFromPOS,
} from "@/features/sales/hooks";
import { useCart } from "@/components/useCart";
import type { Shift } from "@/features/sales/types";
import type { Product, CartItem } from "@/lib/types";
import { InvoicePrint } from "@/components/InvoicePrint";
import { QuantityDialog } from "./QuantityDialog";
import { BarcodeScannerCard } from "./BarcodeScannerCard";
import { ProductGrid } from "@/components/products/ProductGrid";
import { CartPanel } from "./CartPanel";
import { CheckoutDialog } from "./CheckoutDialog";
import { ChangeConfirmDialog } from "./ChangeConfirmDialog";
import type { PaymentSplit, QuantityDialogState } from "./salesInterfaceTypes";
import type { OnlineOrderInfo } from "./CheckoutDialog";
import type {
  OrderSource,
  OrderPaymentMethod,
} from "@/features/online-orders/types";
import { formatDateYMD } from "../../../../shared/dateRules.mjs";
import { strings } from "@/lib/i18n/ar";
import { getLanguage } from "@/lib/i18n/store";

interface SalesInterfaceProps {
  cashier: string;
  userId: string;
  onShiftCreated?: (shift: Shift) => void;
}
const SalesInterface = ({
  cashier,
  userId,
  onShiftCreated,
}: SalesInterfaceProps) => {
  const { cart, addToCart, updateQuantity, removeItem, clearCart, total } =
    useCart();
  const { data: products = [], isLoading: loadingProducts } =
    useProductsForSales();
  const completeSale = useCompleteSale();
  const createOnlineOrder = useCreateOnlineOrderFromPOS();
  const [barcode, setBarcode] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChangeConfirmOpen, setIsChangeConfirmOpen] = useState(false);

  const [qtyDialog, setQtyDialog] = useState<QuantityDialogState>({
    open: false,
    product: null,
  });
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([
    { id: `split_${Date.now()}`, method: "cash", amount: 0 },
  ]);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    notes: "",
  });
  const [saleMode, setSaleMode] = useState<"onsite" | "online">("onsite");
  const [onlineOrderInfo, setOnlineOrderInfo] = useState<OnlineOrderInfo>({
    customerName: "",
    customerPhone: "",
    addressText: "",
    addressLabel: "",
    source: "whatsapp",
    paymentMethod: "cod",
    deliveryFee: 0,
    prepaidAmount: 0,
    notes: "",
  });
  const { toast } = useToast();
  const [printData, setPrintData] = useState<{
    invoiceNumber: string;
    date: string;
    time: string;
    items: CartItem[];
    total: number;
    paidAmount?: number;
    remainingAmount?: number;
  } | null>(null);

  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast({
        title: strings.sales.productUnavailable,
        description: strings.sales.outOfStockDesc.replace(
          "{name}",
          product.name,
        ),
        variant: "destructive",
      });
      return;
    }
    if (product.unit === "piece") {
      const result = addToCart(product, 1);
      if (!result.ok) {
        toast({
          title: strings.sales.insufficientStock,
          description: strings.sales.availableStockDesc
            .replace("{available}", String(result.available ?? 0))
            .replace("{unit}", new ProductModel(product).unitDisplay),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: strings.sales.addedToCart,
        description: product.name,
      });
      return;
    }
    setQtyDialog({ open: true, product });
  };
  const confirmQuantity = (amount: number) => {
    const product = qtyDialog.product;
    if (!product) return;
    const result = addToCart(product, amount);
    if (!result.ok) {
      toast({
        title: strings.sales.insufficientStock,
        description: strings.sales.availableStockDesc
          .replace("{available}", String(result.available ?? 0))
          .replace("{unit}", new ProductModel(product).unitDisplay),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: strings.sales.addedToCart,
      description: `${product.name} — ${amount} ${new ProductModel(product).unitDisplay}`,
    });
    setQtyDialog({ open: false, product: null });
  };
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let product = products.find((p) => p.barcode === barcode);
    if (!product) {
      try {
        product = await productsApi.getByBarcode(barcode);
      } catch {
        toast({
          title: strings.sales.productNotFound,
          description: strings.sales.productNotFoundDesc,
          variant: "destructive",
        });
        return;
      }
    }
    handleAddToCart(product);
    setBarcode("");
  };
  const hasMissingReceipt = false;
  const totalPaid = paymentSplits.reduce((sum, s) => sum + s.amount, 0);
  const changeDue = Math.max(0, totalPaid - total);
  const remainingDebt = Math.max(0, total - totalPaid);
  const needsCustomerInfo =
    remainingDebt > 0 &&
    (!customerInfo.name.trim() || !customerInfo.phone.trim());
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({ title: strings.sales.emptyCart, variant: "destructive" });
      return;
    }
    setIsCheckoutOpen(true);
  };
  const completeCheckout = async (asPreparing = false) => {
    try {
      setIsProcessing(true);

      if (saleMode === "online") {
        await createOnlineOrder.mutateAsync({
          customerName:
            onlineOrderInfo.customerName || onlineOrderInfo.customerPhone,
          customerPhone: onlineOrderInfo.customerPhone,
          addressText: onlineOrderInfo.addressText,
          addressLabel: onlineOrderInfo.addressLabel || null,
          source: onlineOrderInfo.source,
          paymentMethod: onlineOrderInfo.paymentMethod,
          deliveryFee: onlineOrderInfo.deliveryFee,
          prepaidAmount: onlineOrderInfo.prepaidAmount,
          notes: onlineOrderInfo.notes || null,
          createdBy: userId,
          initialStatus: asPreparing ? "preparing" : undefined,
          items: cart.map((item) => ({
            productId: item.productId ?? null,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            isWeighted: item.isWeighted ?? false,
            weightGrams: item.weightGrams ?? null,
            measureAmount: item.measureAmount ?? null,
            measureUnit: item.measureUnit ?? null,
            pricePerKg: item.pricePerKg ?? null,
          })),
        });
        toast({
          title: asPreparing
            ? strings.onlineOrders.orderSavedAsPreparing
            : strings.onlineOrders.orderCreated,
          description: strings.sales.newOnlineOrderDesc.replace(
            "{amount}",
            Money.from(total).toString(),
          ),
        });
        clearCart();
        setIsCheckoutOpen(false);
        setSaleMode("onsite");
        setOnlineOrderInfo({
          customerName: "",
          customerPhone: "",
          addressText: "",
          addressLabel: "",
          source: "whatsapp",
          paymentMethod: "cod",
          deliveryFee: 0,
          prepaidAmount: 0,
          notes: "",
        });
        return;
      }

      const now = new Date();
      const todayDate = formatDateYMD(now);
      const nowIso = now.toISOString();
      let shiftId: string | null = null;
      try {
        const shiftRes = await window.api.shifts.getOrCreate(
          userId,
          todayDate,
          nowIso,
        );
        if (shiftRes.success && shiftRes.data) {
          shiftId = shiftRes.data.id;
          onShiftCreated?.(shiftRes.data);
        } else {
          toast({
            title: strings.sales.shiftLinkWarningTitle,
            description: strings.sales.shiftLinkWarningDesc,
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: strings.sales.shiftLinkWarningTitle,
          description: strings.sales.shiftLinkWarningDesc,
          variant: "destructive",
        });
      }
      const result = await completeSale.mutateAsync({
        items: cart,
        total,
        cashier,
        shiftId,
        totalPaid,
        paymentMethod: paymentSplits[0]?.method ?? "cash",
        paymentSplits: paymentSplits
          .filter((s) => s.amount > 0)
          .map((s) => ({
            method: s.method,
            amount: s.amount,
            receiptImage: s.receiptImage ?? null,
          })),
        customerInfo,
      });
      toast({
        title: strings.sales.saleCompletedTitle,
        description: strings.sales.saleCompletedDesc
          .replace("{invoiceNumber}", result.invoiceNumber)
          .replace("{total}", Money.from(total).toString()),
      });
      const locale = getLanguage() === "ar" ? "ar-EG" : "en-US";
      setPrintData({
        invoiceNumber: result.invoiceNumber,
        date: new Date().toLocaleDateString(locale),
        time: new Date().toLocaleTimeString(locale),
        items: [...cart],
        total,
        paidAmount: totalPaid,
        remainingAmount: result.remainingDebt,
      });
      clearCart();
      setIsCheckoutOpen(false);
      setPaymentSplits([
        { id: `split_${Date.now()}`, method: "cash", amount: 0 },
      ]);
      setCustomerInfo({ name: "", phone: "", notes: "" });
    } catch (err) {
      toast({
        title: strings.common.genericError,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  const addSplit = () =>
    setPaymentSplits((prev) => [
      ...prev,
      { id: `split_${Date.now()}`, method: "cash", amount: 0 },
    ]);
  const updateSplit = (id: string, updates: Partial<PaymentSplit>) =>
    setPaymentSplits((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  const removeSplit = (id: string) => {
    if (paymentSplits.length > 1)
      setPaymentSplits((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-6">
      <QuantityDialog
        qtyDialog={qtyDialog}
        onClose={() => setQtyDialog({ open: false, product: null })}
        onConfirm={confirmQuantity}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BarcodeScannerCard
            barcode={barcode}
            onBarcodeChange={setBarcode}
            onSubmit={handleBarcodeSubmit}
          />
          <ProductGrid
            products={products}
            loading={loadingProducts}
            onSelectProduct={handleAddToCart}
          />
        </div>
        <CartPanel
          cart={cart}
          total={total}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onPrintPreview={() => {
            if (cart.length === 0) return;
            const locale = getLanguage() === "ar" ? "ar-EG" : "en-US";
            setPrintData({
              invoiceNumber: `PREVIEW-${Date.now()}`,
              date: new Date().toLocaleDateString(locale),
              time: new Date().toLocaleTimeString(locale),
              items: [...cart],
              total,
              paidAmount: totalPaid,
              remainingAmount: Math.max(0, total - totalPaid),
            });
          }}
          onCheckout={handleCheckout}
        />
      </div>
      <CheckoutDialog
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        customerInfo={customerInfo}
        onCustomerInfoChange={(field, value) =>
          setCustomerInfo((p) => ({ ...p, [field]: value }))
        }
        total={total}
        totalPaid={totalPaid}
        changeDue={changeDue}
        remainingDebt={remainingDebt}
        needsCustomerInfo={needsCustomerInfo}
        hasMissingReceipt={hasMissingReceipt}
        paymentSplits={paymentSplits}
        onAddSplit={addSplit}
        onUpdateSplit={updateSplit}
        onRemoveSplit={removeSplit}
        saleMode={saleMode}
        onSaleModeChange={setSaleMode}
        onlineOrderInfo={onlineOrderInfo}
        onOnlineOrderInfoChange={(field, value) =>
          setOnlineOrderInfo((p) => ({ ...p, [field]: value }))
        }
        isProcessing={isProcessing}
        onConfirm={() => {
          if (saleMode === "onsite" && changeDue > 0) {
            setIsChangeConfirmOpen(true);
          } else {
            completeCheckout();
          }
        }}
        onSaveAsPreparing={
          saleMode === "online" ? () => completeCheckout(true) : undefined
        }
        onCancel={() => setIsCheckoutOpen(false)}
      />
      <ChangeConfirmDialog
        open={isChangeConfirmOpen}
        onOpenChange={setIsChangeConfirmOpen}
        changeDue={changeDue}
        isProcessing={isProcessing}
        onConfirm={() => {
          setIsChangeConfirmOpen(false);
          completeCheckout();
        }}
      />
      {printData && (
        <InvoicePrint
          open={!!printData}
          onClose={() => setPrintData(null)}
          invoiceNumber={printData.invoiceNumber}
          date={printData.date}
          time={printData.time}
          cashier={cashier}
          items={printData.items}
          total={printData.total}
          paidAmount={printData.paidAmount}
          remainingAmount={printData.remainingAmount}
          customerName={customerInfo.name || undefined}
          customerPhone={customerInfo.phone || undefined}
          notes={customerInfo.notes || undefined}
        />
      )}
    </div>
  );
};
export default SalesInterface;
