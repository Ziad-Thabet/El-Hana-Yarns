import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-[var(--radius-md)]"
      onClick={toggleLanguage}
      title={language === "ar" ? "Switch to English" : "التبديل للعربية"}
    >
      <Languages className="h-4 w-4" />
      <span className="sr-only">{language === "ar" ? "English" : "عربي"}</span>
    </Button>
  );
}
