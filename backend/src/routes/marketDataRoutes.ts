import { Router } from 'express';
import { triggerRollingSync, setupSymbols, triggerRanking, triggerHeartbeat, getDashboardData, getTradeLogs } from '../controllers/marketDataController';

const router = Router();

// Dashboard Unified Data
router.get('/dashboard/live', getDashboardData);
router.get('/trade-logs', getTradeLogs);

// Endpoint to map static symbols to keys (Run once)
router.get('/setup-symbols', setupSymbols);

// Optimized Rolling sync (Run at 4:00 PM - handles initial backfill automatically)
router.get('/rolling-sync', triggerRollingSync);

// The Ranking Engine (Run after sync to generate the Elite 10)
router.get('/calculate-ranking', triggerRanking);

// The Heartbeat Engine (Run every 5 mins via external pinger)
router.get('/heartbeat', triggerHeartbeat);

export default router;
