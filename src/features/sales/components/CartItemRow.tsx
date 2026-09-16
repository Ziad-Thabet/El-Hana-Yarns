import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CartItemModel } from "@/lib/domain";
import type { CartItem } from "@/lib/types";
import { strings } from "@/lib/i18n/ar";

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => boolean;
  onRemoveItem: (id: string) => void;
}

export const CartItemRow = ({
  item,
  onUpdateQuantity,
  onRemoveItem,
}: CartItemRowProps) => {
  const { toast } = useToast();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 min-w-0 space-y-1">
        <h4 className="font-semibold text-foreground truncate">{item.name}</h4>
        <p className="text-sm text-muted-foreground">
          {CartItemModel.from(item).measureLabel}
        </p>
        <p className="text-base font-bold text-foreground tabular-nums">
          {CartItemModel.from(item).totalLabel}
        </p>
      </div>
      <div className="flex items-center gap-2 justify-end">
        {!item.isWeighted && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-11 w-11 p-0 shrink-0"
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            >
              <Minus className="w-5 h-5" />
            </Button>
            <span className="w-10 text-center font-bold text-lg tabular-nums">
              {item.quantity}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-11 w-11 p-0 shrink-0"
              onClick={() => {
                const ok = onUpdateQuantity(item.id, item.quantity + 1);
                if (!ok) {
                  toast({
                    title: strings.onlineOrdersExtra.insufficientStock,
                    description: strings.sales.maxStockReached,
                    variant: "destructive",
                  });
                }
              }}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="destructive"
          className="h-11 w-11 p-0 shrink-0"
          onClick={() => onRemoveItem(item.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
