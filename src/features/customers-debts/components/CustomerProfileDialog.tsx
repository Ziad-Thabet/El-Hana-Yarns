import { useEffect, useState } from "react";
import {
  Loader2,
  MapPin,
  Phone,
  Plus,
  Pencil,
  Trash2,
  Star,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCustomerProfile,
  useUpdateCustomer,
  useAddCustomerAddress,
  useUpdateCustomerAddress,
  useDeleteCustomerAddress,
  useSetDefaultAddress,
  useAddCustomerPhone,
  useUpdateCustomerPhone,
  useDeleteCustomerPhone,
} from "@/features/customers-debts/hooks";
import { strings } from "@/lib/i18n/ar";
import type {
  Customer,
  CustomerAddress,
  CustomerPhone,
} from "@/features/customers-debts/types";

interface CustomerProfileDialogProps {
  customer: Customer | null;
  isAdmin: boolean;
  open: boolean;
  onClose: () => void;
}

const EMPTY_ADDRESS_FORM = {
  addressText: "",
  label: "",
  region: "",
  isDefault: false,
};
const EMPTY_PHONE_FORM = { phone: "", label: "" };

export function CustomerProfileDialog({
  customer,
  isAdmin,
  open,
  onClose,
}: CustomerProfileDialogProps) {
  const { data: profile, isLoading } = useCustomerProfile(
    customer?.id ?? "",
    open && !!customer,
  );

  const updateCustomer = useUpdateCustomer();
  const addAddress = useAddCustomerAddress();
  const updateAddress = useUpdateCustomerAddress();
  const deleteAddress = useDeleteCustomerAddress();
  const setDefaultAddress = useSetDefaultAddress();
  const addPhone = useAddCustomerPhone();
  const updatePhone = useUpdateCustomerPhone();
  const deletePhone = useDeleteCustomerPhone();

  const [primaryPhone, setPrimaryPhone] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS_FORM);
  const [addingPhone, setAddingPhone] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [phoneForm, setPhoneForm] = useState(EMPTY_PHONE_FORM);

  useEffect(() => {
    if (profile?.customer) setPrimaryPhone(profile.customer.phone ?? "");
  }, [profile?.customer]);

  useEffect(() => {
    if (!open) {
      setAddingAddress(false);
      setEditingAddressId(null);
      setAddressForm(EMPTY_ADDRESS_FORM);
      setAddingPhone(false);
      setEditingPhoneId(null);
      setPhoneForm(EMPTY_PHONE_FORM);
    }
  }, [open]);

  if (!customer) return null;

  const savePrimaryPhone = () => {
    if (!profile?.customer) return;
    updateCustomer.mutate({
      id: profile.customer.id,
      data: {
        name: profile.customer.name,
        phone: primaryPhone,
        address: profile.customer.address,
      },
    });
  };

  const startEditAddress = (address: CustomerAddress) => {
    setAddingAddress(false);
    setEditingAddressId(address.id);
    setAddressForm({
      addressText: address.addressText,
      label: address.label ?? "",
      region: address.region ?? "",
      isDefault: address.isDefault,
    });
  };

  const submitAddressForm = () => {
    if (!addressForm.addressText.trim() || !customer) return;
    const data = {
      addressText: addressForm.addressText,
      label: addressForm.label || null,
      region: addressForm.region || null,
      isDefault: addressForm.isDefault,
    };
    if (editingAddressId) {
      updateAddress.mutate(
        { addressId: editingAddressId, data, customerId: customer.id },
        { onSuccess: () => setEditingAddressId(null) },
      );
    } else {
      addAddress.mutate(
        { customerId: customer.id, data },
        { onSuccess: () => setAddingAddress(false) },
      );
    }
    setAddressForm(EMPTY_ADDRESS_FORM);
  };

  const startEditPhone = (phone: CustomerPhone) => {
    setAddingPhone(false);
    setEditingPhoneId(phone.id);
    setPhoneForm({ phone: phone.phone, label: phone.label ?? "" });
  };

  const submitPhoneForm = () => {
    if (!phoneForm.phone.trim() || !customer) return;
    const data = { phone: phoneForm.phone, label: phoneForm.label || null };
    if (editingPhoneId) {
      updatePhone.mutate(
        { phoneId: editingPhoneId, data, customerId: customer.id },
        { onSuccess: () => setEditingPhoneId(null) },
      );
    } else {
      addPhone.mutate(
        { customerId: customer.id, data },
        { onSuccess: () => setAddingPhone(false) },
      );
    }
    setPhoneForm(EMPTY_PHONE_FORM);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer.name}</DialogTitle>
        </DialogHeader>

        {isLoading || !profile ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Primary phone */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {strings.customerProfiles.primaryPhone}
                </Label>
                <Input
                  value={primaryPhone}
                  onChange={(e) => setPrimaryPhone(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={savePrimaryPhone}
                disabled={updateCustomer.isPending}
              >
                {strings.common.save}
              </Button>
            </div>

            {/* Addresses */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {strings.customerProfiles.addresses}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingAddressId(null);
                    setAddressForm(EMPTY_ADDRESS_FORM);
                    setAddingAddress((v) => !v);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 me-1" />
                  {strings.customerProfiles.addAddress}
                </Button>
              </div>

              {profile.addresses.length === 0 && !addingAddress && (
                <p className="text-sm text-muted-foreground">
                  {strings.customerProfiles.noAddresses}
                </p>
              )}

              {profile.addresses.map((address) =>
                editingAddressId === address.id ? (
                  <AddressForm
                    key={address.id}
                    form={addressForm}
                    setForm={setAddressForm}
                    onSubmit={submitAddressForm}
                    onCancel={() => setEditingAddressId(null)}
                  />
                ) : (
                  <div
                    key={address.id}
                    className="bg-secondary border border-border rounded-lg p-3 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {address.label ||
                            strings.customerProfiles.addressText}
                        </p>
                        {address.isDefault && (
                          <Badge variant="outline" className="text-xs">
                            {strings.customerProfiles.defaultAddress}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {address.addressText}
                      </p>
                      {address.region && (
                        <p className="text-xs text-muted-foreground">
                          {address.region}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!address.isDefault && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title={strings.customerProfiles.setDefault}
                          onClick={() =>
                            setDefaultAddress.mutate({
                              customerId: customer.id,
                              addressId: address.id,
                            })
                          }
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditAddress(address)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            deleteAddress.mutate({
                              addressId: address.id,
                              customerId: customer.id,
                            })
                          }
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ),
              )}

              {addingAddress && (
                <AddressForm
                  form={addressForm}
                  setForm={setAddressForm}
                  onSubmit={submitAddressForm}
                  onCancel={() => setAddingAddress(false)}
                />
              )}
            </div>

            {/* Extra phones */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                  <Phone className="w-4 h-4" />
                  {strings.customerProfiles.phones}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingPhoneId(null);
                    setPhoneForm(EMPTY_PHONE_FORM);
                    setAddingPhone((v) => !v);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 me-1" />
                  {strings.customerProfiles.addPhone}
                </Button>
              </div>

              {profile.phones.length === 0 && !addingPhone && (
                <p className="text-sm text-muted-foreground">
                  {strings.customerProfiles.noPhones}
                </p>
              )}

              {profile.phones.map((phone) =>
                editingPhoneId === phone.id ? (
                  <PhoneForm
                    key={phone.id}
                    form={phoneForm}
                    setForm={setPhoneForm}
                    onSubmit={submitPhoneForm}
                    onCancel={() => setEditingPhoneId(null)}
                  />
                ) : (
                  <div
                    key={phone.id}
                    className="bg-secondary border border-border rounded-lg p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {phone.phone}
                      </p>
                      {phone.label && (
                        <p className="text-xs text-muted-foreground">
                          {phone.label}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditPhone(phone)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            deletePhone.mutate({
                              phoneId: phone.id,
                              customerId: customer.id,
                            })
                          }
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ),
              )}

              {addingPhone && (
                <PhoneForm
                  form={phoneForm}
                  setForm={setPhoneForm}
                  onSubmit={submitPhoneForm}
                  onCancel={() => setAddingPhone(false)}
                />
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface AddressFormState {
  addressText: string;
  label: string;
  region: string;
  isDefault: boolean;
}

function AddressForm({
  form,
  setForm,
  onSubmit,
  onCancel,
}: {
  form: AddressFormState;
  setForm: (form: AddressFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-3 bg-card">
      <div>
        <Label>{strings.customerProfiles.addressText} *</Label>
        <Input
          value={form.addressText}
          onChange={(e) => setForm({ ...form, addressText: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{strings.customerProfiles.region}</Label>
          <Input
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          />
        </div>
        <div>
          <Label>{strings.onlineOrders.addressLabel}</Label>
          <Input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="isDefaultAddress"
          checked={form.isDefault}
          onCheckedChange={(v) => setForm({ ...form, isDefault: !!v })}
        />
        <Label htmlFor="isDefaultAddress" className="text-sm cursor-pointer">
          {strings.customerProfiles.defaultAddress}
        </Label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {strings.common.cancel}
        </Button>
        <Button size="sm" onClick={onSubmit}>
          {strings.common.save}
        </Button>
      </div>
    </div>
  );
}

interface PhoneFormState {
  phone: string;
  label: string;
}

function PhoneForm({
  form,
  setForm,
  onSubmit,
  onCancel,
}: {
  form: PhoneFormState;
  setForm: (form: PhoneFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-3 bg-card">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{strings.onlineOrders.customerPhone} *</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="01xxxxxxxxx"
          />
        </div>
        <div>
          <Label>{strings.customerProfiles.phoneLabel}</Label>
          <Input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {strings.common.cancel}
        </Button>
        <Button size="sm" onClick={onSubmit}>
          {strings.common.save}
        </Button>
      </div>
    </div>
  );
}
