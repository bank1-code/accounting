import { I18nContext, Locale, translations, Translations } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";

const LOCALE_KEY = "dgtera-locale";

function getInitialLocale(): Locale {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved === "ar" || saved === "en") return saved;
  return "ar"; // Default Arabic
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_KEY, newLocale);
  }, []);

  const t: Translations = useMemo(() => translations[locale], [locale]);
  const dir = t.dir;

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = t.lang;
    document.documentElement.style.fontFamily =
      dir === "rtl"
        ? "'IBM Plex Sans Arabic', 'Segoe UI', sans-serif"
        : "'Inter', 'Segoe UI', sans-serif";
  }, [dir, t.lang]);

  const value = useMemo(
    () => ({ locale, t, setLocale, dir }),
    [locale, t, setLocale, dir]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
