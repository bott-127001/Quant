import axios from 'axios';

const isProduction = import.meta.env.PROD;
const API_BASE_URL = isProduction ? '/api' : 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true,
});

export const dashboardService = {
    getLiveDashboard: async () => {
        const response = await api.get('/market-data/dashboard/live');
        return response.data;
    },
    getTradeLogs: async () => {
        const response = await api.get('/market-data/trade-logs');
        return response.data;
    },
    manualSync: async () => {
        const response = await api.get('/market-data/setup-symbols');
        return response.data;
    },
    syncData: async () => {
        const response = await api.get('/market-data/rolling-sync');
        return response.data;
    },
    calculateRanking: async () => {
        const response = await api.get('/market-data/calculate-ranking');
        return response.data;
    },
    getLiveLogs: async () => {
        const response = await axios.get(`${API_BASE_URL}/logs`, { withCredentials: true });
        return response.data;
    },
    manualLogin: async () => {
        const response = await api.get('/auth/login');
        return response.data;
    }
};

export const configService = {
    getConfig: async () => {
        const response = await api.get('/config');
        return response.data;
    },
    updateConfig: async (config: any) => {
        const response = await api.patch('/config', config);
        return response.data;
    },
    nukeAuth: async () => {
        const response = await api.post('/config/clear-tokens');
        return response.data;
    }
};

export const authService = {
    login: async (username: string, password: string) => {
        const response = await api.post('/auth/local-login', { username, password });
        return response.data as { username: string };
    },
    me: async () => {
        const response = await api.get('/auth/me');
        return response.data as { username: string };
    },
    logout: async () => {
        const response = await api.post('/auth/logout');
        return response.data as { success: boolean };
    },
};

export default api;
