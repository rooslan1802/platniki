import { authHandler, rejectCrossOrigin } from './_security.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET' && rejectCrossOrigin(req, res)) return;
  return authHandler(req, res);
}
