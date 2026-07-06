import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/products/ProductCard";
import { strings } from "@/lib/i18n/ar";
const CARD_HEIGHT = 300;

export function ProductGrid({
  products,
  loading,
  onSelectProduct,
}: {
  products: Product[];
  loading: boolean;
  onSelectProduct: (product: Product) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.category?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [products, searchTerm],
  );

  useEffect(() => {
    if (!parentRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setCols(width < 768 ? 2 : 3);
    });
    obs.observe(parentRef.current);
    return () => obs.disconnect();
  }, []);

  const rowCount = Math.ceil(filteredProducts.length / cols);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 3,
    measureElement: (el) => el?.getBoundingClientRect().height ?? CARD_HEIGHT,
  });

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Search className="w-5 h-5" />
            <span className="text-lg font-semibold">
              {strings.sales.productsTitle}
            </span>
          </div>
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={strings.products.searchPlaceholder}
            className="w-full max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ms-2 text-muted-foreground">
              {strings.common.loading}
            </span>
          </div>
        ) : (
          <div
            ref={parentRef}
            className="overflow-y-auto"
            style={{
              height: "600px",
              scrollbarWidth: "thin",
              scrollbarColor: "hsl(var(--border)) transparent",
            }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const startIdx = virtualRow.index * cols;
                const rowProducts = filteredProducts.slice(
                  startIdx,
                  startIdx + cols,
                );
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                      gap: "1rem",
                      paddingBottom: "1.25rem",
                    }}
                  >
                    {rowProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onClick={() => onSelectProduct(product)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
