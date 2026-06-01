import os
import shutil
from pathlib import Path

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter
import fitz  # pymupdf
import docx

from app.config import UPLOAD_DIR, CHROMA_DIR, EMBEDDING_MODEL, CHUNK_SIZE, CHUNK_OVERLAP

# Load embedding model once at startup
embedder = SentenceTransformer(EMBEDDING_MODEL)

# Chroma client
chroma_client = chromadb.PersistentClient(
    path=CHROMA_DIR,
    settings=Settings(anonymized_telemetry=False)
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP
)


def extract_text(file_path: str, file_type: str) -> str:
    """Extract raw text from PDF, DOCX, TXT, or MD."""
    if file_type == "pdf":
        doc = fitz.open(file_path)
        return "\n".join(page.get_text() for page in doc)

    elif file_type == "docx":
        doc = docx.Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs)

    elif file_type in ("txt", "md"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    raise ValueError(f"Unsupported file type: {file_type}")


def ingest_document(document_id: int, stored_name: str, file_type: str) -> dict:
    """Extract, chunk, embed, and store document in Chroma."""
    file_path = os.path.join(UPLOAD_DIR, stored_name)

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    # Extract text
    raw_text = extract_text(file_path, file_type)
    if not raw_text.strip():
        raise ValueError("Document appears to be empty")

    # Chunk text
    chunks = text_splitter.split_text(raw_text)
    if not chunks:
        raise ValueError("No chunks generated")

    # Create or get Chroma collection per document
    collection_id = f"doc_{document_id}"
    collection = chroma_client.get_or_create_collection(
        name=collection_id,
        metadata={"document_id": str(document_id)}
    )

    # Embed and store
    embeddings = embedder.encode(chunks).tolist()
    ids = [f"{collection_id}_chunk_{i}" for i in range(len(chunks))]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=[{"chunk_index": i, "document_id": str(document_id)}
                   for i in range(len(chunks))]
    )

    return {
        "collection_id": collection_id,
        "chunk_count": len(chunks)
    }


def delete_document(document_id: int):
    """Remove document collection from Chroma."""
    collection_id = f"doc_{document_id}"
    try:
        chroma_client.delete_collection(collection_id)
    except Exception:
        pass


def retrieve_chunks(document_ids: list[int], query: str, top_k: int = 5) -> list[str]:
    """Retrieve top-k relevant chunks across multiple documents."""
    query_embedding = embedder.encode([query]).tolist()[0]
    all_chunks = []

    for doc_id in document_ids:
        collection_id = f"doc_{doc_id}"
        try:
            collection = chroma_client.get_collection(collection_id)
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, collection.count())
            )
            all_chunks.extend(results["documents"][0])
        except Exception:
            continue

    return all_chunks