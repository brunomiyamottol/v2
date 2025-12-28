import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool, formatError } from './_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(formatError('Method not allowed'));
  }

  try {
    const result = await pool.query(`
      SELECT insurer_key, insurer_name 
      FROM dw.dim_insurer 
      WHERE insurer_name IS NOT NULL 
      ORDER BY insurer_name
    `);
    res.json({ success: true, data: result.rows, error: null });
  } catch (error: any) {
    console.error('[Insurers] Error:', error.message);
    res.status(500).json(formatError(error.message));
  }
}
