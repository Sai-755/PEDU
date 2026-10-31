
import jwt from 'jsonwebtoken';

export function requireAdmin(req, res, next) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(503).json({
      message: 'Authentication is not configured.'
    });
  }

  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({
      message: 'Admin authentication required.'
    });
  }

  try {
    const payload = jwt.verify(match[1], secret, {
      algorithms: ['HS256'],
      issuer: 'pvgj-api',
      audience: 'pvgj-admin'
    });

    if (payload.role !== 'admin' || !payload.email) {
      return res.status(403).json({
        message: 'Administrator access required.'
      });
    }

    req.admin = {
      email: payload.email,
      role: payload.role
    };

    return next();
  } catch {
    return res.status(401).json({
      message: 'Your session is invalid or expired. Please sign in again.'
    });
  }
}
