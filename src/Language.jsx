import React, { createContext, useContext, useEffect, useState } from 'react';
import catalog from './pilot-translations.txt?raw';

const options = [
  { id: 'en-ZA', name: 'English' },
  { id: 'ss-ZA', name: 'siSwati' },
  { id: 'ts-ZA', name: 'Xitsonga' },
  { id: 've-ZA', name: 'Tshivenḓa' },
  { id: 'nr-ZA', name: 'isiNdebele' },
];

const preference = 'agrishield.language';
const messages = Object.fromEntries(catalog.trim().split(/\r?\n/).map(line => {
  const [english, ...translations] = line.split('|');
  return [english, translations];
}));
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    try {
      const stored = localStorage.getItem(preference);
      if (options.some(option => option.id === stored)) return stored;
    } catch {}
    return options[0].id;
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    try { localStorage.setItem(preference, locale); } catch {}
  }, [locale]);

  const index = options.findIndex(option => option.id === locale) - 1;
  const t = message => messages[message]?.[index] || message;
  return <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

export function LanguageSelect() {
  const { locale, setLocale, t } = useLanguage();
  return <label className="language-control">
    <span>{t('Language')}</span>
    <select value={locale} onChange={event => setLocale(event.target.value)}>
      {options.map(({ id, name }) => <option key={id} value={id} lang={id}>{name}</option>)}
    </select>
  </label>;
}
