import axios from 'axios';
import { chromium } from 'playwright';
import { generateSync } from 'otplib';
import Auth from '../models/Auth';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

class AuthService {
    private client_id: string = process.env.UPSTOX_API_KEY || '';
    private client_secret: string = process.env.UPSTOX_API_SECRET || '';
    private redirect_uri: string = process.env.UPSTOX_REDIRECT_URI || '';

    public getAuthUrl() {
        return `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${this.client_id}&redirect_uri=${encodeURIComponent(this.redirect_uri)}`;
    }

    public async performDailyLogin() {
        try {
            console.log('--- Starting Automated Login Flow (Phase 2 Automation) ---');

            const MOBILE_NO = process.env.UPSTOX_USER_ID; // Your registered mobile number
            const PIN = process.env.UPSTOX_PASSWORD;     // Your 6-digit PIN
            const TOTP_SECRET = process.env.UPSTOX_TOTP_SECRET;

            if (!MOBILE_NO || !PIN || !TOTP_SECRET) {
                console.error('Missing automation credentials in .env (UPSTOX_USER_ID, UPSTOX_PASSWORD, or UPSTOX_TOTP_SECRET).');
                return;
            }

            const isProd = process.env.NODE_ENV === 'production';
            const browser = await chromium.launch({ 
                headless: isProd,
                args: isProd ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : []
            });
            const page = await browser.newPage();

            console.log('Navigating to Upstox login...');
            await page.goto(this.getAuthUrl());

            // 1. Enter Mobile Number
            console.log('Entering Mobile Number...');
            await page.waitForSelector('#mobileNum');
            await page.fill('#mobileNum', MOBILE_NO);
            await page.click('#getOtp');

            // 2. Enter OTP (TOTP)
            console.log('Generating and Entering TOTP...');
            await page.waitForSelector('#otpNum'); // Standard selector for OTP field
            const token = generateSync({ secret: TOTP_SECRET });
            await page.fill('#otpNum', token);
            await page.click('#continueBtn');

            // 3. Enter PIN
            console.log('Entering PIN...');
            await page.waitForSelector('#pinCode'); // Standard selector for PIN field
            await page.fill('#pinCode', PIN);
            await page.click('#pinContinueBtn');

            console.log('Waiting for authentication redirect...');
            // The page will now redirect to our callback URL: /api/auth/callback
            await page.waitForURL('**/api/auth/callback*', { timeout: 60000 });
            console.log('Authentication flow completed successfully.');

            await browser.close();
        } catch (error) {
            console.error('Automation Login Failed:', error);
        }
    }

    public async generateAccessToken(code: string) {
        try {
            console.log(`Exchanging code for token with Upstox: ${code}`);

            const response = await axios.post('https://api.upstox.com/v2/login/authorization/token',
                new URLSearchParams({
                    code: code,
                    client_id: this.client_id,
                    client_secret: this.client_secret,
                    redirect_uri: this.redirect_uri,
                    grant_type: 'authorization_code'
                }),
                {
                    headers: {
                        'accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            const { access_token, refresh_token, expires_in, token_type } = response.data;

            // Updated record logic
            await Auth.findOneAndUpdate(
                {},
                {
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresIn: expires_in,
                    tokenType: token_type,
                    createdAt: new Date()
                },
                { upsert: true, returnDocument: 'after' }
            );

            console.log('Token successfully stored in MongoDB.');
            return response.data;

        } catch (error: any) {
            console.error('Code-to-Token exchange failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Automated Scheduler: Runs daily at 09:00 AM IST (P2)
     */
    public startAutomatedLoginScheduler() {
        console.log('--- Auth Scheduler Started (09:00 IST) ---');
        cron.schedule('0 9 * * 1-5', async () => {
            try {
                await this.performDailyLogin();
            } catch (err: any) {
                console.error('Automated Login Failed:', err.message);
            }
        }, {
            timezone: "Asia/Kolkata"
        });
    }
}

export default new AuthService();
