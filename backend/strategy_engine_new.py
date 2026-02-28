from datetime import datetime, time, timedelta
from typing import List, Dict, Optional, Tuple
from database import get_historical_daily_data, log_signal

# Strategy Execution thresholds will now be drawn dynamically from user settings
# Default parameters serve as fallback
DEFAULT_CONT_IRS_THRESHOLD = 0.0045      # 0.45%
DEFAULT_CONT_RELVOL_THRESHOLD = 1.3      # 1.3x
DEFAULT_CONT_GAP_ABS_MAX = 0.0080        # 0.80%
DEFAULT_INDEX_GAP_MAX = 0.0100           # 1.00%

DEFAULT_REV_GAP_MIN = 0.0050             # 0.50%
DEFAULT_REV_ADR_THRESHOLD = 80.0         # 80%
DEFAULT_REV_IRS_THRESHOLD = 0.0100       # 1.0%

ENTRY_TIME_CONTSNIPER = time(9, 20, 1)
REV_TRIGGER_TIME = time(11, 30, 0)
REV_BASELINE_TIME = time(11, 0, 0)
SQUARE_OFF_TIME = time(15, 15, 0)

# Tracker for current day's trades to enforce "One Trade Per Stock"
# In a real system, this should be in DB/Cache to survive restarts
_trades_today = {} # {symbol: trade_type} 

def calculate_irs(stock_ret: float, index_ret: float) -> float:
    """IRS = (Stock % Return) - (Nifty 50 % Return)"""
    return stock_ret - index_ret

def calculate_rel_vol(current_915_vol: int, avg_915_vol_5d: float) -> float:
    """RelVol = Volume of current 9:15 candle / Average Volume of 9:15 candle over last 5 days"""
    if avg_915_vol_5d == 0:
        return 0.0
    return current_915_vol / avg_915_vol_5d

def calculate_adr_coverage(day_range: float, avg_day_range_5d: float) -> float:
    """ADR Coverage = Current Day's Range (High - Low) / Average Daily Range (5-day points)"""
    if avg_day_range_5d == 0:
        return 0.0
    return day_range / avg_day_range_5d

def get_gap_pct(open_price: float, prev_close: float) -> float:
    """Gap % = (Open_today - Close_prev) / Close_prev"""
    if prev_close == 0:
        return 0.0
    return (open_price - prev_close) / prev_close

