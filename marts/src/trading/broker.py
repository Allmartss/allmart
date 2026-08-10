import os
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest, GetOrdersRequest
from alpaca.trading.enums import OrderSide, OrderType, TimeInForce
from alpaca.data import StockHistoricalDataClient, TimeFrame
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

class AlpacaBroker:
    def __init__(self, paper: bool = True):
        self.paper = paper
        api_key = os.getenv("ALPACA_API_KEY")
        secret_key = os.getenv("ALPACA_SECRET_KEY")
        
        if not api_key or not secret_key:
            logger.warning("ALPACA_API_KEY or SECRET_KEY not set – using simulation fallback")
            self.client = None
            return
        
        base_url = "https://paper-api.alpaca.markets" if paper else "https://api.alpaca.markets"
        self.client = TradingClient(api_key, secret_key, paper=paper)
        self.data_client = StockHistoricalDataClient(api_key, secret_key)
        logger.success(f"✅ Connected to Alpaca {'Paper' if paper else 'LIVE'} Trading")

    def get_account(self):
        if not self.client:
            return {"cash": 10000.0, "portfolio_value": 10000.0}
        return self.client.get_account()

    def place_order(self, ticker: str, qty: float, side: str = "buy"):
        if not self.client:
            logger.info(f"[SIMULATION] Would place {side.upper()} order for {qty} {ticker}")
            return {"status": "simulated", "order_id": "fake-id"}
        
        order_data = MarketOrderRequest(
            symbol=ticker,
            qty=qty,
            side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
            type=OrderType.MARKET,
            time_in_force=TimeInForce.DAY
        )
        order = self.client.submit_order(order_data)
        logger.success(f"✅ {side.upper()} order placed for {qty} {ticker} | Order ID: {order.id}")
        return order

    def get_positions(self):
        if not self.client:
            return []
        return self.client.get_all_positions()