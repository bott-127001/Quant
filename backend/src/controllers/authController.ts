import { Request, Response } from 'express';
import AuthService from '../services/AuthService';

export const getLoginUrl = (req: Request, res: Response) => {
    try {
        const url = AuthService.getAuthUrl();
        res.status(200).json({ url });
    } catch (error: any) {
        res.status(500).send({ error: error.message });
    }
};

export const authCallback = async (req: Request, res: Response) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).send('No authorization code provided.');
        }

        console.log('Received auth code from Upstox. Exchanging for access token...');
        const authData = await AuthService.generateAccessToken(code as string);

        res.status(200).send({
            message: 'Authentication successful. Access token stored in database.',
            data: authData
        });
    } catch (error: any) {
        console.error('Error in authCallback:', error.message);
        res.status(500).send({
            error: 'Authentication failed',
            details: error.message
        });
    }
};

export const triggerDailyLogin = async (req: Request, res: Response) => {
    try {
        console.log('Manually triggering daily login...');
        await AuthService.performDailyLogin();
        res.status(200).send('Login process started in the background.');
    } catch (error: any) {
        res.status(500).send({
            error: 'Failed to start login',
            details: error.message
        });
    }
};
