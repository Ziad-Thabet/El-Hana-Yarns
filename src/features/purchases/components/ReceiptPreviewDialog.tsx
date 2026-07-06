import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { strings } from "@/lib/i18n/ar";

interface ReceiptPreviewDialogProps {
  image: string | null;
  onClose: () => void;
}

export const ReceiptPreviewDialog = ({
  image,
  onClose,
}: ReceiptPreviewDialogProps) => {
  return (
    <Dialog open={!!image} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {strings.salesInvoices.receiptImageDialogTitle}
          </DialogTitle>
        </DialogHeader>
        {image && (
          <img
            src={image}
            alt={strings.sales.receiptAlt}
            className="w-full max-h-[70vh] object-contain rounded-lg border border-border"
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
