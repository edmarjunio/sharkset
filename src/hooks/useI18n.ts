import { useState, useEffect } from 'react';
import {
  getLocale,
  setLocale,
  subscribeLocale,
  translateKey,
  SupportedLocale,
} from '../services/i18n';

export function useI18n() {
  const [locale, setLocaleState] = useState<SupportedLocale>(getLocale());

  useEffect(() => {
    return subscribeLocale((newLocale) => {
      setLocaleState(newLocale);
    });
  }, []);

  const changeLocale = (nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
  };

  const toggleLocale = () => {
    setLocale(locale === 'pt' ? 'en' : 'pt');
  };

  return {
    locale,
    setLocale: changeLocale,
    toggleLocale,
    t: translateKey,
    tr: translateKey,
    isPortuguese: locale === 'pt',
    isEnglish: locale === 'en',
  };
}
