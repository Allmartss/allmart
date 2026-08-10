from langchain_community.tools import Tool
from src.analysis.full_analyzer import FullAnalyzer
from src.ingestion.news_fetcher import NewsFetcher
from src.rag.vector_store import FinancialRAG

full_analyzer = FullAnalyzer()
rag = FinancialRAG()
fetcher = NewsFetcher()

tools = [
    Tool(
        name="full_market_analysis",
        func=full_analyzer.analyze,
        description="Run complete analysis: trendlines, sentiment, impact and forecast for any ticker."
    ),
    Tool(
        name="get_latest_news",
        func=lambda q="latest": "\n\n".join([f"📰 {a.get('title')}" for a in fetcher.run()[:5]]),
        description="Get the latest financial news."
    ),
    Tool(
        name="search_historical_context",
        func=rag.similarity_search,
        description="Search past news and analyses."
    ),
]