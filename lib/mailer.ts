import nodemailer from 'nodemailer'
import { readFile } from 'fs/promises'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), '..', 'settings-data.json')

async function getMailCredentials(): Promise<{ user: string; pass: string; salonName: string }> {
  const envUser = process.env.EMAIL_USER
  const envPass = process.env.EMAIL_PASS
  if (envUser && envPass) {
    return { user: envUser, pass: envPass, salonName: process.env.NEXT_PUBLIC_APP_NAME || 'جلامور' }
  }
  // Try DB first (most reliable in production)
  try {
    const pool = (await import('@/lib/db')).default
    const result = await pool.query('SELECT email_user, email_pass, name FROM salon_settings WHERE id=1')
    if (result.rows[0]?.email_user && result.rows[0]?.email_pass) {
      return {
        user: result.rows[0].email_user,
        pass: result.rows[0].email_pass,
        salonName: result.rows[0].name || 'جلامور',
      }
    }
  } catch { /* DB unavailable */ }
  // Fallback: shared file (works locally)
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8')
    const data = JSON.parse(raw)
    if (data.email_user && data.email_pass) {
      return { user: data.email_user, pass: data.email_pass, salonName: data.name || 'جلامور' }
    }
  } catch { /* file unavailable */ }
  return { user: envUser || '', pass: envPass || '', salonName: 'جلامور' }
}

function createTransporter(user: string, pass: string) {
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
}

export async function sendOtpEmail(email: string, code: string) {
  const { user, pass, salonName } = await getMailCredentials()
  if (!user || !pass) return
  await createTransporter(user, pass).sendMail({
    from: `"${salonName}" <${user}>`,
    to: email,
    subject: `رمز التحقق - ${salonName}`,
    html: `
      <div style="font-family:sans-serif;text-align:center;padding:24px;direction:rtl;">
        <h2 style="color:#B8924A;">${salonName}</h2>
        <p>رمز التحقق الخاص بك هو:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0;">${code}</div>
        <p style="color:#888;font-size:13px;">صالح لمدة 10 دقائق</p>
      </div>
    `,
  })
}

export async function sendBookingConfirmation(email: string, opts: {
  customerName: string
  serviceName: string
  date: string
  time: string
  staffName: string
  branchName: string
  price: number | string
}) {
  const { user, pass, salonName } = await getMailCredentials()
  if (!user || !pass || !email) return
  const { customerName, serviceName, date, staffName, branchName, price, time } = opts
  await createTransporter(user, pass).sendMail({
    from: `"${salonName}" <${user}>`,
    to: email,
    subject: `تأكيد حجزك - ${salonName}`,
    html: `
      <div style="font-family:sans-serif;direction:rtl;max-width:480px;margin:auto;padding:24px;background:#fff;">
        <div style="background:linear-gradient(135deg,#1A1A2E,#0F3460);border-radius:16px 16px 0 0;padding:28px 24px;text-align:center;">
          <h1 style="color:#B8924A;margin:0 0 6px;font-size:22px;">${salonName}</h1>
          <p style="color:rgba(255,255,255,0.7);margin:0;font-size:14px;">تأكيد الحجز</p>
        </div>
        <div style="border:1px solid #E8E4DC;border-top:none;border-radius:0 0 16px 16px;padding:24px;">
          <p style="font-size:15px;color:#374151;">أهلاً <strong>${customerName}</strong>،</p>
          <p style="font-size:14px;color:#6B7280;margin-bottom:20px;">تم تأكيد حجزك بنجاح. إليك تفاصيل موعدك:</p>
          <table style="width:100%;border-collapse:collapse;">
            ${[
              ['الخدمة', serviceName],
              ['التاريخ', date],
              ['الوقت', time],
              ['الموظفة', staffName],
              ['الفرع', branchName],
              ['السعر', `${Number(price).toLocaleString()} ر.س`],
            ].map(([l, v]) => `
              <tr>
                <td style="padding:10px 12px;background:#F9FAFB;border-radius:8px;color:#9CA3AF;font-size:13px;width:40%;">${l}</td>
                <td style="padding:10px 12px;font-weight:700;font-size:14px;color:#1A1A2E;">${v}</td>
              </tr>
              <tr><td colspan="2" style="height:6px;"></td></tr>
            `).join('')}
          </table>
          <div style="background:#FEF3E2;border:1px solid #F59E0B;border-radius:10px;padding:14px;margin-top:20px;font-size:13px;color:#92400E;">
            ⏰ يرجى الحضور قبل 5 دقائق من موعدك. لإلغاء أو تعديل الموعد، تواصل معنا مسبقاً.
          </div>
          <p style="text-align:center;color:#9CA3AF;font-size:12px;margin-top:20px;">شكراً لاختيارك ${salonName} 💛</p>
        </div>
      </div>
    `,
  })
}

