import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(val: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(val)
}

export function formatPercent(val: number) {
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toFixed(2)}%`
}

export function formatNumber(val: number, decimals = 2) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val)
}
