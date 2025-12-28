import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'xnuup2024';

function generateToken(password: string): string {
  return crypto.createHash('sha256').update(password + Date.now().toString()).digest('hex');
}

function verifyToken(token: string): boolean {
  // Simple token validation - in production use JWT
  return token && token.length === 64;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    // Login
    const { password } = req.body || {};
    
    if (password === DASHBOARD_PASSWORD) {
      const token = generateToken(password);
      return res.json({ success: true, token });
    }
    
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }
  
  if (req.method === 'GET') {
    // Verify token
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (token && verifyToken(token)) {
      return res.json({ valid: true });
    }
    
    return res.json({ valid: false });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
