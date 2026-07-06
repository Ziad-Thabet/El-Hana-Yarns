import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Money } from "@/lib/domain";
import { computePaymentBreakdown } from "../../../../shared/onlineOrdersPayment.mjs";
import {
  ORDER_PAYMENT_METHODS,
  ORDER_PAYMENT_METHOD_LABELS,
  type OrderPaymentMethodValue,
} from "@/lib/constants/onlineOrdersStatus";
import { strings } from "@/lib/i18n/ar";
import { needsOnlinePaymentChannel } from "@/features/online-orders/onlineOrderPaymentHelpers";

interface OnlineOrderPaymentSectionProps {
  paymentMethod: OrderPaymentMethodValue;
  deliveryFee: string;
  prepaidAmount: string;
  productsTotal: number;
  onPaymentMethodChange: (value: OrderPaymentMethodValue) => void;
  onDeliveryFeeChange: (value: string) => void;
  onPrepaidAmountChange: (value: string) => void;
  hideDeliveryFee?: boolean;
  onlinePaymentChannel: "vodafone" | "instapay" | null;
  onOnlinePaymentChannelChange: (value: "vodafone" | "instapay") => void;
}

export function OnlineOrderPaymentSection({
  paymentMethod,
  deliveryFee,
  prepaidAmount,
  productsTotal,
  onPaymentMethodChange,
  onDeliveryFeeChange,
  onPrepaidAmountChange,
  hideDeliveryFee = false,
  onlinePaymentChannel,
  onOnlinePaymentChannelChange,
}: OnlineOrderPaymentSectionProps) {
  const needsChannel = needsOnlinePaymentChannel(
    paymentMethod,
    parseFloat(prepaidAmount) || 0,
  );
  const feeNum = parseFloat(deliveryFee) || 0;
  const prepaidNum = parseFloat(prepaidAmount) || 0;
  const breakdown = computePaymentBreakdown(
    paymentMethod,
    productsTotal,
    feeNum,
    prepaidNum,
  );

  return (
    <div className="space-y-4">
      <div>
        <Label>{strings.onlineOrders.paymentMethod} *</Label>
        <Select
          value={paymentMethod}
          onValueChange={(v) =>
            onPaymentMethodChange(v as OrderPaymentMethodValue)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {ORDER_PAYMENT_METHOD_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hideDeliveryFee && (
        <div>
          <Label>{strings.onlineOrders.deliveryFee}</Label>
          <Input
            type="number"
            step="0.01"
            value={deliveryFee}
            onChange={(e) => onDeliveryFeeChange(e.target.value)}
            placeholder="0.00"
          />
        </div>
      )}

      {paymentMethod === "partial" && (
        <div>
          <Label>{strings.onlineOrders.prepaidAmount}</Label>
          <Input
            type="number"
            step="0.01"
            max={productsTotal}
            value={prepaidAmount}
            onChange={(e) => onPrepaidAmountChange(e.target.value)}
            placeholder="0.00"
          />
        </div>
      )}

      {needsChannel && (
        <div>
          <Label>
            {strings.onlineOrdersExtra.onlinePaymentMethodPlaceholder} *
          </Label>
          <Select
            value={onlinePaymentChannel ?? undefined}
            onValueChange={(v) =>
              onOnlinePaymentChannelChange(v as "vodafone" | "instapay")
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={strings.onlineOrdersExtra.selectMethod}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vodafone">
                {strings.onlineOrdersExtra.channelVodafone}
              </SelectItem>
              <SelectItem value="instapay">
                {strings.onlineOrdersExtra.channelInstapay}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {strings.onlineOrders.productsTotal}
          </span>
          <span className="font-medium">
            {Money.from(productsTotal).toString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {strings.onlineOrders.deliveryFee}
          </span>
          <span className="font-medium">{Money.from(feeNum).toString()}</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-border">
          <span className="font-semibold text-foreground">
            {strings.onlineOrders.grandTotal}
          </span>
          <span className="font-bold text-primary">
            {Money.from(breakdown.grandTotal).toString()}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            {strings.onlineOrdersExtra.collectFromCustomer}
          </span>
          <span className="font-medium text-emerald-600">
            {Money.from(breakdown.collectFromCustomer).toString()}
          </span>
        </div>
        {breakdown.driverOwesShop > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {strings.onlineOrdersExtra.driverCustody}
            </span>
            <span className="font-medium text-amber-600">
              {Money.from(breakdown.driverOwesShop).toString()}
            </span>
          </div>
        )}
        {breakdown.shopOwesDriver > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {strings.onlineOrdersExtra.driverFee}
            </span>
            <span className="font-medium text-amber-600">
              {Money.from(breakdown.shopOwesDriver).toString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
