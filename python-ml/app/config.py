from dotenv import load_dotenv
import os

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "../spring-api/uploads")
CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma_db")
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
LLM_MODEL = "llama-3.3-70b-versatile"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50