export async function sendOrderConfirmation(email: string, opts: {
  customerName: string
  orderId: string | number
  items: Array<{ name: string; quantity: number; price: number }>
  total: number | string
}) {
  const { user, pass, salonName } = await getMailCredentials()
  if (!user || !pass || !email) return
  const { customerName, orderId, items, total } = opts
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding:10px 12px;background:#F9FAFB;border-radius:8px;font-size:13px;color:#374151;">${item.name}</td>
      <td style="padding:10px 12px;text-align:center;font-size:13px;color:#6B7280;">${item.quantity}</td>
      <td style="padding:10px 12px;text-align:left;font-weight:700;font-size:13px;color:#B8924A;">${(item.price * item.quantity).toLocaleString()} ر.س</td>
    </tr>
    <tr><td colspan="3" style="height:4px;"></td></tr>
  `).join('')
  await createTransporter(user, pass).sendMail({
    from: `"${salonName}" <${user}>`,
    to: email,
    subject: `تأكيد طلبك #${orderId} - ${salonName}`,
    html: `
      <div style="font-family:sans-serif;direction:rtl;max-width:480px;margin:auto;padding:24px;background:#fff;">
        <div style="background:linear-gradient(135deg,#1A1A2E,#0F3460);border-radius:16px 16px 0 0;padding:28px 24px;text-align:center;">
          <h1 style="color:#B8924A;margin:0 0 6px;font-size:22px;">${salonName}</h1>
          <p style="color:rgba(255,255,255,0.7);margin:0;font-size:14px;">تأكيد الطلب #${orderId}</p>
        </div>
        <div style="border:1px solid #E8E4DC;border-top:none;border-radius:0 0 16px 16px;padding:24px;">
          <p style="font-size:15px;color:#374151;">أهلاً <strong>${customerName}</strong>،</p>
          <p style="font-size:14px;color:#6B7280;margin-bottom:20px;">تم استلام طلبك بنجاح وهو قيد المراجعة. إليك تفاصيل طلبك:</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <th style="text-align:right;padding:8px 12px;font-size:12px;color:#9CA3AF;font-weight:600;">المنتج</th>
              <th style="text-align:center;padding:8px 12px;font-size:12px;color:#9CA3AF;font-weight:600;">الكمية</th>
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:#9CA3AF;font-weight:600;">السعر</th>
            </tr>
            ${itemsHtml}
          </table>
          <div style="display:flex;justify-content:space-between;padding:14px 12px;background:#1A1A2E;border-radius:10px;margin-top:12px;">
            <span style="color:white;font-weight:800;font-size:15px;">الإجمالي</span>
            <span style="color:#B8924A;font-weight:900;font-size:18px;">${Number(total).toLocaleString()} ر.س</span>
          </div>
          <div style="background:#FEF3E2;border:1px solid #F59E0B;border-radius:10px;padding:14px;margin-top:16px;font-size:13px;color:#92400E;">
            📦 سيتم معالجة طلبك وإشعارك بموعد الاستلام خلال دقائق.
          </div>
          <p style="text-align:center;color:#9CA3AF;font-size:12px;margin-top:20px;">شكراً لاختيارك ${salonName} 💛</p>
        </div>
      </div>
    `,
  })
}
