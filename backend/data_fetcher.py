import httpx
import asyncio
from typing import Optional, Dict, List
from datetime import datetime, timedelta, timezone, date
from database import get_user_settings, get_user_tokens, log_signal, db, update_user_settings, get_elite_10
from auth import refresh_access_token
from strategy_engine_new import detect_elite_signals
from history_manager import calculate_average_adr
import json
import urllib.parse
import time

# Global state
latest_data: Optional[Dict] = None
# Index related state
index_data: Dict = {}
# Cache for volume (9:15 AM candle 5-day average)
_vol_cache: Dict[str, float] = {}
# Baseline IRS at 11:00 AM
_irs_1100_baseline: Dict[str, float] = {}
polling_active = False
should_poll = False
_polling_task: Optional[asyncio.Task] = None
_data_sequence = 0
_last_successful_poll: Optional[datetime] = None

# Cache for ADR
_adr_cache: Dict[str, float] = {}
_adr_cache_date: Optional[str] = None

# UPSTOX_INDEX_KEY = "NSE_INDEX|Nifty 50"
INDEX_KEY = "NSE_INDEX|Nifty 50"

# Upstox API endpoints
UPSTOX_BASE_URL = "https://api.upstox.com/v2"
UPSTOX_BASE_URL_V3 = "https://api.upstox.com/v3"

from ws_manager import manager
from history_manager import calculate_average_adr, calculate_average_volume_915

def get_last_trading_day(current_dt_ist: datetime) -> str:
    """Get the last trading day in YYYY-MM-DD (IST), skipping weekends."""
    d: date = current_dt_ist.date()
    d = d - timedelta(days=1)
    while d.weekday() >= 5:
        d = d - timedelta(days=1)
    return d.strftime("%Y-%m-%d")

async def fetch_previous_day_ohlc(username: str, instrument_key: str, target_date: str) -> Optional[Dict]:
    """Fetch previous day's OHLC data using Upstox V3."""
    tokens = await get_user_tokens(username)
    if not tokens or not tokens.get("access_token"):
        return None

    headers = {
        "Authorization": f"Bearer {tokens['access_token']}",
        "Accept": "application/json",
    }

    instrument_key_encoded = urllib.parse.quote(instrument_key)
    url = f"{UPSTOX_BASE_URL_V3}/historical-candle/{instrument_key_encoded}/days/1/{target_date}/{target_date}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
        if response.status_code != 200:
            return None
        data = response.json()
        candles = data.get("data", {}).get("candles", [])
        if not candles:
            return None
        candle = candles[0]
        _, o, h, l, c = candle[:5]
        return {
            "high": float(h),
            "low": float(l),
            "close": float(c),
            "range": round(float(h) - float(l), 2),
            "date": target_date,
        }
    except:
        return None

async def fetch_current_volume_915(username: str, symbol: str) -> float:
    """Fetch the volume of the 9:15 candle for the current day."""
    tokens = await get_user_tokens(username)
    if not tokens or not tokens.get("access_token"):
        return 0.0

    headers = {
        "Authorization": f"Bearer {tokens['access_token']}",
        "Accept": "application/json",
    }
    encoded_key = urllib.parse.quote(symbol)
    url = f"https://api.upstox.com/v2/historical-candle/intraday/{encoded_key}/1minute"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
        if response.status_code != 200:
            return 0.0
        
        data = response.json()
        candles = data.get("data", {}).get("candles", [])
        for candle in candles:
            if "T09:15:00" in candle[0]:
                return float(candle[5])
        return 0.0
    except:
        return 0.0

def get_market_open_time(current_time: datetime) -> datetime:
    """Get market open time for the current day (09:15 IST), returned as UTC."""
    if current_time.tzinfo is None:
        current_time_utc = current_time.replace(tzinfo=timezone.utc)
    else:
        current_time_utc = current_time.astimezone(timezone.utc)
    ist = timezone(timedelta(hours=5, minutes=30))
    now_ist = current_time_utc.astimezone(ist)
    market_open_ist = now_ist.replace(hour=9, minute=15, second=0, microsecond=0)
    return market_open_ist.astimezone(timezone.utc)

