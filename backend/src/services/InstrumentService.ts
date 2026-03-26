import axios from 'axios';
import SymbolModel from '../models/Symbol';
import zlib from 'zlib';

// Updated Nifty 50 Stocks (Post-Tata demerger)
const NIFTY_50_STOCKS = [
    "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK",
    "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BPCL", "BHARTIARTL",
    "BRITANNIA", "CIPLA", "COALINDIA", "DIVISLAB", "DRREDDY",
    "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", "HDFCLIFE",
    "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "ITC",
    "INDUSINDBK", "INFY", "JSWSTEEL", "KOTAKBANK", "LTM", // WAS LTIM
    "LT", "M&M", "MARUTI", "NTPC", "NESTLEIND",
    "ONGC", "POWERGRID", "RELIANCE", "SBILIFE", "SBIN",
    "SUNPHARMA", "TCS", "TATACONSUM", "TMPV", "TATASTEEL", // WAS TATAMOTORS
    "TECHM", "TITAN", "UPL", "ULTRACEMCO", "WIPRO"
];

const INDEX_KEY = "NSE_INDEX|Nifty 50";

class InstrumentService {
    /**
     * One-time setup: Map symbols to keys from Upstox and save to DB
     */
    public async setupSymbolMaster() {
        try {
            console.log('--- [FINAL_ALPHA_FIX] One-time Symbol Master Setup ---');

            // 1. Clear existing symbols to ensure a clean slate for Compass
            await SymbolModel.deleteMany({});
            console.log('Cleared existing symbols from MongoDB.');

            console.log('Fetching Upstox instrument master (GZipped JSON)...');
            const url = 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';

            const response = await axios.get(url, { responseType: 'arraybuffer' });

            console.log('Decompressing data...');
            const decompressedData = zlib.gunzipSync(response.data);
            const data = JSON.parse(decompressedData.toString());

            if (Array.isArray(data)) {
                console.log(`Analyzing ${data.length} instruments...`);

                const symbolsToSave = [];

                // 2. Map Stocks
                for (const targetSymbol of NIFTY_50_STOCKS) {
                    const match = data.find((item: any) =>
                        item.trading_symbol === targetSymbol &&
                        (item.segment === 'NSE_EQ')
                    );

                    if (match) {
                        symbolsToSave.push({
                            symbol: targetSymbol,
                            instrument_key: match.instrument_key,
                            segment: 'NSE_EQ'
                        });
                    } else {
                        console.warn(`[ALPHA_FIX Warning] Key not found for stock: ${targetSymbol}`);
                    }
                }

                // 3. Add Index
                symbolsToSave.push({
                    symbol: 'NIFTY_50',
                    instrument_key: INDEX_KEY,
                    segment: 'NSE_INDEX'
                });

                console.log(`[ALPHA_FIX] Mapping successful for ${symbolsToSave.length} instruments.`);

                if (symbolsToSave.length > 0) {
                    // Use insertMany to populate the collection fully
                    await SymbolModel.insertMany(symbolsToSave);
                    console.log(`[ALPHA_FIX Success] ${symbolsToSave.length} instruments saved to MongoDB.`);
                }
            }
        } catch (error: any) {
            console.error('[ALPHA_FIX Error] Symbol setup failed:', error.message);
            throw error;
        }
    }

    public async getAllSymbols() {
        return await SymbolModel.find({});
    }

    public getNifty50Symbols() {
        return NIFTY_50_STOCKS;
    }

    public async getSymbolMap(): Promise<Map<string, string>> {
        const symbols = await this.getAllSymbols();
        const map = new Map();
        symbols.forEach(s => map.set(s.symbol, s.instrument_key));
        return map;
    }
}

export default new InstrumentService();
