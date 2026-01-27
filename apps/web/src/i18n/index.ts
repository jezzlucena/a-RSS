import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import locale files
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enFeeds from './locales/en/feeds.json';
import enArticles from './locales/en/articles.json';
import enSettings from './locales/en/settings.json';
import enNavigation from './locales/en/navigation.json';
import enSearch from './locales/en/search.json';
import enErrors from './locales/en/errors.json';
import enShortcuts from './locales/en/shortcuts.json';

import ptBRCommon from './locales/pt-BR/common.json';
import ptBRAuth from './locales/pt-BR/auth.json';
import ptBRFeeds from './locales/pt-BR/feeds.json';
import ptBRArticles from './locales/pt-BR/articles.json';
import ptBRSettings from './locales/pt-BR/settings.json';
import ptBRNavigation from './locales/pt-BR/navigation.json';
import ptBRSearch from './locales/pt-BR/search.json';
import ptBRErrors from './locales/pt-BR/errors.json';
import ptBRShortcuts from './locales/pt-BR/shortcuts.json';

import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esFeeds from './locales/es/feeds.json';
import esArticles from './locales/es/articles.json';
import esSettings from './locales/es/settings.json';
import esNavigation from './locales/es/navigation.json';
import esSearch from './locales/es/search.json';
import esErrors from './locales/es/errors.json';
import esShortcuts from './locales/es/shortcuts.json';

export const defaultNS = 'common';
export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    feeds: enFeeds,
    articles: enArticles,
    settings: enSettings,
    navigation: enNavigation,
    search: enSearch,
    errors: enErrors,
    shortcuts: enShortcuts,
  },
  'pt-BR': {
    common: ptBRCommon,
    auth: ptBRAuth,
    feeds: ptBRFeeds,
    articles: ptBRArticles,
    settings: ptBRSettings,
    navigation: ptBRNavigation,
    search: ptBRSearch,
    errors: ptBRErrors,
    shortcuts: ptBRShortcuts,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    feeds: esFeeds,
    articles: esArticles,
    settings: esSettings,
    navigation: esNavigation,
    search: esSearch,
    errors: esErrors,
    shortcuts: esShortcuts,
  },
} as const;

export const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt-BR', 'es'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'arss-language',
    },
  });

export default i18n;
