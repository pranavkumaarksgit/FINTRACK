export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
];

export const DEFAULT_CURRENCY = 'INR';

export function isValidCurrency(code: any): boolean {
  if (!code || typeof code !== 'string') return false;
  const upper = code.trim().toUpperCase();
  return SUPPORTED_CURRENCIES.some((c) => c.code === upper);
}

export function getCurrencyConfig(code?: string): CurrencyConfig {
  if (!code || typeof code !== 'string') {
    return SUPPORTED_CURRENCIES[0];
  }
  const upper = code.trim().toUpperCase();
  const match = SUPPORTED_CURRENCIES.find((c) => c.code === upper);
  return match || SUPPORTED_CURRENCIES[0];
}
