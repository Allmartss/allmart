from .vector_store import FinancialRAG
from langchain.chains import RetrievalQA
from src.utils.keymodel import get_llm

rag = FinancialRAG()

def get_rag_chain():
    llm = get_llm(temperature=0.3)
    return RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=rag.as_retriever(),
        return_source_documents=True
    )
