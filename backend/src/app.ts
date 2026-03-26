import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db';

import authRoutes from './routes/authRoutes';
import marketDataRoutes from './routes/marketDataRoutes';
import configRoutes from './routes/configRoutes';
import IntradayService from './services/IntradayService';
import { requireDashboardAuth } from './middleware/requireDashboardAuth';

import RankingService from './services/RankingService';
import AuthService from './services/AuthService';
import MarketDataService from './services/MarketDataService';

import LogService from './services/LogService';

dotenv.config();

// Global Intercept console.log to buffer for frontend display
const originalLog = console.log;
console.log = (...args) => {
    LogService.log(args.map(String).join(' '));
    originalLog(...args);
};
const originalError = console.error;
console.error = (...args) => {
    LogService.log(`❌ ERROR: ${args.map(String).join(' ')}`);
    originalError(...args);
};

// Connect to Database
connectDB().then(() => {
    console.log('--- Database Connected: Initializing Workstation Schedulers ---');

    // Start automated processes
    AuthService.startAutomatedLoginScheduler();      // 09:00 AM IST (P2)
    RankingService.startAutomatedRanking();         // 08:45 AM IST (P4)
    MarketDataService.startRollingSyncScheduler();  // 04:00 PM IST (P3)
    IntradayService.startMarketHeartbeat();         // 09:15 AM - 03:30 PM IST (P5-8)

    console.log('Backend Services Initialized.');
});

const app = express();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

// Middlewares
app.use(cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// New: Live Log Sharing Endpoint
app.get('/api/logs', (req, res) => {
    res.json({ logs: LogService.getLogs() });
});

// Health Check for external pingers (keeps server awake)
app.get('/api/health', (req, res) => {
    res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/market-data', requireDashboardAuth, marketDataRoutes);
app.use('/api/config', requireDashboardAuth, configRoutes);

// Production detection (case-insensitive and trim whitespace)
const isProduction = process.env.NODE_ENV?.trim().toLowerCase() === 'production';

// Combined Routing Logic
if (isProduction) {
    console.log('--- Production Mode Detected: Serving Frontend ---');
    const frontendDist = path.resolve(process.cwd(), 'frontend/dist');

    // Serve static files from the frontend dist folder
    app.use(express.static(frontendDist));

    // For any request that doesn't match API, serve index.html (Express 5 catch-all syntax)
    app.get('/*splat', (req, res) => {
        const indexPath = path.join(frontendDist, 'index.html');
        res.sendFile(indexPath);
    });
} else {
    console.log(`--- Development Mode (${process.env.NODE_ENV}): API Only ---`);
    app.get('/', (req, res) => {
        res.send('Elite 10 Quant System Backend API is running...');
    });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
