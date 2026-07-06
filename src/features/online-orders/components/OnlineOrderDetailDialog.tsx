import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Package,
  MessageCircle,
  Loader2,
  Pencil,
  Save,
  X,
  Upload,
  FileCheck,
} from "lucide-react";

import { Money } from "@/lib/domain";
import { PremiumButton } from "@/components/ui/premium";
import { useToast } from "@/hooks/use-toast";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { buildDriverMessage } from "../onlineOrdersHelpers";
import {
  useDispatchOnlineOrder,
  useCancelOnlineOrder,
  useMarkOnlineOrderNotReceived,
  useUpdateOnlineOrder,
  useUpdateOnlineOrderStatus,
  useUploadBillOfLading,
} from "@/features/online-orders/hooks";
import { OnlineOrderItemPicker } from "./OnlineOrderItemPicker";
import { useActiveDrivers, useDrivers } from "@/features/drivers/hooks";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_SOURCE_LABELS,
  ORDER_PAYMENT_METHOD_LABELS,
  ORDER_PAYMENT_STATUS_LABELS,
} from "@/lib/constants/onlineOrdersStatus";
import { strings } from "@/lib/i18n/ar";
import type {
  OnlineOrder,
  OnlineOrderItemInput,
} from "@/features/online-orders/types";
import type { Product } from "@/lib/types";
import { PRE_DISPATCH_STATUSES } from "../../../../shared/onlineOrdersEnums.mjs";
import { needsOnlinePaymentChannel } from "@/features/online-orders/onlineOrderPaymentHelpers";
type ConfirmAction = "cancel" | "dispatch" | "notReceived" | null;

