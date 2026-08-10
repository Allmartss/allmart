import pandas as pd
import yfinance as yf
import numpy as np
import plotly.graph_objects as go
from datetime import datetime
from pathlib import Path
from loguru import logger
from src.analysis.trendline_analyzer import TrendlineAnalyzer

def run_advanced_backtest(
    ticker: str = "SPX",
    period: str = "1y",
    risk_per_trade: float = 1.0,
    max_dd: float = 10.0,
    min_confidence: float = 0.65,
    initial_capital: float = 10000.0
):
    logger.info(f"Running optimized backtest on {ticker} | Risk:{risk_per_trade}% | MinConf:{min_confidence}")
    
    df = yfinance.download(ticker, period=period, interval="1h", progress=False)
    if df.empty:
        return {"error": "No data"}

    analyzer = TrendlineAnalyzer(length=14, mult=1.0)
    capital = initial_capital
    position = 0.0
    equity_curve = [capital]
    trades = []
    peak = capital

    for i in range(50, len(df)):  # enough data for indicators
        window = df.iloc[:i]
        result = analyzer.analyze(window.copy(), ticker)  # runs prediction

        price = df['close'].iloc[i]
        state = result.get("trend_state", "SIDEWAYS")
        conf = result.get("confidence", 0.4)
        atr = result.get("atr", price * 0.01)

        # Risk Management
        current_value = capital + position * price
        peak = max(peak, current_value)
        drawdown = (peak - current_value) / peak * 100
        if drawdown > max_dd:
            if position > 0:
                capital = position * price
                trades.append({"date": df.index[i], "action": "MAX_DD_STOP", "price": price, "pnl": capital - equity_curve[-1]})
                position = 0
            break

        risk_amount = capital * (risk_per_trade / 100)
        stop_dist = atr * 2
        qty = risk_amount / stop_dist if stop_dist > 0 else 0

        # Trading Logic
        if state == "BULLISH" and position <= 0 and conf >= min_confidence:
            position = min(qty, capital / price * 0.98)
            capital = 0
            trades.append({"date": df.index[i], "action": "BUY", "price": price, "qty": position})

        elif state == "BEARISH" and position > 0 and conf >= min_confidence:
            capital = position * price
            pnl = capital - (position * trades[-1]["price"] if trades else price)
            trades.append({"date": df.index[i], "action": "SELL", "price": price, "pnl": pnl})
            position = 0

        equity_curve.append(capital + position * price)

    final_value = equity_curve[-1]
    total_return = (final_value - initial_capital) / initial_capital * 100

    # Generate Chart
    fig = go.Figure()
    fig.add_trace(go.Scatter(y=equity_curve, mode='lines', name='Equity Curve', line=dict(color='lime')))
    fig.update_layout(title=f"Backtest {ticker} | Return {total_return:.2f}%", 
                      xaxis_title="Trading Bars", yaxis_title="Portfolio Value ($)", template="plotly_dark")

    # Export
    export_dir = Path("data/backtests")
    export_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    fig.write_image(export_dir / f"{ticker}_{timestamp}.png")
    pd.DataFrame({"equity": equity_curve}).to_csv(export_dir / f"{ticker}_{timestamp}.csv", index=False)

    logger.success(f"Backtest complete → Return: {total_return:.2f}% | Trades: {len(trades)} | Chart exported")
    
    return {
        "ticker": ticker,
        "period": period,
        "initial_capital": initial_capital,
        "final_value": round(final_value, 2),
        "total_return_pct": round(total_return, 2),
        "num_trades": len(trades),
        "win_rate": round(sum(1 for t in trades if t.get("pnl", 0) > 0) / max(len(trades), 1) * 100, 1),
        "equity_chart": fig,
        "export_path": str(export_dir / f"{ticker}_{timestamp}.png")
    }