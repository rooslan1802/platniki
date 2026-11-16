import { authHandler, rejectCrossOrigin } from './_security.js';

export default function handler(req, res) {
  if (req.method !== 'GET' && rejectCrossOrigin(req, res)) return;
  return authHandler(req, res);
}
