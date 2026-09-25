import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { query } from '../db/client';
import { UserRecord } from '../types';
import { AuthenticatedRequest } from './middleware';

export const authRouter = Router();

const oauth2Client = new OAuth2Client(
  config.auth.googleClientId,
  config.auth.googleClientSecret,
  config.auth.googleRedirectUri
);

oauth2Client.transporter.defaults = {
  ...oauth2Client.transporter.defaults,
  headers: {
    ...(oauth2Client.transporter.defaults?.headers || {}),
    'Accept-Encoding': 'identity',
  },
  fetchImplementation: fetch,
};

authRouter.get('/google', (req: Request, res: Response) => {
  if (!config.auth.googleClientId || !config.auth.googleClientSecret) {
    return res.redirect(
      `${config.auth.frontendUrl}?error=missing_google_credentials`
    );
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
  });

  res.redirect(authUrl);
});

authRouter.get(['/google/callback', '/callback'], async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    return res.redirect(`${config.auth.frontendUrl}?error=missing_code`);
  }

  try {
    let tokens: any;
    try {
      const tokenRes = await oauth2Client.getToken(code);
      tokens = tokenRes.tokens;
    } catch (tokenErr: any) {
      const directRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept-Encoding': 'identity',
        },
        body: new URLSearchParams({
          code,
          client_id: config.auth.googleClientId,
          client_secret: config.auth.googleClientSecret,
          redirect_uri: config.auth.googleRedirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!directRes.ok) {
        throw tokenErr;
      }
      tokens = await directRes.json();
    }

    if (!tokens.id_token) {
      throw new Error('No ID token returned by Google');
    }

    let payload: any = null;
    try {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.auth.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      payload = jwt.decode(tokens.id_token);
    }

    if (!payload || !payload.email) {
      throw new Error('Could not retrieve user email from Google');
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || payload.given_name || email.split('@')[0];
    const avatarUrl = payload.picture || null;
    const userId = crypto.randomUUID();

    const upsertSql = `
      INSERT INTO users (id, email, name, avatar_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
      RETURNING *;
    `;

    const dbRes = await query<UserRecord>(upsertSql, [userId, email, name, avatarUrl]);
    const user = dbRes.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
      },
      config.auth.jwtSecret,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.redirect(`${config.auth.frontendUrl}/?token=${token}`);
  } catch (err: any) {
    console.error('Google OAuth callback error:', err?.message || err);
    res.redirect(`${config.auth.frontendUrl}?error=oauth_failed`);
  }
});

authRouter.get('/me', (req: AuthenticatedRequest, res: Response) => {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ user: null });
  }

  try {
    const user = jwt.verify(token, config.auth.jwtSecret) as UserRecord;
    res.json({ user });
  } catch {
    res.status(401).json({ user: null });
  }
});

authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true });
});

authRouter.post('/dev-login', async (req: Request, res: Response) => {
  const email = (req.body.email || 'demo@reachinbox.ai').toLowerCase();
  const name = req.body.name || 'ReachInbox Demo User';
  const avatarUrl = req.body.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=ReachInbox';
  const userId = crypto.randomUUID();

  const upsertSql = `
    INSERT INTO users (id, email, name, avatar_url)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
    RETURNING *;
  `;

  const dbRes = await query<UserRecord>(upsertSql, [userId, email, name, avatarUrl]);
  const user = dbRes.rows[0];

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    },
    config.auth.jwtSecret,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ user, token });
});
