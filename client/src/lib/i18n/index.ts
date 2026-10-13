import { createContext, useContext } from "react";
import { ar } from "./ar";
import { en } from "./en";

export type Locale = "ar" | "en";

// Use a base type that allows both rtl and ltr
type BaseTranslations = Omit<typeof ar, "dir"> & { dir: "rtl" | "ltr" };
export type Translations = BaseTranslations;

export const translations: Record<Locale, Translations> = {
  ar: ar as Translations,
  en: en as Translations,
};

export type I18nContextType = {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
  dir: "rtl" | "ltr";
};

export const I18nContext = createContext<I18nContextType>({
  locale: "ar",
  t: ar as Translations,
  setLocale: () => {},
  dir: "rtl",
});

export function useI18n() {
  return useContext(I18nContext);
}

export { ar, en };