async def polling_worker():
    """Main background loop focusing strictly on Elite 10 Equities OHLCV."""
    global latest_data, polling_active, should_poll, _data_sequence, _last_successful_poll
    global _adr_cache, _adr_cache_date
    
    polling_active = True
    current_user = None
    
    print("Core Polling Worker: Elite 10 Equity Mode Active.")
    
    while polling_active:
        poll_start_time = datetime.now(timezone.utc)
        now_utc = datetime.now(timezone.utc)
        now_ist = now_utc + timedelta(hours=5, minutes=30)
        today_str = now_ist.strftime("%Y-%m-%d")
        
        # Market Hours Check
        current_time_val = now_ist.time()
        market_start = datetime.strptime("09:15", "%H:%M").time()
        market_end = datetime.strptime("15:30", "%H:%M").time()

        # Market Hours Check (Bypassed for testing)
        if False: # not (market_start <= current_time_val <= market_end) or now_ist.weekday() >= 5:
            if current_user:
                elite_symbols = await get_elite_10(today_str)
                latest_data = {
                    "timestamp": now_utc.isoformat(),
                    "elite_signals": [],
                    "elite_10": elite_symbols or [],
                    "message": "Market Closed/Holiday. Polling suspended."
                }
                if manager:
                    await manager.broadcast(latest_data)
            await asyncio.sleep(60)
            continue
        
        # Auth Check
        found_user = None
        for user in ["samarth", "prajwal"]:
            tokens = await get_user_tokens(user)
            if tokens and tokens.get("access_token") and tokens.get("token_expires_at", 0) > time.time():
                # Verify token is from today
                updated_at = tokens.get("updated_at")
                try:
                    if isinstance(updated_at, datetime):
                        t_date = updated_at.astimezone(timezone(timedelta(hours=5, minutes=30))).strftime("%Y-%m-%d")
                    else:
                        t_date = datetime.fromisoformat(str(updated_at).replace('Z', '+00:00')).astimezone(timezone(timedelta(hours=5, minutes=30))).strftime("%Y-%m-%d")
                    if t_date == today_str:
                        found_user = user
                        break
                except: continue
        
        if not found_user:
            if current_user:
                print("Polling: No valid session for today. Waiting.")
                current_user = None
            await asyncio.sleep(5)
            continue
        
        should_poll = True
        if found_user != current_user:
            current_user = found_user
            print(f"Polling: Active User -> {current_user}")

        try:
            settings = await get_user_settings(current_user) or {}
            elite_symbols = await get_elite_10(today_str)
            
            elite_stocks_data = []
            idx_snapshot = {}

            if elite_symbols:
                # 1. Fetch Nifty 50 and Elite 10 in one call
                all_keys = [INDEX_KEY] + elite_symbols
                keys_str = ",".join(all_keys)
                url = f"{UPSTOX_BASE_URL}/market-quote/quotes?instrument_key={keys_str}"
                headers = {"Accept": "application/json", "Authorization": f"Bearer {tokens['access_token']}"}
                
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(url, headers=headers)
                
                if resp.status_code == 200:
                    resp_data = resp.json().get("data", {})
                    
                    # Process Index first
                    raw_idx = resp_data.get(INDEX_KEY, {})
                    idx_ohlc = raw_idx.get("ohlc", {})
                    idx_snapshot = {
                        "ltp": raw_idx.get("last_price", 0),
                        "open": idx_ohlc.get("open", 0),
                        "prev_close": idx_ohlc.get("close", 0)
                    }

                    # Process Stocks
                    for sym in elite_symbols:
                        sym_data = resp_data.get(sym, {})
                        if not sym_data: continue
                        
                        actual_key = sym_data.get("instrument_token") or sym
                        
                        # Cache management for ADR and Volume
                        if _adr_cache_date != today_str:
                            _adr_cache.clear()
                            _vol_cache.clear()
                            _adr_cache_date = today_str
                            
                        if actual_key not in _adr_cache:
                            _adr_cache[actual_key] = await calculate_average_adr(actual_key, 5)
                            _vol_cache[actual_key] = await calculate_average_volume_915(current_user, actual_key, 5)
                        
                        ohlc = sym_data.get("ohlc", {})
                        ltp = sym_data.get("last_price", ohlc.get("close", 0))
                        
                        # RelVol calculation
                        rel_vol = 1.0
                        avg_915_vol = _vol_cache.get(actual_key, 0)
                        
                        if avg_915_vol > 0 and now_ist.time() >= time(9, 16, 0):
                            # Try to fetch today's 9:15 candle volume
                            today_915_vol = await fetch_current_volume_915(current_user, actual_key)
                            if today_915_vol > 0:
                                rel_vol = today_915_vol / avg_915_vol
                        
                        stock_item = {
                            "symbol": actual_key,
                            "ltp": ltp,
                            "open": ohlc.get("open", 0),
                            "high": ohlc.get("high", 0),
                            "low": ohlc.get("low", 0),
                            "prev_close": ohlc.get("close", 0),
                            "avg_adr_5d": _adr_cache[actual_key] or 10.0,
                            "rel_vol": round(rel_vol, 2)
                        }
                        
                        # 11:00 AM Baseline Capture
                        if time(11, 0, 0) <= now_ist.time() <= time(11, 1, 0):
                            s_ret = (ltp - stock_item["prev_close"]) / stock_item["prev_close"] if stock_item["prev_close"] else 0
                            i_ret = (idx_snapshot["ltp"] - idx_snapshot["prev_close"]) / idx_snapshot["prev_close"] if idx_snapshot["prev_close"] else 0
                            _irs_1100_baseline[actual_key] = s_ret - i_ret
                        
                        stock_item["irs_1100"] = _irs_1100_baseline.get(actual_key, 0)
                        elite_stocks_data.append(stock_item)

            # Detect Signals for Elite 1 stock sequence
            elite_signals = await detect_elite_signals(
                current_time=now_ist,
                elite_stocks_data=elite_stocks_data,
                index_data=idx_snapshot, 
                username=current_user,
                settings=settings
            )

            _data_sequence += 1
            _last_successful_poll = now_utc

            latest_data = {
                "_sequence": _data_sequence,
                "_poll_timestamp": _last_successful_poll.isoformat(),
                "timestamp": now_utc.isoformat(),
                "elite_signals": elite_signals,
                "elite_10": elite_symbols or [],
                "nifty_50": idx_snapshot,
                "message": f"Broadcasting Elite 10: {len(elite_symbols)} stocks."
            }
            
            if manager:
                await manager.broadcast(latest_data)
                if _data_sequence % 10 == 0:
                    await manager.cleanup_stale_connections(max_age_seconds=600)
                from database import log_market_data
                await log_market_data(latest_data)

        except Exception as e:
            print(f"Worker Error: {e}")

        elapsed = (datetime.now(timezone.utc) - poll_start_time).total_seconds()
        await asyncio.sleep(max(0, 5.0 - elapsed))

def start_polling():
    global _polling_task
    if _polling_task is not None and not _polling_task.done():
        return
    _polling_task = asyncio.create_task(polling_worker())

async def stop_polling():
    global _polling_task, polling_active, should_poll
    polling_active = False
    should_poll = False
    if _polling_task:
        _polling_task.cancel()
        _polling_task = None

def enable_polling():
    global should_poll
    should_poll = True
    start_polling()

def disable_polling():
    global should_poll
    should_poll = False

def get_latest_data():
    return latest_data

async def get_current_authenticated_user():
    now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    t_str = now_ist.strftime("%Y-%m-%d")
    import time
    for u in ["samarth", "prajwal"]:
        tks = await get_user_tokens(u)
        if tks and tks.get("access_token") and tks.get("token_expires_at", 0) > time.time():
            updated = tks.get("updated_at")
            try:
                if isinstance(updated, datetime):
                    u_date = updated.astimezone(timezone(timedelta(hours=5, minutes=30))).strftime("%Y-%m-%d")
                else:
                    u_date = datetime.fromisoformat(str(updated).replace('Z', '+00:00')).astimezone(timezone(timedelta(hours=5, minutes=30))).strftime("%Y-%m-%d")
                if u_date == t_str: return u
            except: continue
    return None
