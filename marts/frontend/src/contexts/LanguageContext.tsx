import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { type LangCode, t as translate } from '../lib/i18n'

interface LanguageCtx {
  lang: LangCode
  currency: string
  setLang: (l: LangCode) => void
  setCurrency: (c: string) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageCtx>({
  lang: 'en-US',
  currency: 'USD',
  setLang: () => {},
  setCurrency: () => {},
  t: (k) => k,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(
    () => (localStorage.getItem('finai-language') as LangCode) || 'en-US'
  )
  const [currency, setCurrencyState] = useState(
    () => localStorage.getItem('finai-currency') || 'USD'
  )

  const setLang = useCallback((l: LangCode) => {
    setLangState(l)
    localStorage.setItem('finai-language', l)
    document.documentElement.lang = l.split('-')[0]
    // RTL support
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'
  }, [])

  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c)
    localStorage.setItem('finai-currency', c)
  }, [])

  // Apply on mount
  useEffect(() => {
    document.documentElement.lang = lang.split('-')[0]
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  // Listen for legacy locale-change events (from SettingsPage)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { language: LangCode; currency: string }
      if (detail?.language) setLang(detail.language)
      if (detail?.currency) setCurrency(detail.currency)
    }
    window.addEventListener('finai-locale-change', handler)
    return () => window.removeEventListener('finai-locale-change', handler)
  }, [setLang, setCurrency])

  const tFn = useCallback((key: string) => translate(key, lang), [lang])

  return (
    <LanguageContext.Provider value={{ lang, currency, setLang, setCurrency, t: tFn }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
