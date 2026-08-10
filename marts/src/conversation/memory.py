from langchain.memory import ConversationBufferMemory

def get_memory():
    """Return shared conversation memory"""
    return ConversationBufferMemory(
        memory_key="chat_history",
        return_messages=True
    )