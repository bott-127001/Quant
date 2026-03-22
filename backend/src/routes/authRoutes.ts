import { Router } from 'express';
import { authCallback, triggerDailyLogin, getLoginUrl } from '../controllers/authController';
import { localLogin, getSessionUser, logout } from '../controllers/localAuthController';

const router = Router();

// Dashboard auth (local username/password)
router.post('/local-login', localLogin);
router.get('/me', getSessionUser);
router.post('/logout', logout);

// Upstox auth (existing)
router.get('/init-login', getLoginUrl);
router.get('/callback', authCallback);
router.get('/login', triggerDailyLogin);

export default router;
