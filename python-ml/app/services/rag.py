from groq import Groq
from app.config import GROQ_API_KEY, LLM_MODEL
from app.services.ingest import retrieve_chunks, chroma_client

client = Groq(api_key=GROQ_API_KEY)


def ask_question(question: str, document_ids: list[int]) -> dict:
    """RAG pipeline: retrieve relevant chunks then generate answer."""
    chunks = retrieve_chunks(document_ids, question, top_k=5)

    if not chunks:
        return {
            "answer": "No relevant content found in the selected documents.",
            "sources": []
        }

    context = "\n\n".join(chunks)

    prompt = f"""You are a helpful study assistant. Use the following context 
from the user's documents to answer the question accurately.
If the answer is not in the context, say so clearly.

Context:
{context}

Question: {question}

Answer:"""

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1024
    )

    return {
        "answer": response.choices[0].message.content,
        "sources": chunks[:3]
    }


def summarize_document(document_id: int, mode: str = "detailed") -> dict:
    """Summarize an entire document."""
    collection_id = f"doc_{document_id}"

    try:
        collection = chroma_client.get_collection(collection_id)
        results = collection.get()
        all_text = "\n\n".join(results["documents"])
    except Exception:
        return {"summary": "Document not found or not processed yet."}

    # Truncate if too long
    all_text = all_text[:6000]

    mode_instructions = {
        "brief": "Write a brief 3-5 sentence summary.",
        "detailed": "Write a detailed summary covering all key points.",
        "bullets": "Write a bullet-point summary of the key points."
    }

    instruction = mode_instructions.get(mode, mode_instructions["detailed"])

    prompt = f"""You are a study assistant. {instruction}

Document content:
{all_text}

Summary:"""

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1024
    )

    return {"summary": response.choices[0].message.content}


def generate_quiz(document_id: int, num_questions: int = 5,
                  difficulty: str = "medium") -> dict:
    """Generate MCQ quiz from document content."""
    collection_id = f"doc_{document_id}"

    try:
        collection = chroma_client.get_collection(collection_id)
        results = collection.get()
        all_text = "\n\n".join(results["documents"])
    except Exception:
        return {"questions": []}

    all_text = all_text[:6000]

    prompt = f"""You are a quiz generator. Generate {num_questions} multiple choice 
questions at {difficulty} difficulty from the content below.

Return ONLY valid JSON in this exact format:
{{
  "questions": [
    {{
      "question": "question text here",
      "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
      "correct_answer": "A",
      "explanation": "brief explanation"
    }}
  ]
}}

Content:
{all_text}"""

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        max_tokens=2048
    )

    import json
    try:
        text = response.choices[0].message.content
        # Strip markdown fences if present
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(text)
    except Exception:
        return {"questions": []}