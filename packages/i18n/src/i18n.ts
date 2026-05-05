/**
 * @object-ui/i18n - Core i18n configuration and initialization
 *
 * Wraps i18next with Object UI defaults and built-in locale support.
 */
import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { builtInLocales, isRTL } from './locales/index';
import type { TranslationKeys } from './locales/en';

export interface I18nConfig {
  /** Default language (default: 'en') */
  defaultLanguage?: string;
  /** Fallback language (default: 'en') */
  fallbackLanguage?: string;
  /** Additional translation resources to merge with built-in locales */
  resources?: Record<string, Record<string, unknown>>;
  /** Whether to detect browser language automatically (default: true) */
  detectBrowserLanguage?: boolean;
  /** i18next interpolation options */
  interpolation?: {
    escapeValue?: boolean;
    prefix?: string;
    suffix?: string;
  };
}

/**
 * Create and initialize an i18next instance with Object UI defaults
 */
export function createI18n(config: I18nConfig = {}): I18nInstance {
  const {
    defaultLanguage = 'en',
    fallbackLanguage = 'en',
    resources = {},
    detectBrowserLanguage = true,
    interpolation,
  } = config;

  // Merge built-in locales with user-provided resources
  const mergedResources: Record<string, { translation: Record<string, unknown> }> = {};

  for (const [lang, translations] of Object.entries(builtInLocales)) {
    mergedResources[lang] = {
      translation: {
        ...translations,
        ...(resources[lang] || {}),
      },
    };
  }

  // Add any additional languages from resources not in built-in locales
  for (const [lang, translations] of Object.entries(resources)) {
    if (!mergedResources[lang]) {
      mergedResources[lang] = { translation: translations as Record<string, unknown> };
    }
  }

  // Detect browser language if enabled
  let lng = defaultLanguage;
  if (detectBrowserLanguage && typeof navigator !== 'undefined') {
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang && mergedResources[browserLang]) {
      lng = browserLang;
    }
  }

  const instance = i18next.createInstance();

  // IMPORTANT: disable react-i18next Suspense. Otherwise `useTranslation()`
  // calls during bootstrap throw a Suspense promise (the i18n instance is
  // technically still "initializing" on the very first render in StrictMode),
  // which unmounts the entire App subtree — including ConditionalAuthWrapper,
  // so the discovery fetch never runs and the splash never appears.
  instance.use(initReactI18next).init({
    lng,
    fallbackLng: fallbackLanguage,
    resources: mergedResources,
    interpolation: {
      escapeValue: false, // React already escapes
      ...interpolation,
    },
    returnNull: false,
    react: {
      useSuspense: false,
    },
  });

  return instance;
}

/**
 * Get the text direction for the current language
 */
export function getDirection(lang: string): 'ltr' | 'rtl' {
  return isRTL(lang) ? 'rtl' : 'ltr';
}

/**
 * Get available languages from an i18n instance
 */
export function getAvailableLanguages(instance: I18nInstance): string[] {
  const resources = instance.options.resources;
  return resources ? Object.keys(resources) : [];
}

export type { TranslationKeys };
