# Running the Elite 10 Quant System

Follow these steps to start the trading system.

## 1. Prerequisites
- Python 3.8+
- Node.js & npm
- MongoDB (running and accessible)
- `.env` file in `backend/` with Upstox credentials

## 2. Backend Setup
Install Python dependencies and start the server:
```bash
cd backend
pip install -r requirements.txt
python main.py
```
The backend will run on `http://localhost:8000`.

## 3. Frontend Setup
Install Node dependencies and start the React app:
```bash
cd frontend
npm install
npm run dev
```
The frontend will typically run on `http://localhost:3000` or `http://localhost:5173`.

## 4. Initial Run Steps
1. Open your browser to the frontend URL.
2. Log in with your application credentials.
3. On the **Dashboard**, click the **🔑 Login Upstox** button.
4. Complete the Upstox authentication to start data polling.
5. The system will start calculating the Elite 10 stocks and monitoring signals.

> **Note**: Elite 10 selection occurs automatically at **09:00 AM IST** daily. If running after 09:00 AM, the selection will trigger upon the first data fetch.
