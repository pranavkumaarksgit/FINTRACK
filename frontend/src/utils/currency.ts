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

export function getCurrencyConfig(code?: string | null): CurrencyConfig {
  if (!code || typeof code !== 'string') {
    return SUPPORTED_CURRENCIES[0];
  }
  const upper = code.trim().toUpperCase();
  const match = SUPPORTED_CURRENCIES.find((c) => c.code === upper);
  return match || SUPPORTED_CURRENCIES[0];
}

export interface FormatCurrencyOptions {
  showPlusSign?: boolean;
  decimals?: number;
  compact?: boolean;
}

/**
 * Global centralized currency formatter.
 * Formats numbers into localized currency display:
 * formatCurrency(50000, "INR") => "₹50,000"
 * formatCurrency(50000, "USD") => "$50,000"
 * formatCurrency(-12500, "EUR") => "-€12,500"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currencyCode?: string | null,
  options?: FormatCurrencyOptions
): string {
  const num = typeof amount === 'number' ? amount : Number(amount ?? 0);
  const safeNum = isNaN(num) ? 0 : num;
  const config = getCurrencyConfig(currencyCode);

  const isNegative = safeNum < 0;
  const absVal = Math.abs(safeNum);

  // Compact notation if requested (e.g. 1.2M, 50k)
  if (options?.compact) {
    if (absVal >= 1_000_000) {
      const formatted = (absVal / 1_000_000).toFixed(1).replace(/\.0$/, '');
      const prefix = isNegative ? '-' : options?.showPlusSign && safeNum > 0 ? '+' : '';
      return `${prefix}${config.symbol}${formatted}M`;
    }
    if (absVal >= 1_000) {
      const formatted = (absVal / 1_000).toFixed(1).replace(/\.0$/, '');
      const prefix = isNegative ? '-' : options?.showPlusSign && safeNum > 0 ? '+' : '';
      return `${prefix}${config.symbol}${formatted}k`;
    }
  }

  const locale = config.code === 'INR' ? 'en-IN' : 'en-US';
  const hasDecimals = options?.decimals !== undefined
    ? options.decimals > 0
    : !Number.isInteger(absVal);

  let formattedNumber = '';
  try {
    formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: options?.decimals !== undefined ? options.decimals : (hasDecimals ? 2 : 0),
      maximumFractionDigits: options?.decimals !== undefined ? options.decimals : (hasDecimals ? 2 : 0),
    }).format(absVal);
  } catch {
    formattedNumber = absVal.toLocaleString(locale);
  }

  // Spacing for multi-character text symbols like "د.إ " or "CHF "
  const symbolSpacing = config.symbol.length > 2 ? ' ' : '';
  const prefix = isNegative ? '-' : options?.showPlusSign && safeNum > 0 ? '+' : '';

  return `${prefix}${config.symbol}${symbolSpacing}${formattedNumber}`;
}
