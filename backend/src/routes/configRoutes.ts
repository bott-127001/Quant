import express from 'express';
import { getConfig, updateConfig, clearTokens } from '../controllers/configController';

const router = express.Router();

router.get('/', getConfig);
router.patch('/', updateConfig);
router.post('/clear-tokens', clearTokens);

export default router;
