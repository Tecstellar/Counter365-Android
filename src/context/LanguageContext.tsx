import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../lib/storage';
import { TRANSLATIONS, SupportedLanguage } from '../i18n/translations';

export type LanguageCode = SupportedLanguage;

export interface LanguageOption {
  code: LanguageCode;
  shortCode: string;
  name: string;
  nativeName: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', shortCode: 'EN', name: 'English', nativeName: 'English' },
  { code: 'ta', shortCode: 'TA', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'hi', shortCode: 'HI', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ml', shortCode: 'ML', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'kn', shortCode: 'KN', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'te', shortCode: 'TE', name: 'Telugu', nativeName: 'తెలుగు' },
];

const STORAGE_LANG_KEY = '@counterpro/app_language';

interface LanguageContextType {
  language: LanguageCode;
  currentLanguage: LanguageOption;
  setLanguage: (code: LanguageCode) => Promise<void>;
  languages: LanguageOption[];
  t: (key: string, defaultText?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({} as any);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.getItem(STORAGE_LANG_KEY);
        if (saved && LANGUAGES.some(l => l.code === saved)) {
          setLanguageState(saved as LanguageCode);
        }
      } catch (e) {
        console.warn('Failed to load saved language:', e);
      }
    })();
  }, []);

  const setLanguage = async (code: LanguageCode) => {
    setLanguageState(code);
    try {
      await storage.setItem(STORAGE_LANG_KEY, code);
    } catch (e) {
      console.warn('Failed to persist language:', e);
    }
  };

  const t = useCallback(
    (key: string, defaultText?: string): string => {
      const activeDict = TRANSLATIONS[language];
      if (activeDict && activeDict[key]) {
        return activeDict[key];
      }
      const enDict = TRANSLATIONS.en;
      if (enDict && enDict[key]) {
        return enDict[key];
      }
      return defaultText !== undefined ? defaultText : key;
    },
    [language]
  );

  const currentLanguage = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ language, currentLanguage, setLanguage, languages: LANGUAGES, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
