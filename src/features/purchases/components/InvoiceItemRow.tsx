import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { strings } from "@/lib/i18n/ar";
import type { InvoiceItem, Category } from "@/lib/types";

interface InvoiceItemRowProps {
  item: InvoiceItem;
  categories: Category[];
  canRemove: boolean;
  onUpdate: (field: keyof InvoiceItem, value: string | number) => void;
  onRemove: () => void;
}

export const InvoiceItemRow = ({
  item,
  categories,
  canRemove,
  onUpdate,
  onRemove,
}: InvoiceItemRowProps) => {
  return (
    <Card className="p-4 bg-secondary border border-border">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <Label className="text-muted-foreground text-xs">
            {strings.purchases.barcodeRequired}
          </Label>
          <Input
            value={item.barcode}
            onChange={(e) => onUpdate("barcode", e.target.value)}
            placeholder={strings.purchases.barcodePlaceholder}
            className="bg-muted text-foreground border-border font-mono"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">
            {strings.purchases.productNameLabel}
          </Label>
          <Input
            value={item.productName}
            onChange={(e) => onUpdate("productName", e.target.value)}
            placeholder={strings.purchases.productNamePlaceholder}
            className="bg-muted text-foreground border-border"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">
            {strings.common.category}
          </Label>
          <Select
            value={item.category}
            onValueChange={(v) => onUpdate("category", v)}
          >
            <SelectTrigger className="bg-muted border-border">
              <SelectValue placeholder={strings.purchases.selectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">
            {strings.purchases.quantityRequired}
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={item.quantity}
            onChange={(e) =>
              onUpdate("quantity", parseFloat(e.target.value) || 0)
            }
            className="bg-muted text-foreground border-border"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">
            {strings.purchases.unitLabel}
          </Label>
          <Select value={item.unit} onValueChange={(v) => onUpdate("unit", v)}>
            <SelectTrigger className="bg-muted border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="piece">
                {strings.purchases.unitPiece}
              </SelectItem>
              <SelectItem value="weight">
                {strings.purchases.unitWeight}
              </SelectItem>
              <SelectItem value="meter">
                {strings.purchases.unitMeter}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs">
            {strings.purchases.itemTotalPriceRequired}
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={item.itemTotal}
            onChange={(e) =>
              onUpdate("itemTotal", parseFloat(e.target.value) || 0)
            }
            placeholder={strings.purchases.itemTotalExamplePlaceholder}
            className="bg-muted text-foreground border-border"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onRemove}
            disabled={!canRemove}
          >
            {strings.common.delete}
          </Button>
        </div>
      </div>
    </Card>
  );
};
