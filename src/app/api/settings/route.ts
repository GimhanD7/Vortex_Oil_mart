/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const defaultSettings = {
  store_name: 'Oil Mart',
  store_address: '123, Industrial Area, New Delhi',
  store_phone: '',
  gst_number: '',
  tax_rate: '18',
  invoice_prefix: 'INV',
  invoice_footer: 'Thank you for your visit! Drive safe. Stay protected.',
  invoice_logo_text: 'OM',
  invoice_print_style: 'Dot Matrix',
  payment_methods: ['Cash', 'Card', 'Bank Transfer'],
};

function normalizePaymentMethods(methods: string[]) {
  return Array.from(new Set(methods.map((method) => method === 'UPI' ? 'Bank Transfer' : method))).filter((method) => method !== 'UPI');
}

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

export async function GET() {
  try {
    await ensureSettingsTable();
    const [rows]: any = await pool.query('SELECT setting_key, setting_value FROM app_settings');
    const values = { ...defaultSettings };
    for (const row of rows) {
      if (row.setting_key === 'payment_methods') {
        values.payment_methods = normalizePaymentMethods(JSON.parse(row.setting_value));
      } else {
        values[row.setting_key as keyof typeof values] = row.setting_value as never;
      }
    }
    return NextResponse.json(values);
  } catch (error) {
    console.error('Error loading settings:', error);
    return NextResponse.json(defaultSettings);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSettingsTable();
    const body = await request.json();
    const settings = { ...defaultSettings, ...body };
    settings.payment_methods = normalizePaymentMethods(Array.isArray(settings.payment_methods) ? settings.payment_methods : defaultSettings.payment_methods);
    const entries = Object.entries(settings);

    for (const [key, value] of entries) {
      const storedValue = Array.isArray(value) ? JSON.stringify(value) : String(value ?? '');
      await pool.query(
        `INSERT INTO app_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, storedValue]
      );
    }

    return NextResponse.json({ message: 'Settings saved successfully', settings });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Unable to save settings' }, { status: 500 });
  }
}
