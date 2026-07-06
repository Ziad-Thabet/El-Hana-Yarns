function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const formatted = formatPhoneForWhatsApp(phone);
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}
