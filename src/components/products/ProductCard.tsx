import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductModel } from "@/lib/domain";
import { images } from "@/lib/theme/styles";
import type { Product } from "@/lib/types";
import { strings } from "@/lib/i18n/ar";

export function ProductCard({
  product,
  onClick,
}: {
  product: Product;
  onClick: () => void;
}) {
  return (
    <Card
      className="group cursor-pointer overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card/90 transition-all duration-200 hover:shadow-[var(--shadow-elevated)] hover:border-primary/40"
      onClick={onClick}
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className={images.product}
        />
      ) : (
        <div className="h-32 w-full rounded-t-[var(--radius-lg)] bg-muted flex flex-col items-center justify-center gap-1">
          <div className="text-3xl">🧶</div>
          <span className="text-xs text-muted-foreground">
            {strings.products.noImage}
          </span>{" "}
        </div>
      )}
      <CardContent className="p-4 text-center space-y-3">
        <h3 className="text-base font-semibold text-foreground">
          {product.name}
        </h3>
        <p className="text-lg font-bold text-primary">
          {new ProductModel(product).priceLabel}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="secondary" className="text-[11px] px-2 py-1">
            {strings.products.availableLabel}{" "}
            {new ProductModel(product).stockLabel}
          </Badge>
          {product.unit !== "piece" && (
            <Badge variant="outline" className="text-[11px] px-2 py-1">
              {product.unit === "weight"
                ? strings.products.unitWeightBadge
                : strings.products.unitMeterBadge}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
