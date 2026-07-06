import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { strings } from "@/lib/i18n/ar";
import type { PaymentMethod } from "@/lib/types";

interface PaymentMethodSelectProps {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  triggerClassName?: string;
}

export const PaymentMethodSelect = ({
  value,
  onChange,
  triggerClassName = "bg-secondary border-border",
}: PaymentMethodSelectProps) => {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PaymentMethod)}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="cash">
          {strings.purchases.paymentMethodCash}
        </SelectItem>
        <SelectItem value="vodafone">
          {strings.purchases.paymentMethodVodafone}
        </SelectItem>
        <SelectItem value="instapay">
          {strings.purchases.paymentMethodInstapay}
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
