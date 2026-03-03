import asyncio
import schedule
import time
from datetime import datetime, timezone, timedelta
from history_manager import sync_historical_data
from elite_10_selector import select_elite_10

def get_ist_now():
    """Get current time in IST (UTC+5:30)."""
    return datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)

async def run_daily_selection(username: str):
    """
    1. Sync 30 days of historical data for all 50 stocks.
    2. Run the Elite 10 selector to rank and store for the day.
    """
    print(f"INFO: Starting daily Elite 10 selection at {get_ist_now()}")
    
    # Step 1: Sync History
    sync_success = await sync_historical_data(username)
    if not sync_success:
        print("ERROR: Historical sync failed. Selection might be inaccurate.")
    
    # Step 2: Select Elite 10
    elite_symbols = await select_elite_10()
    if elite_symbols:
        print(f"SUCCESS: Daily Elite 10 updated: {len(elite_symbols)} stocks.")
    else:
        print("ERROR: Daily Elite 10 selection failed.")

def schedule_jobs(username: str):
    """Setup the 09:00 AM IST schedule."""
    # Note: Schedule library works with wall-clock time
    # In a production environment, ensure server time is IST or handle offsets
    schedule.every().day.at("22:10:35").do(
        lambda: asyncio.run_coroutine_threadsafe(run_daily_selection(username), asyncio.get_event_loop())
    )
    
    # Also schedule a weekend sync to keep data fresh
    schedule.every().sunday.at("10:00").do(
        lambda: asyncio.run_coroutine_threadsafe(sync_historical_data(username), asyncio.get_event_loop())
    )
    
    # Step 5: Post-Market: Update database with today's data (Runs at 4:30 PM IST)
    schedule.every().day.at("16:30").do(
        lambda: asyncio.run_coroutine_threadsafe(sync_historical_data(username), asyncio.get_event_loop())
    )

async def start_scheduler(username: str):
    """Main loop for the scheduler."""
    schedule_jobs(username)
    print("INFO: Elite 10 Scheduler started. Monitoring for 09:00 AM trigger...")
    
    while True:
        schedule.run_pending()
        await asyncio.sleep(60) # Check every minute

if __name__ == "__main__":
    # For standalone testing
    asyncio.run(run_daily_selection("samarth"))
