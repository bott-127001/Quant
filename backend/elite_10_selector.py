import numpy as np
from typing import List, Dict, Tuple
from history_manager import get_stock_returns, NIFTY_50_STOCKS
from database import store_elite_10, get_historical_daily_data
from datetime import datetime

INDEX_KEY = "NSE_INDEX|Nifty 50"

def calculate_pearson_correlation(stock_rets: List[float], index_rets: List[float]) -> float:
    """Calculate Pearson correlation coefficient (r)."""
    if len(stock_rets) != len(index_rets) or len(stock_rets) < 2:
        return 1.0 # Default to high correlation (bad) if data is missing
    
    correlation_matrix = np.corrcoef(stock_rets, index_rets)
    return correlation_matrix[0, 1]

def calculate_beta(stock_rets: List[float], index_rets: List[float]) -> float:
    """
    Calculate Beta (Beta): Cov(Stock, Index) / Var(Index)
    """
    if len(stock_rets) != len(index_rets) or len(stock_rets) < 2:
        return 0.0 # Default to no beta if data is missing
    
    covariance = np.cov(stock_rets, index_rets)[0, 1]
    variance = np.var(index_rets)
    
    if variance == 0:
        return 0.0
    
    return covariance / variance

async def select_elite_10():
    """
    Perform the daily Elite 10 selection:
    1. Rank by Beta (highest to lowest)
    2. Rank by Correlation (lowest to highest)
    3. Combined Rank -> Elite 10
    """
    index_returns = await get_stock_returns(INDEX_KEY, days=30)
    if not index_returns:
        print("ERROR: Failed to fetch index returns. Elite 10 selection aborted.")
        return []

    stock_metrics = []
    
    for symbol in NIFTY_50_STOCKS:
        if symbol == INDEX_KEY:
            continue
            
        stock_returns = await get_stock_returns(symbol, days=30)
        
        # Ensure we have aligned data
        # In case of data gaps, we trim to the smaller length
        min_len = min(len(stock_returns), len(index_returns))
        if min_len < 10: # Minimum data threshold
            print(f"WARNING: Insufficient data for {symbol}. Skipping.")
            continue
            
        s_rets = stock_returns[:min_len]
        i_rets = index_returns[:min_len]
        
        corr = calculate_pearson_correlation(s_rets, i_rets)
        beta = calculate_beta(s_rets, i_rets)
        
        stock_metrics.append({
            "symbol": symbol,
            "correlation": corr,
            "beta": beta
        })

    if not stock_metrics:
        return []

    # Ranking logic
    # Rank 1 = Best (Highest beta, lowest correlation)
    
    # Sort by beta descending
    stock_metrics.sort(key=lambda x: x["beta"], reverse=True)
    for i, stock in enumerate(stock_metrics):
        stock["beta_rank"] = i + 1
        
    # Sort by correlation ascending
    stock_metrics.sort(key=lambda x: x["correlation"])
    for i, stock in enumerate(stock_metrics):
        stock["corr_rank"] = i + 1
        
    # Calculate combined rank
    for stock in stock_metrics:
        stock["combined_rank"] = stock["beta_rank"] + stock["corr_rank"]
        
    # Final Elite 10 (lowest combined rank is best)
    stock_metrics.sort(key=lambda x: x["combined_rank"])
    elite_10 = stock_metrics[:10]
    
    elite_symbols = [s["symbol"] for s in elite_10]
    
    # Store in DB
    date_str = datetime.now().strftime("%Y-%m-%d")
    await store_elite_10(date_str, elite_symbols, {"metrics": elite_10})
    
    print(f"SUCCESS: Elite 10 Selected for {date_str}: {', '.join(elite_symbols)}")
    return elite_symbols
