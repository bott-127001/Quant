import { Request, Response } from 'express';
import Config from '../models/Config';

export const getConfig = async (req: Request, res: Response) => {
    try {
        let config = await Config.findOne();
        if (!config) {
            config = await Config.create({});
        }
        res.json(config);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateConfig = async (req: Request, res: Response) => {
    try {
        let config = await Config.findOne();
        if (!config) {
            config = new Config(req.body);
        } else {
            Object.assign(config, req.body);
        }
        await config.save();
        res.json(config);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const clearTokens = async (req: Request, res: Response) => {
    try {
        const Auth = (await import('../models/Auth')).default;
        await Auth.deleteMany({});
        res.json({ message: 'Access tokens cleared. Manual login required.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
