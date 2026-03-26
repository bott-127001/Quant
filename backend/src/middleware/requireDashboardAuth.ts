import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDashboardUserByUsername } from '../config/dashboardUsers';

const SESSION_COOKIE_NAME = 'dash_session';

function getJwtSecret(): string {
  const secret = process.env.DASH_JWT_SECRET;
  if (!secret) {
    throw new Error('DASH_JWT_SECRET is not set');
  }
  return secret;
}

export interface AuthedRequest extends Request {
  user?: { username: string };
}

export const requireDashboardAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const payload = jwt.verify(token, getJwtSecret()) as { sub: string };
    const user = getDashboardUserByUsername(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    req.user = { username: user.username };
    return next();
  } catch {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
};