export function OnlineOrderDetailDialog({
  order,
  open,
  onClose,
}: {
  order: OnlineOrder | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const dispatchOrder = useDispatchOnlineOrder();
  const cancelOrder = useCancelOnlineOrder();
  const markNotReceived = useMarkOnlineOrderNotReceived();
  const updateOrder = useUpdateOnlineOrder();
  const updateOrderStatus = useUpdateOnlineOrderStatus();
  const uploadBillOfLading = useUploadBillOfLading();
  const { data: activeDrivers = [] } = useActiveDrivers();
  const { data: allDrivers = [] } = useDrivers();

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [selectedDriverId, setSelectedDriverId] = useState(
    order?.preSelectedDriverId ?? "",
  );
  const [dispatchOnlineChannel, setDispatchOnlineChannel] = useState<
    "vodafone" | "instapay" | ""
  >(order?.onlinePaymentChannel ?? "");
  const [uploadingLading, setUploadingLading] = useState(false);
  const [ladingPreviewOpen, setLadingPreviewOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editItems, setEditItems] = useState<OnlineOrderItemInput[]>([]);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editPaymentMethod, setEditPaymentMethod] = useState(
    order?.paymentMethod ?? "cod",
  );
  const [editDeliveryFee, setEditDeliveryFee] = useState(
    order?.deliveryFee ?? 0,
  );
  const [editPrepaidAmount, setEditPrepaidAmount] = useState(
    order?.prepaidAmount ?? 0,
  );

  if (!order) return null;

  const isPreDispatch = PRE_DISPATCH_STATUSES.includes(order.status);
  const assignedDriver = allDrivers.find((d) => d.id === order.driverId);

  const resetConfirm = () => {
    setConfirmAction(null);
    setSelectedDriverId("");
  };

  const handleCancel = async () => {
    try {
      setProcessing(true);
      await cancelOrder.mutateAsync(order.id);
      toast({ title: strings.onlineOrders.orderCancelled });
      resetConfirm();
      onClose();
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleAdvanceStatus = async (nextStatus: "preparing" | "ready") => {
    try {
      setProcessing(true);
      await updateOrderStatus.mutateAsync({ id: order.id, status: nextStatus });
      toast({
        title:
          nextStatus === "preparing"
            ? strings.onlineOrders.orderStartedPreparing
            : strings.onlineOrders.orderMarkedReady,
      });
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const needsOnlineChannel = needsOnlinePaymentChannel(
    order.paymentMethod,
    order.prepaidAmount,
  );
  const handleDispatch = async () => {
    if (!selectedDriverId) {
      toast({
        title: strings.onlineOrdersExtra.selectDriverFirst,
        variant: "destructive",
      });
      return;
    }
    if (
      needsOnlineChannel &&
      !order.onlinePaymentChannel &&
      !dispatchOnlineChannel
    ) {
      toast({
        title: strings.onlineOrdersExtra.selectOnlinePaymentMethod,
        variant: "destructive",
      });
      return;
    }
    try {
      setProcessing(true);
      if (
        needsOnlineChannel &&
        !order.onlinePaymentChannel &&
        dispatchOnlineChannel
      ) {
        await updateOrder.mutateAsync({
          id: order.id,
          data: {
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            addressId: order.addressId,
            addressText: order.addressText,
            addressLabel: order.addressLabel,
            source: order.source,
            paymentMethod: order.paymentMethod,
            deliveryFee: order.deliveryFee,
            prepaidAmount: order.prepaidAmount,
            requestedDateTime: order.requestedDateTime,
            notes: order.notes,
            onlinePaymentChannel: dispatchOnlineChannel,
            items: order.items.map((i) => ({
              productId: i.productId,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              lineTotal: i.lineTotal,
              isWeighted: i.isWeighted,
              weightGrams: i.weightGrams,
              measureAmount: i.measureAmount,
              measureUnit: i.measureUnit,
              pricePerKg: i.pricePerKg,
            })),
          },
        });
      }
      await dispatchOrder.mutateAsync({
        orderId: order.id,
        driverId: selectedDriverId,
      });
      toast({ title: strings.onlineOrders.orderDispatched });
      resetConfirm();
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleNotReceived = async () => {
    try {
      setProcessing(true);
      await markNotReceived.mutateAsync(order.id);
      toast({ title: strings.onlineOrders.orderNotReceivedRecorded });
      resetConfirm();
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSendDriverMessage = () => {
    if (!assignedDriver) return;
    const message = buildDriverMessage(order, assignedDriver);
    const link = buildWhatsAppLink(assignedDriver.phone, message);
    window.open(link, "_blank");
  };

  const handleStartEditItems = () => {
    setEditItems(
      order.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        isWeighted: i.isWeighted,
        weightGrams: i.weightGrams,
        measureAmount: i.measureAmount,
        measureUnit: i.measureUnit,
        pricePerKg: i.pricePerKg,
      })),
    );
    setConfirmAction(null);
    setIsEditingItems(true);
  };

  const handleUpdateItemMeasure = (index: number, amount: number) => {
    setEditItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const unitPrice = it.pricePerKg ?? it.price;
        return { ...it, measureAmount: amount, lineTotal: unitPrice * amount };
      }),
    );
  };

  const handleCancelEditItems = () => {
    setIsEditingItems(false);
    setEditItems([]);
  };

  const handleAddProduct = (product: Product) => {
    setEditItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === product.id);
      if (idx >= 0) {
        const next = [...prev];
        const qty = next[idx].quantity + 1;
        next[idx] = {
          ...next[idx],
          quantity: qty,
          lineTotal: next[idx].price * qty,
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          lineTotal: product.price,
        },
      ];
    });
  };

  const handleAddCustomItem = (item: OnlineOrderItemInput) => {
    setEditItems((prev) => [...prev, item]);
  };

  const handleUpdateItemQuantity = (index: number, quantity: number) => {
    setEditItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, quantity, lineTotal: it.price * quantity } : it,
      ),
    );
  };

  const handleRemoveItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveItems = async () => {
    if (editItems.length === 0) {
      toast({
        title: strings.onlineOrdersExtra.addAtLeastOneProduct,
        variant: "destructive",
      });
      return;
    }
    try {
      setProcessing(true);
      await updateOrder.mutateAsync({
        id: order.id,
        data: {
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          addressId: order.addressId,
          addressText: order.addressText,
          addressLabel: order.addressLabel,
          source: order.source,
          paymentMethod: order.paymentMethod,
          deliveryFee: order.deliveryFee,
          prepaidAmount: order.prepaidAmount,
          requestedDateTime: order.requestedDateTime,
          notes: order.notes,
          items: editItems,
        },
      });
      toast({ title: strings.onlineOrdersExtra.itemsUpdated });
      setIsEditingItems(false);
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleStartEditPayment = () => {
    setEditPaymentMethod(order.paymentMethod);
    setEditDeliveryFee(order.deliveryFee);
    setEditPrepaidAmount(order.prepaidAmount);
    setConfirmAction(null);
    setIsEditingPayment(true);
  };

  const handleCancelEditPayment = () => {
    setIsEditingPayment(false);
  };

  const handleSavePayment = async () => {
    try {
      setProcessing(true);
      await updateOrder.mutateAsync({
        id: order.id,
        data: {
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          addressId: order.addressId,
          addressText: order.addressText,
          addressLabel: order.addressLabel,
          source: order.source,
          paymentMethod: editPaymentMethod,
          deliveryFee: editDeliveryFee,
          prepaidAmount: editPrepaidAmount,
          requestedDateTime: order.requestedDateTime,
          notes: order.notes,
          onlinePaymentChannel: order.onlinePaymentChannel,
          items: order.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
            isWeighted: i.isWeighted,
            weightGrams: i.weightGrams,
            measureAmount: i.measureAmount,
            measureUnit: i.measureUnit,
            pricePerKg: i.pricePerKg,
          })),
        },
      });
      toast({ title: strings.onlineOrders.paymentUpdated });
      setIsEditingPayment(false);
    } catch (err) {
      toast({
        title: strings.common.error,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          resetConfirm();
          handleCancelEditItems();
          setIsEditingPayment(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {strings.onlineOrdersExtra.orderLabel} {order.orderNumber}
            <Badge
              variant="outline"
              className={ORDER_STATUS_COLORS[order.status]}
            >
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-secondary rounded-xl">
            {[
              {
                label: strings.onlineOrders.customerName,
                value: order.customerName,
              },
              {
                label: strings.onlineOrders.customerPhone,
                value: order.customerPhone,
              },
              {
                label: strings.onlineOrders.source,
                value: ORDER_SOURCE_LABELS[order.source],
              },
              { label: strings.onlineOrders.address, value: order.addressText },
            ].map((item) => (
              <div key={item.label} className="space-y-0.5">
                <p className="text-[11px] text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">
                {strings.onlineOrders.items}
              </h3>
              {isPreDispatch &&
                !isEditingItems &&
                !isEditingPayment &&
                !confirmAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEditItems}
                  >
                    <Pencil className="w-3.5 h-3.5 me-1.5" />
                    {strings.onlineOrdersExtra.editProducts}
                  </Button>
                )}
            </div>

            {isEditingItems ? (
              <div className="space-y-3">
                <OnlineOrderItemPicker
                  items={editItems}
                  onAddProduct={handleAddProduct}
                  onAddCustomItem={handleAddCustomItem}
                  onUpdateQuantity={handleUpdateItemQuantity}
                  onUpdateMeasure={handleUpdateItemMeasure}
                  onRemoveItem={handleRemoveItem}
                />
                <div className="flex gap-2">
                  <PremiumButton
                    className="flex-1"
                    onClick={handleSaveItems}
                    disabled={processing}
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                    ) : (
                      <Save className="w-4 h-4 me-2" />
                    )}
                    {strings.onlineOrdersExtra.saveChanges}
                  </PremiumButton>
                  <Button
                    variant="outline"
                    onClick={handleCancelEditItems}
                    disabled={processing}
                  >
                    <X className="w-4 h-4 me-2" />
                    {strings.common.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">
                      {strings.common.product}
                    </TableHead>
                    <TableHead className="text-start">
                      {strings.common.quantity}
                    </TableHead>
                    <TableHead className="text-start">
                      {strings.common.price}
                    </TableHead>
                    <TableHead className="text-start">
                      {strings.common.total}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-sm">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.isWeighted
                          ? `${item.measureAmount ?? item.weightGrams ?? 0} ${item.measureUnit ?? ""}`
                          : item.quantity}
                      </TableCell>
                      <TableCell className="text-sm">
                        {Money.from(item.price).toString()}
                      </TableCell>
                      <TableCell className="font-semibold text-sm">
                        {Money.from(item.lineTotal).toString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-foreground">
                {strings.onlineOrders.paymentMethod}
              </h3>
              {isPreDispatch &&
                !isEditingPayment &&
                !isEditingItems &&
                !confirmAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEditPayment}
                  >
                    <Pencil className="w-3.5 h-3.5 me-1.5" />
                    {strings.onlineOrders.editPaymentMethod}
                  </Button>
                )}
            </div>

            {isEditingPayment ? (
              <div className="space-y-3 p-3 bg-secondary rounded-lg">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {strings.onlineOrders.paymentMethod}
                  </label>
                  <Select
                    value={editPaymentMethod}
                    onValueChange={(v) =>
                      setEditPaymentMethod(v as OnlineOrder["paymentMethod"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(ORDER_PAYMENT_METHOD_LABELS) as [
                          OnlineOrder["paymentMethod"],
                          string,
                        ][]
                      ).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {strings.onlineOrders.deliveryFee}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={editDeliveryFee}
                    onChange={(e) => setEditDeliveryFee(Number(e.target.value))}
                    dir="ltr"
                  />
                </div>
                {editPaymentMethod === "partial" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {strings.onlineOrders.prepaidAmount}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={editPrepaidAmount}
                      onChange={(e) =>
                        setEditPrepaidAmount(Number(e.target.value))
                      }
                      dir="ltr"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <PremiumButton
                    className="flex-1"
                    onClick={handleSavePayment}
                    disabled={processing}
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                    ) : (
                      <Save className="w-4 h-4 me-2" />
                    )}
                    {strings.common.save}
                  </PremiumButton>
                  <Button
                    variant="outline"
                    onClick={handleCancelEditPayment}
                    disabled={processing}
                  >
                    <X className="w-4 h-4 me-2" />
                    {strings.common.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    {strings.onlineOrders.paymentMethod}
                  </span>
                  <Badge variant="secondary">
                    {ORDER_PAYMENT_METHOD_LABELS[order.paymentMethod]}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    {strings.onlineOrders.paymentStatus}
                  </span>
                  <Badge variant="secondary">
                    {ORDER_PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold">
                    {strings.onlineOrders.grandTotal}
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {Money.from(order.grandTotal).toString()}
                  </span>
                </div>
                {order.remainingAmount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      {strings.onlineOrders.remainingAmount}
                    </span>
                    <span className="font-semibold text-rose-500">
                      {Money.from(order.remainingAmount).toString()}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {assignedDriver && (
            <div className="flex items-center justify-between p-3 bg-secondary border border-border rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">
                  {strings.onlineOrders.driver}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {assignedDriver.name} — {assignedDriver.phone}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendDriverMessage}
              >
                <MessageCircle className="w-3.5 h-3.5 me-1.5" />
                {strings.onlineOrders.sendDriverMessage}
              </Button>
            </div>
          )}

          {order.status === "dispatched" &&
            assignedDriver &&
            (assignedDriver.driverType === "company_next_day" ||
              assignedDriver.driverType === "company_direct") && (
              <div className="p-4 border border-border rounded-lg bg-secondary/40 space-y-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-primary" />
                  {strings.onlineOrdersExtra.shippingLabel}
                </p>
                {order.billOfLadingImage ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={order.billOfLadingImage}
                      alt={strings.onlineOrdersExtra.shippingLabelAlt}
                      className="w-16 h-16 object-cover rounded-lg border border-border cursor-pointer"
                      onClick={() => setLadingPreviewOpen(true)}
                    />
                    <div className="space-y-1">
                      <p className="text-xs text-emerald-600 font-medium">
                        {strings.onlineOrdersExtra.labelUploaded}
                      </p>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline cursor-pointer"
                        onClick={() => setLadingPreviewOpen(true)}
                      >
                        {strings.common.zoomImage}
                      </button>
                      <label className="text-xs text-muted-foreground underline cursor-pointer block">
                        {strings.common.changeImage}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async () => {
                              try {
                                setUploadingLading(true);
                                await uploadBillOfLading.mutateAsync({
                                  orderId: order.id,
                                  image: reader.result as string,
                                });
                                toast({
                                  title: strings.onlineOrdersExtra.labelUpdated,
                                });
                              } catch (err) {
                                toast({
                                  title: strings.common.error,
                                  description: (err as Error).message,
                                  variant: "destructive",
                                });
                              } finally {
                                setUploadingLading(false);
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label
                    className={`flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors w-fit ${uploadingLading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {uploadingLading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <Upload className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {strings.onlineOrdersExtra.uploadShippingLabel}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async () => {
                          try {
                            setUploadingLading(true);
                            await uploadBillOfLading.mutateAsync({
                              orderId: order.id,
                              image: reader.result as string,
                            });
                            toast({
                              title:
                                strings.onlineOrdersExtra.labelUploadedSuccess,
                            });
                          } catch (err) {
                            toast({
                              title: strings.common.error,
                              description: (err as Error).message,
                              variant: "destructive",
                            });
                          } finally {
                            setUploadingLading(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                )}
              </div>
            )}

          {confirmAction === "cancel" && (
            <div className="space-y-3 p-4 border border-destructive/40 rounded-lg bg-destructive/5">
              <p className="text-sm font-semibold text-foreground">
                {strings.onlineOrders.confirmCancelTitle}
              </p>
              <p className="text-sm text-muted-foreground">
                {strings.onlineOrders.confirmCancelDesc}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={processing}
                >
                  {processing && (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  )}
                  {strings.onlineOrders.cancelOrder}
                </Button>
                <Button variant="outline" onClick={resetConfirm}>
                  {strings.common.cancel}
                </Button>
              </div>
            </div>
          )}

          {confirmAction === "dispatch" && (
            <div className="space-y-3 p-4 border border-primary/40 rounded-lg bg-primary/5">
              <p className="text-sm font-semibold text-foreground">
                {strings.onlineOrders.confirmDispatchTitle}
              </p>
              <p className="text-sm text-muted-foreground">
                {strings.onlineOrders.confirmDispatchDesc}
              </p>
              <Select
                value={selectedDriverId || undefined}
                onValueChange={setSelectedDriverId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={strings.onlineOrders.selectDriver}
                  />
                </SelectTrigger>
                <SelectContent>
                  {activeDrivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} — {d.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {needsOnlineChannel && !order.onlinePaymentChannel && (
                <Select
                  value={dispatchOnlineChannel || undefined}
                  onValueChange={(v) =>
                    setDispatchOnlineChannel(v as "vodafone" | "instapay")
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        strings.onlineOrdersExtra.onlinePaymentMethodPlaceholder
                      }
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
              )}
              <div className="flex gap-2">
                <PremiumButton
                  className="flex-1"
                  onClick={handleDispatch}
                  disabled={processing}
                >
                  {processing && (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  )}
                  {strings.onlineOrders.dispatchOrder}
                </PremiumButton>
                <Button variant="outline" onClick={resetConfirm}>
                  {strings.common.cancel}
                </Button>
              </div>
            </div>
          )}

          {confirmAction === "notReceived" && (
            <div className="space-y-3 p-4 border border-amber-500/40 rounded-lg bg-amber-500/5">
              <p className="text-sm font-semibold text-foreground">
                {strings.onlineOrders.confirmNotReceivedTitle}
              </p>
              <p className="text-sm text-muted-foreground">
                {strings.onlineOrders.confirmNotReceivedDesc}
              </p>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleNotReceived}
                  disabled={processing}
                >
                  {processing && (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  )}
                  {strings.onlineOrders.markNotReceived}
                </Button>
                <Button variant="outline" onClick={resetConfirm}>
                  {strings.common.cancel}
                </Button>
              </div>
            </div>
          )}

          {!confirmAction && !isEditingItems && !isEditingPayment && (
            <div className="flex gap-2">
              {order.status === "new" && (
                <Button
                  variant="outline"
                  className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                  onClick={() => handleAdvanceStatus("preparing")}
                  disabled={processing}
                >
                  {processing && (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  )}
                  {strings.onlineOrders.startPreparing}
                </Button>
              )}
              {order.status === "preparing" && (
                <Button
                  variant="outline"
                  className="border-violet-500/40 text-violet-600 hover:bg-violet-500/10"
                  onClick={() => handleAdvanceStatus("ready")}
                  disabled={processing}
                >
                  {processing && (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  )}
                  {strings.onlineOrders.markReady}
                </Button>
              )}
              {isPreDispatch && (
                <>
                  <PremiumButton
                    className="flex-1"
                    onClick={() => setConfirmAction("dispatch")}
                  >
                    {strings.onlineOrders.dispatchOrder}
                  </PremiumButton>
                  <Button
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmAction("cancel")}
                  >
                    {strings.onlineOrders.cancelOrder}
                  </Button>
                </>
              )}
              {order.status === "dispatched" && (
                <Button
                  variant="outline"
                  className="flex-1 border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                  onClick={() => setConfirmAction("notReceived")}
                >
                  {strings.onlineOrders.markNotReceived}
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                {strings.common.cancel}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {order.billOfLadingImage && (
        <Dialog open={ladingPreviewOpen} onOpenChange={setLadingPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {strings.onlineOrdersExtra.shippingLabel}
              </DialogTitle>
            </DialogHeader>
            <img
              src={order.billOfLadingImage}
              alt={strings.onlineOrdersExtra.shippingLabelAlt}
              className="w-full rounded-lg border border-border"
            />
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
