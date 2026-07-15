import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT bba.bank_name, bba.account_holder, bba.iban, bba.account_number,
              bba.swift_code, bba.currency, bba.id, bba.branch_id
       FROM branch_bank_accounts bba
       WHERE bba.is_active = TRUE AND bba.is_default = TRUE
       ORDER BY bba.sort_order, bba.created_at
       LIMIT 1`
    )
    if (result.rows.length > 0) {
      return NextResponse.json(result.rows[0])
    }
    // Fallback: return any active account
    const fallback = await pool.query(
      `SELECT bba.bank_name, bba.account_holder, bba.iban, bba.account_number,
              bba.swift_code, bba.currency, bba.id, bba.branch_id
       FROM branch_bank_accounts bba
       WHERE bba.is_active = TRUE
       ORDER BY bba.sort_order, bba.created_at
       LIMIT 1`
    )
    if (fallback.rows.length > 0) {
      return NextResponse.json(fallback.rows[0])
    }
    return NextResponse.json({ bank_name: '', account_holder: '', iban: '', account_number: '' })
  } catch (err: any) {
    console.error('[bank-account GET]', err.message)
    return NextResponse.json({ bank_name: '', account_holder: '', iban: '', account_number: '' })
  }
}
