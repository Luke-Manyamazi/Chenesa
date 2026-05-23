export const PLANS = {
  free:  { maxRuns: 3,        maxEmails: 50,   maxAccounts: 1, price: 0  },
  basic: { maxRuns: Infinity, maxEmails: 500,  maxAccounts: 2, price: 7  },
  pro:   { maxRuns: Infinity, maxEmails: null, maxAccounts: 4, price: 15 },
} as const

export const CATEGORY_LABELS: Record<string, string> = {
  SPAM:      '🚫 Spam',
  MARKETING: '📢 Marketing',
  SOCIAL:    '🌐 Social',
  OLD_READ:  '📅 Old & Read',
  KEEP:      '✅ Kept',
  UNKNOWN:   '❓ Unknown',
}

export const CATEGORY_COLORS: Record<string, string> = {
  SPAM:      'bg-red-500/20 text-red-400',
  MARKETING: 'bg-orange-500/20 text-orange-400',
  SOCIAL:    'bg-blue-500/20 text-blue-400',
  OLD_READ:  'bg-gray-500/20 text-gray-400',
  KEEP:      'bg-green-500/20 text-green-400',
  UNKNOWN:   'bg-yellow-500/20 text-yellow-400',
}

export const PROVIDER_NAMES: Record<string, string> = {
  gmail:   'Gmail',
  imap:    'Email',
  outlook: 'Outlook',
  yahoo:   'Yahoo',
  icloud:  'iCloud',
  aol:     'AOL',
  zoho:    'Zoho',
}

export const PROVIDER_ICONS: Record<string, string> = {
  gmail:        '📧',
  'outlook.com':'📨',
  'hotmail.com':'📨',
  'live.com':   '📨',
  'yahoo.com':  '📮',
  'icloud.com': '🍎',
  'me.com':     '🍎',
  'aol.com':    '📬',
  'zoho.com':   '📭',
}

export function getProviderIcon(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return PROVIDER_ICONS[domain] ?? '✉️'
}
