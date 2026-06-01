from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import uvicorn

from app.services.ingest import ingest_document, delete_document
from app.services.rag import ask_question, summarize_document, generate_quiz

app = FastAPI(title="SmartLearn ML Service", version="1.0.0")


# ---------- Request models ----------

class IngestRequest(BaseModel):
    document_id: int
    stored_name: str
    file_type: str
    upload_dir: str

class AskRequest(BaseModel):
    question: str
    document_ids: List[int]
    user_email: str

class SummarizeRequest(BaseModel):
    document_id: int
    mode: str = "detailed"

class QuizRequest(BaseModel):
    document_id: int
    num_questions: int = 5
    difficulty: str = "medium"


# ---------- Routes ----------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
def ingest(req: IngestRequest):
    try:
        result = ingest_document(
            document_id=req.document_id,
            stored_name=req.stored_name,
            file_type=req.file_type
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/ingest/{document_id}")
def delete(document_id: int):
    delete_document(document_id)
    return {"deleted": True}


@app.post("/rag/ask")
def ask(req: AskRequest):
    try:
        return ask_question(req.question, req.document_ids)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/summarize")
def summarize(req: SummarizeRequest):
    try:
        return summarize_document(req.document_id, req.mode)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/quiz")
def quiz(req: QuizRequest):
    try:
        return generate_quiz(
            req.document_id,
            req.num_questions,
            req.difficulty
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)