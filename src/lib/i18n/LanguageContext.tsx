import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  getLanguage,
  setLanguage as setLanguageStore,
  initLanguage,
  type AppLanguage,
} from "./store";

interface LanguageContextValue {
  language: AppLanguage;
  dir: "rtl" | "ltr";
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() =>
    initLanguage(),
  );

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: AppLanguage) => {
    if (lang === getLanguage()) return;
    setLanguageStore(lang);
    setLanguageState(lang);
  };

  const toggleLanguage = () => setLanguage(language === "ar" ? "en" : "ar");

  const dir: "rtl" | "ltr" = language === "ar" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider
      value={{ language, dir, setLanguage, toggleLanguage }}
    >
      {/* key={language} بيعمل remount كامل للشجرة عشان كل كومبوننت ياخد النص الجديد */}
      <div key={language} dir={dir} style={{ display: "contents" }}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
