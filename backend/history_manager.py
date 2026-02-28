import httpx
import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
from database import store_historical_daily_data, get_historical_daily_data, prune_historical_data, get_user_tokens, get_latest_historical_date

# Upstox API endpoints
UPSTOX_BASE_URL_V2 = "https://api.upstox.com/v2"

# Nifty 50 Instrument Keys (Approximate, will be dynamically fetched or hardcoded for stability)
# In production, these should be fetched from Upstox instrument list
NIFTY_50_STOCKS = [
    "NSE_EQ|INE030A01027",  # ADANIPORTS
    "NSE_EQ|INE423A01024",  # ADANIENT
    "NSE_EQ|INE021A01026",  # ASIANPAINT
    "NSE_EQ|INE238A01034",  # AXISBANK
    "NSE_EQ|INE917I01010",  # BAJAJ-AUTO
    "NSE_EQ|INE193A01025",  # BAJFINANCE
    "NSE_EQ|INE918I01018",  # BAJAJFINSV
    "NSE_EQ|INE029A01011",  # BPCL
    "NSE_EQ|INE079A01024",  # BHARTIARTL
    "NSE_EQ|INE0P1L01018",  # BRITANNIA
    "NSE_EQ|INE059A01026",  # CIPLA
    "NSE_EQ|INE066A01021",  # COALINDIA
    "NSE_EQ|INE089A01023",  # DIVISLAB
    "NSE_EQ|INE047A01021",  # DRREDDY
    "NSE_EQ|INE062A01020",  # EICHERMOT
    "NSE_EQ|INE158A01026",  # GRASIM
    "NSE_EQ|INE001A01036",  # HCLTECH
    "NSE_EQ|INE040A01034",  # HDFCBANK
    "NSE_EQ|INE795G01014",  # HDFCLIFE
    "NSE_EQ|INE038A01020",  # HEROMOTOCO
    "NSE_EQ|INE034A01011",  # HINDALCO
    "NSE_EQ|INE026A01025",  # HINDUNILVR
    "NSE_EQ|INE090A01021",  # ICICIBANK
    "NSE_EQ|INE095A01012",  # INDUSINDBK
    "NSE_EQ|INE009A01021",  # INFY
    "NSE_EQ|INE154A01025",  # ITC
    "NSE_EQ|INE019A01038",  # JSWSTEEL
    "NSE_EQ|INE018A01030",  # KOTAKBANK
    "NSE_EQ|INE018B01017",  # LTIM
    "NSE_EQ|INE010B01027",  # LT
    "NSE_EQ|INE101A01026",  # M&M
    "NSE_EQ|INE585B01010",  # MARUTI
    "NSE_EQ|INE239A01016",  # NESTLEIND
    "NSE_EQ|INE733E01010",  # NTPC
    "NSE_EQ|INE213A01029",  # ONGC
    "NSE_EQ|INE044A01036",  # POWERGRID
    "NSE_EQ|INE002A01018",  # RELIANCE
    "NSE_EQ|INE123W01016",  # SBILIFE
    "NSE_EQ|INE062E01012",  # SBIN
    "NSE_EQ|INE070A01015",  # SUNPHARMA
    "NSE_EQ|INE192A01025",  # TATAMOTORS
    "NSE_EQ|INE081A01012",  # TATASTEEL
    "NSE_EQ|INE467B01029",  # TCS
    "NSE_EQ|INE669C01036",  # TECHM
    "NSE_EQ|INE280A01028",  # TITAN
    "NSE_EQ|INE481G01011",  # ULTRACEMCO
    "NSE_EQ|INE628A01036",  # UPL
    "NSE_EQ|INE075A01022",  # WIPRO
    "NSE_EQ|INE205A01025",  # VEDL
    "NSE_INDEX|Nifty 50",   # NIFTY 50 INDEX
]

async def sync_historical_data(username: str):
    """
    Synchronize 30 days of daily OHLC data for all Nifty 50 stocks.
    This should be called once a day at 9:00 AM or on startup.
    """
    tokens = await get_user_tokens(username)
    if not tokens:
        print(f"ERROR: No tokens found for user: {username}. Sync failed.")
        return False

    access_token = tokens.get("access_token")
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {access_token}"
    }

    # Calculate global date range (30+15 days buffer)
    to_date = datetime.now().strftime("%Y-%m-%d")
    global_from_date = (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d")

    async with httpx.AsyncClient(timeout=60.0) as client:
        for instrument_key in NIFTY_50_STOCKS:
            
            # Smart Incremental Check
            latest_db_date = await get_latest_historical_date(instrument_key)
            if latest_db_date:
                # Upstox returns inclusive data. Start from the last date we have.
                # If we run this multiple times a day, it will just overwrite today's candle.
                from_date = latest_db_date.strftime("%Y-%m-%d")
            else:
                from_date = global_from_date

            print(f"INFO: Syncing {instrument_key} from {from_date} to {to_date}...")
            try:
                # Use Upstox V3 Historical API
                # https://api.upstox.com/v3/historical-candle/{instrument_key}/day/{to_date}/{from_date}
                import urllib.parse
                encoded_key = urllib.parse.quote(instrument_key)
                url = f"{UPSTOX_BASE_URL_V2}/historical-candle/{encoded_key}/day/{to_date}/{from_date}"
                
                response = await client.get(url, headers=headers)
                if response.status_code != 200:
                    print(f"WARNING: Failed to fetch {instrument_key}: {response.status_code}")
                    continue
                
                data = response.json()
                candles = data.get("data", {}).get("candles", [])
                
                if not candles:
                    print(f"WARNING: No candles found for {instrument_key}")
                    continue
                
                # Upstox V3 candle format: [timestamp, open, high, low, close, volume, oi]
                # timestamp is in ISO 8601 format
                formatted_data = []
                for candle in candles:
                    ts_str = candle[0]
                    # Parse timestamp, handling cases where it might have timezone offset
                    try:
                        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                    except ValueError:
                        print(f"ERROR: Failed to parse timestamp: {ts_str}")
                        continue
                        
                    formatted_data.append({
                        "timestamp": ts,
                        "open": float(candle[1]),
                        "high": float(candle[2]),
                        "low": float(candle[3]),
                        "close": float(candle[4]),
                        "volume": int(candle[5])
                    })
                
                # Store in DB
                await store_historical_daily_data(instrument_key, formatted_data)
                
            except Exception as e:
                print(f"ERROR: Error syncing {instrument_key}: {e}")
            
            # Rate limiting buffer
            await asyncio.sleep(0.5)

    print("SUCCESS: Historical data sync complete.")
    await prune_historical_data()
    return True

async def get_stock_returns(symbol: str, days: int = 30) -> List[float]:
    """Calculate percentage returns for a stock."""
    data = await get_historical_daily_data(symbol, days + 1)
    if len(data) < 2:
        return []
    
    # Data is sorted by timestamp DESC
    returns = []
    for i in range(len(data) - 1):
        price_t = data[i]["close"]
        price_prev = data[i+1]["close"]
        ret = (price_t - price_prev) / price_prev
        returns.append(ret)
    
    return returns

async def calculate_average_adr(symbol: str, days: int = 5) -> float:
    """Calculate the Average Daily Range (High - Low) over N days."""
    data = await get_historical_daily_data(symbol, days)
    if not data or len(data) == 0:
        return 0.0
    
    total_range = 0.0
    for day in data:
        high = day.get("high", 0)
        low = day.get("low", 0)
        total_range += (high - low)
    
    return total_range / len(data)
