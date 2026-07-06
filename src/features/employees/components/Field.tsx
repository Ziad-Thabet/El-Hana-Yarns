import { type ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="ms-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
