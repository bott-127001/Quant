import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validateDashboardUser, getDashboardUserByUsername } from '../config/dashboardUsers';

const SESSION_COOKIE_NAME = 'dash_session';

function getJwtSecret(): string {
  const secret = process.env.DASH_JWT_SECRET;
  if (!secret) {
    throw new Error('DASH_JWT_SECRET is not set');
  }
  return secret;
}

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    // 12 hours in ms
    maxAge: 12 * 60 * 60 * 1000,
  };
}

export const localLogin = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await validateDashboardUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      {
        sub: user.username,
      },
      getJwtSecret(),
      { expiresIn: '12h' },
    );

    res
      .cookie(SESSION_COOKIE_NAME, token, getCookieOptions())
      .status(200)
      .json({ username: user.username });
  } catch (err: any) {
    console.error('[localLogin] Error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
};

export const getSessionUser = (req: Request, res: Response) => {
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

    return res.status(200).json({ username: user.username });
  } catch (err: any) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
};

export const logout = (req: Request, res: Response) => {
  res
    .clearCookie(SESSION_COOKIE_NAME, {
      ...getCookieOptions(),
      maxAge: undefined,
    })
    .status(200)
    .json({ success: true });
};

