import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Trash2, Loader2 } from "lucide-react";
import { Money } from "@/lib/domain";
import { ProductGrid } from "@/components/products/ProductGrid";
import { useProductsForSales } from "@/lib/hooks";
import { useToast } from "@/hooks/use-toast";
import { strings } from "@/lib/i18n/ar";
import type { Product } from "@/lib/types";
import type { OnlineOrderItemInput } from "@/features/online-orders/types";

interface OnlineOrderItemPickerProps {
  items: OnlineOrderItemInput[];
  onAddProduct: (product: Product) => void;
  onAddCustomItem: (item: OnlineOrderItemInput) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onUpdateMeasure: (index: number, amount: number) => void;
  onRemoveItem: (index: number) => void;
}

export function OnlineOrderItemPicker({
  items,
  onAddProduct,
  onAddCustomItem,
  onUpdateQuantity,
  onUpdateMeasure,
  onRemoveItem,
}: OnlineOrderItemPickerProps) {
  const { data: products = [], isLoading } = useProductsForSales();
  const { toast } = useToast();
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState("1");

  const [weightProduct, setWeightProduct] = useState<Product | null>(null);
  const [weightAmount, setWeightAmount] = useState("");

  const handleAddProduct = (product: Product) => {
    if (product.unit !== "piece") {
      setWeightProduct(product);
      setWeightAmount("");
      return;
    }
    const existing = items.find((i) => i.productId === product.id);
    const currentQty = existing?.quantity ?? 0;
    if (currentQty + 1 > product.stock) {
      toast({
        title: strings.onlineOrdersExtra.insufficientStock,
        description: strings.onlineOrdersExtra.stockAvailable
          .replace("{name}", product.name)
          .replace("{stock}", String(product.stock)),
        variant: "destructive",
      });
      return;
    }
    onAddProduct(product);
  };

  const confirmAddWeightedProduct = () => {
    if (!weightProduct) return;
    const amount = parseFloat(weightAmount);
    if (!amount || amount <= 0) return;
    if (amount > weightProduct.stock) {
      toast({
        title: strings.onlineOrdersExtra.insufficientStock,
        description: strings.onlineOrdersExtra.stockAvailable
          .replace("{name}", weightProduct.name)
          .replace("{stock}", String(weightProduct.stock)),
        variant: "destructive",
      });
      return;
    }
    const unitPrice = weightProduct.pricePerKg ?? weightProduct.price;
    onAddCustomItem({
      productId: weightProduct.id,
      name: weightProduct.name,
      price: unitPrice,
      quantity: 1,
      lineTotal: unitPrice * amount,
      isWeighted: true,
      measureAmount: amount,
      measureUnit:
        weightProduct.unit === "weight"
          ? strings.common.kg
          : strings.common.meter,
      pricePerKg: weightProduct.pricePerKg ?? null,
    });
    setWeightProduct(null);
    setWeightAmount("");
  };

  const handleUpdateMeasure = (index: number, amount: number) => {
    onUpdateMeasure(index, amount);
  };

  const handleIncrement = (index: number) => {
    const item = items[index];
    const product = products.find((p) => p.id === item.productId);
    if (product && item.quantity + 1 > product.stock) {
      toast({
        title: strings.onlineOrdersExtra.insufficientStock,
        description: strings.onlineOrdersExtra.stockAvailable
          .replace("{name}", product.name)
          .replace("{stock}", String(product.stock)),
        variant: "destructive",
      });
      return;
    }
    onUpdateQuantity(index, item.quantity + 1);
  };

  const handleAddCustom = () => {
    const price = parseFloat(customPrice);
    const qty = parseFloat(customQty) || 1;
    if (!customName.trim() || !price || price <= 0) return;
    onAddCustomItem({
      productId: null,
      name: customName.trim(),
      price,
      quantity: qty,
      lineTotal: price * qty,
    });
    setCustomName("");
    setCustomPrice("");
    setCustomQty("1");
  };

  const itemsTotal = items.reduce(
    (s, i) => s + (i.lineTotal ?? i.price * i.quantity),
    0,
  );

  return (
    <div className="space-y-4">
      <ProductGrid
        products={products}
        loading={isLoading}
        onSelectProduct={handleAddProduct}
      />

      {weightProduct && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">
            {weightProduct.name} —{" "}
            {weightProduct.unit === "weight"
              ? strings.onlineOrdersExtra.enterWeightKg
              : strings.onlineOrdersExtra.enterLengthMeter}
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              autoFocus
              value={weightAmount}
              onChange={(e) => setWeightAmount(e.target.value)}
              placeholder={
                weightProduct.unit === "weight"
                  ? strings.onlineOrdersExtra.weightPlaceholder
                  : strings.onlineOrdersExtra.meterPlaceholder
              }
              className="text-center font-bold"
            />
            <Button
              onClick={confirmAddWeightedProduct}
              disabled={!weightAmount}
            >
              {strings.common.add}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setWeightProduct(null);
                setWeightAmount("");
              }}
            >
              {strings.sales.cancel}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        {" "}
        <p className="text-sm font-semibold text-foreground">
          {strings.onlineOrdersExtra.addOffCatalogProduct}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={strings.onlineOrdersExtra.productNamePlaceholder}
            className="col-span-1"
          />
          <Input
            type="number"
            step="0.01"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            placeholder={strings.onlineOrdersExtra.pricePlaceholder}
          />
          <Input
            type="number"
            step="1"
            value={customQty}
            onChange={(e) => setCustomQty(e.target.value)}
            placeholder={strings.onlineOrdersExtra.quantityPlaceholder}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddCustom}
          className="w-full"
        >
          <Plus className="w-3.5 h-3.5 me-1.5" />
          {strings.onlineOrders.addItem}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
        <Label className="text-sm font-semibold">
          {strings.onlineOrders.items} ({items.length})
        </Label>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {strings.onlineOrdersExtra.noItemsAdded}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) =>
              item.isWeighted ? (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Money.from(item.price).toString()} / {item.measureUnit}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.measureAmount ?? ""}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) onUpdateMeasure(idx, v);
                      }}
                      className="w-20 h-8 text-center text-sm"
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.measureUnit}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveItem(idx)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Money.from(item.price).toString()} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() =>
                        onUpdateQuantity(idx, Math.max(1, item.quantity - 1))
                      }
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="text-sm w-6 text-center">
                      {item.quantity}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => handleIncrement(idx)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveItem(idx)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ),
            )}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-sm font-medium text-muted-foreground">
                {strings.onlineOrders.productsTotal}
              </span>
              <span className="text-sm font-bold text-primary">
                {Money.from(itemsTotal).toString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
