import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, Receipt } from "lucide-react";
import { Money } from "@/lib/domain";
import { PremiumButton } from "@/components/ui/premium";
import type { CartItem } from "@/lib/types";
import { CartItemRow } from "./CartItemRow";
import { strings } from "@/lib/i18n/ar";

interface CartPanelProps {
  cart: CartItem[];
  total: number;
  onUpdateQuantity: (id: string, quantity: number) => boolean;
  onRemoveItem: (id: string) => void;
  onPrintPreview: () => void;
  onCheckout: () => void;
}

export const CartPanel = ({
  cart,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onPrintPreview,
  onCheckout,
}: CartPanelProps) => {
  return (
    <div className="space-y-4">
      <Card className="bg-card/80 backdrop-blur-sm border-border sticky top-24 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Receipt className="w-5 h-5" />
            {strings.sales.cartTitle}
            {cart.length > 0 && (
              <Badge className="ms-auto rounded-full px-2 py-1 text-xs">
                {cart.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {strings.sales.emptyCart}
            </p>
          ) : (
            <>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cart.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onUpdateQuantity={onUpdateQuantity}
                    onRemoveItem={onRemoveItem}
                  />
                ))}
              </div>
              <Separator className="my-2" />
              <div className="space-y-4">
                <div className="rounded-[var(--radius-lg)] border border-border bg-secondary p-4 flex items-center justify-between text-lg font-semibold">
                  <span>{strings.sales.total}:</span>
                  <span className="text-primary">
                    {Money.from(total).toString()}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    disabled={cart.length === 0}
                    onClick={onPrintPreview}
                  >
                    <Printer className="w-4 h-4 me-2" />
                    {strings.sales.printPreview}
                  </Button>
                  <PremiumButton onClick={onCheckout}>
                    {strings.sales.checkoutButton}
                  </PremiumButton>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