async def detect_elite_signals(
    current_time: datetime,
    elite_stocks_data: List[Dict], # List of snapshots for Elite 10
    index_data: Dict,              # Snapshot for Nifty 50 Index
    username: str,
    settings: Dict                 # User thresholds
) -> List[Dict]:
    """
    Main strategy execution engine called every 5 seconds.
    """
    now_time = current_time.time()
    signals = []
    
    # Extract Settings
    CONT_IRS = float(settings.get("irs_threshold", DEFAULT_CONT_IRS_THRESHOLD * 100)) / 100.0
    CONT_RELVOL = float(settings.get("relvol_threshold", DEFAULT_CONT_RELVOL_THRESHOLD))
    CONT_GAP_MAX = float(settings.get("gap_threshold", DEFAULT_CONT_GAP_ABS_MAX * 100)) / 100.0
    INDEX_GAP = float(settings.get("index_gravity_threshold", DEFAULT_INDEX_GAP_MAX * 100)) / 100.0
    REV_IRS = float(settings.get("reversal_irs_threshold", DEFAULT_REV_IRS_THRESHOLD * 100)) / 100.0
    REV_ADR = float(settings.get("adr_threshold", DEFAULT_REV_ADR_THRESHOLD))
    # Note: user might enter 0.5% as 0.5
    REV_GAP = DEFAULT_REV_GAP_MIN # not exposed in UI yet


    # SQUARE OFF RULE
    if now_time >= SQUARE_OFF_TIME:
        # TODO: Trigger square-off for all open positions
        return signals

    # Prepare Index Data
    idx_close_prev = index_data.get("prev_close", 0)
    idx_open = index_data.get("open", 0)
    idx_ltp = index_data.get("ltp", 0)
    idx_gap = get_gap_pct(idx_open, idx_close_prev)
    idx_ret = (idx_ltp - idx_close_prev) / idx_close_prev if idx_close_prev else 0

    # INDEX GRAVITY RULE
    if abs(idx_gap) > INDEX_GAP:
        # Skip all continuation trades
        is_index_heavy = True
    else:
        is_index_heavy = False

    for stock in elite_stocks_data:
        symbol = stock["symbol"]
        if symbol in _trades_today:
            continue

        ltp = stock["ltp"]
        open_price = stock["open"]
        prev_close = stock["prev_close"]
        high = stock.get("high", ltp)
        low = stock.get("low", ltp)
        vol_915 = stock.get("vol_915", 0)
        
        # Derived metrics
        stock_gap = get_gap_pct(open_price, prev_close)
        stock_ret = (ltp - prev_close) / prev_close if prev_close else 0
        irs = calculate_irs(stock_ret, idx_ret)
        
        # Step 2: 09:20 AM Continuation Sniper
        if time(9, 20, 0) <= now_time <= time(9, 21, 0) and not is_index_heavy:
            # Thresholds
            if (abs(irs) > CONT_IRS and 
                stock.get("rel_vol", 0) > CONT_RELVOL and 
                abs(stock_gap) < CONT_GAP_MAX):
                
                # Alignment Rule
                # Sign(Stock Gap) == Sign(IRS Direction)
                irs_dir = 1 if irs > 0 else -1
                gap_dir = 1 if stock_gap > 0 else -1
                
                # Index Guard: Sign(Index Gap) != -Sign(IRS Direction)
                idx_gap_dir = 1 if idx_gap > 0 else (-1 if idx_gap < 0 else 0)
                index_guard_pass = idx_gap_dir != -irs_dir
                
                if irs_dir == gap_dir and index_guard_pass:
                    # ENTRY TRIGGERED
                    direction = "LONG" if irs_dir > 0 else "SHORT"
                    sl = low if direction == "LONG" else high # 9:15 candle low/high
                    tp = ltp * (1.02 if direction == "LONG" else 0.98)
                    
                    signal = {
                        "symbol": symbol,
                        "type": "CONTINUATION",
                        "direction": direction,
                        "entry_price": ltp,
                        "sl": sl,
                        "tp": tp,
                        "irs": irs,
                        "rel_vol": stock.get("rel_vol")
                    }
                    signals.append(signal)
                    _trades_today[symbol] = "CONTINUATION"
                    await log_signal(username, f"CONT_{direction}", ltp, ltp, 0, 0, 0, 0, signal)

        # Step 3: 11:30 AM Reversal Income
        if time(11, 30, 0) <= now_time <= time(11, 31, 0):
            # Exhaustion Thresholds
            # ADR Coverage > 80%, IRS > 1.0%, Gap > 0.5%
            adr_coverage = calculate_adr_coverage(high - low, stock.get("avg_adr_5d", 0))
            
            if (abs(stock_gap) > REV_GAP and 
                adr_coverage * 100.0 > REV_ADR and 
                abs(irs) > REV_IRS):
                
                # Trigger: IRS Flattening |IRS_11:30| < |IRS_11:00|
                irs_1100 = stock.get("irs_1100", 0)
                if abs(irs) < abs(irs_1100):
                    direction = "SHORT" if irs > 0 else "LONG" # Reversal
                    sl = (high if direction == "SHORT" else low) * (1.003 if direction == "SHORT" else 0.997)
                    tp = ltp * (0.99 if direction == "SHORT" else 1.01)
                    
                    signal = {
                        "symbol": symbol,
                        "type": "REVERSAL",
                        "direction": direction,
                        "entry_price": ltp,
                        "sl": sl,
                        "tp": tp,
                        "irs": irs,
                        "adr_coverage": adr_coverage
                    }
                    signals.append(signal)
                    _trades_today[symbol] = "REVERSAL"
                    await log_signal(username, f"REV_{direction}", ltp, ltp, 0, 0, 0, 0, signal)

    return signals
