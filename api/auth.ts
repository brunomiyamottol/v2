import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'xnuup2024';

function generateToken(password: string): string {
  return crypto.createHash('sha256').update(password + Date.now().toString()).digest('hex');
}

function verifyToken(token: string): boolean {
  return !!token && token.length === 64;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { password } = req.body || {};
    if (password === DASHBOARD_PASSWORD) {
      return res.json({ success: true, token: generateToken(password) });
    }
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  return res.json({ valid: token ? verifyToken(token) : false });
}
