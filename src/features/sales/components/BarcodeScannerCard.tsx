import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Barcode } from "lucide-react";
import { PremiumButton } from "@/components/ui/premium";
import { strings } from "@/lib/i18n/ar";

export function BarcodeScannerCard({
  barcode,
  onBarcodeChange,
  onSubmit,
}: {
  barcode: string;
  onBarcodeChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Barcode className="w-5 h-5" />
          {strings.sales.barcodeTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            value={barcode}
            onChange={(e) => onBarcodeChange(e.target.value)}
            placeholder={strings.sales.barcodePlaceholder}
            className="flex-1 text-center font-mono text-lg"
            autoFocus
          />
          <PremiumButton type="submit">{strings.sales.add}</PremiumButton>
        </form>
      </CardContent>
    </Card>
  );
}
