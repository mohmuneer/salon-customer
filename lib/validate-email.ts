/**
 * Shared email validation — strict, comprehensive, and typo-aware.
 * Used by both glamour-admin and glamour-customer.
 */

/** Known valid TLDs (common ones) — for fast rejection */
const VALID_TLDS = new Set([
  'com','net','org','edu','gov','mil','int',
  'io','co','me','tv','cc','us','uk','ca','au','de','fr','sa','ae','eg','jo','kw','bh','qa','om','iq','ly','tn','ma','dz',
  'info','biz','name','pro','mobi','travel','museum','aero','coop','jobs',
  'online','site','tech','store','app','dev','cloud','design','shop','blog','space','fun','site','xyz','top','vip',
  'edu','ac','sch','gov',
  'gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','icloud.com','me.com','mac.com',
  'mail.ru','yandex.ru','gmx.com','protonmail.com','zoho.com','aol.com',
])

/** Common Gmail typos → correction */
const EMAIL_TYPO_MAP: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.ocm': 'gmail.com',
  'gnail.com': 'gmail.com',
  'goglemail.com': 'gmail.com',
  'googlemail.com': 'gmail.com',
  'hotnail.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.cm': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.cm': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'icloud.cm': 'icloud.com',
  'icloud.con': 'icloud.com',
}

export interface EmailValidationResult {
  valid: boolean
  error?: string
  suggestion?: string
  domain?: string
  isGmail?: boolean
}

/**
 * Full email validation:
 * 1. Format (RFC-compliant regex + structural checks)
 * 2. Domain validation (TLD check)
 * 3. Typo detection and suggestion
 */
export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim().toLowerCase()

  // ── Basic structure ──
  if (!trimmed) return { valid: false, error: 'البريد الإلكتروني مطلوب' }
  if (trimmed.includes(' ')) return { valid: false, error: 'البريد الإلكتروني لا يحتوي على مسافات' }
  if (trimmed.startsWith('@')) return { valid: false, error: 'البريد الإلكتروني يجب أن يبدأ باسم المستخدم' }
  if (trimmed.endsWith('@')) return { valid: false, error: 'البريد الإلكتروني يجب أن يحتوي على اسم النطاق' }
  if (!trimmed.includes('@')) return { valid: false, error: 'البريد الإلكتروني يجب أن يحتوي على @' }
  if (trimmed.includes('@@')) return { valid: false, error: 'البريد الإلكتروني يحتوي على @@' }

  const parts = trimmed.split('@')
  if (parts.length !== 2) return { valid: false, error: 'صيغة البريد الإلكتروني غير صحيحة' }

  const [local, domain] = parts

  // ── Local part validation ──
  if (!local) return { valid: false, error: 'اسم المستخدم مطلوب' }
  if (local.length > 64) return { valid: false, error: 'اسم المستخدم طويل جداً (الحد الأقصى 64 حرف)' }
  if (local.startsWith('.') || local.endsWith('.')) return { valid: false, error: 'اسم المستخدم لا يبدأ أو ينتهي بنقطة' }
  if (local.includes('..')) return { valid: false, error: 'اسم المستخدم لا يحتوي على نقطتين متتاليتين' }

  // Allowed chars in local part
  const localRe = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+$/
  if (!localRe.test(local)) return { valid: false, error: 'اسم المستخدم يحتوي على رموز غير مسموحة' }

  // ── Domain validation ──
  if (!domain) return { valid: false, error: 'اسم النطاق مطلوب' }
  if (domain.length > 253) return { valid: false, error: 'اسم النطاق طويل جداً' }
  if (domain.startsWith('.') || domain.endsWith('.')) return { valid: false, error: 'اسم النطاق لا يبدأ أو ينتهي بنقطة' }
  if (domain.startsWith('-') || domain.endsWith('-')) return { valid: false, error: 'اسم النطاق لا يبدأ أو ينتهي بشرطة' }
  if (!domain.includes('.')) return { valid: false, error: 'اسم النطاق يجب أن يحتوي على نقطة (مثال: gmail.com)' }

  const domainParts = domain.split('.')
  if (domainParts.some(p => !p)) return { valid: false, error: 'اسم النطاق يحتوي على أجزاء فارغة' }
  if (domainParts.some(p => p.startsWith('-') || p.endsWith('-'))) return { valid: false, error: 'أجزاء النطاق لا تبدأ أو تنتهي بشرطة' }

  const domainRe = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/
  if (!domainRe.test(domain)) return { valid: false, error: 'صيغة النطاق غير صحيحة' }

  const tld = domainParts[domainParts.length - 1]
  if (tld.length < 2) return { valid: false, error: 'الامتداد يجب أن يكون حرفين على الأقل (مثال: .com)' }
  if (!/^[a-zA-Z]+$/.test(tld)) return { valid: false, error: 'الامتداد يجب أن يحتوي على حروف فقط' }

  // ── Known domain check ──
  const baseDomain = domainParts.slice(-2).join('.')
  if (!VALID_TLDS.has(baseDomain) && !VALID_TLDS.has(tld)) {
    return { valid: false, error: 'البريد الإلكتروني غير صالح أو لا يمكن استقبال الرسائل عليه', domain }
  }

  // ── Typo correction ──
  const correctedDomain = EMAIL_TYPO_MAP[domain]
  if (correctedDomain) {
    const suggestion = `${local}@${correctedDomain}`
    return { valid: false, error: `هل تقصد ${suggestion}؟`, suggestion, domain, isGmail: correctedDomain === 'gmail.com' }
  }

  // ── Double-check common patterns ──
  if (/\.co$/.test(domain) && !domain.endsWith('.co.kr') && !domain.endsWith('.co.jp') && !domain.endsWith('.co.uk')) {
    return { valid: false, error: `هل تقصد ${domain.replace(/\.co$/, '.com')}؟`, suggestion: `${local}@${domain.replace(/\.co$/, '.com')}`, domain }
  }

  return { valid: true, domain, isGmail: domain === 'gmail.com' || domain === 'googlemail.com' }
}

/**
 * Normalize email: lowercase + trim + googlemail → gmail
 */
export function normalizeEmail(email: string): string {
  let e = email.trim().toLowerCase()
  if (e.endsWith('@googlemail.com')) e = e.replace(/@googlemail\.com$/, '@gmail.com')
  return e
}
