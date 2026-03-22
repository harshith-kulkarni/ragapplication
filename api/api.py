import os
from urllib.parse import urlparse
import nltk
import numpy as np
import requests
from bs4 import BeautifulSoup
import PyPDF2
from io import BytesIO
from nltk.tokenize import sent_tokenize
from fastembed import TextEmbedding
import psycopg2
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai

nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)

model = TextEmbedding("BAAI/bge-small-en-v1.5")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB connection — supports Railway DATABASE_URL or individual env vars
_db_url = os.environ.get("DATABASE_URL")
if _db_url:
    # Railway / Heroku style: postgresql://user:password@host:port/dbname
    _p = urlparse(_db_url)
    conn = psycopg2.connect(
        dbname=_p.path.lstrip("/"),
        user=_p.username,
        password=_p.password,
        host=_p.hostname,
        port=_p.port or 5432,
    )
else:
    conn = psycopg2.connect(
        dbname=os.environ.get("DB_NAME", "mydb"),
        user=os.environ.get("DB_USER", "user"),
        password=os.environ.get("DB_PASSWORD", "password"),
        host=os.environ.get("DB_HOST", "localhost"),
        port=os.environ.get("DB_PORT", "5432"),
    )

cursor = conn.cursor()

# Create table if not exists
cursor.execute("""
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    type VARCHAR(10),
    content TEXT,
    embeddings TEXT
)
""")
conn.commit()

# -------------------- SEMANTIC CHUNKING --------------------

def cosine_sim(a, b):
    a, b = np.array(a, dtype=np.float32), np.array(b, dtype=np.float32)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

def get_em(text):
    return np.array(list(model.embed([text]))[0], dtype=np.float32)

def em_list(text_list):
    return [np.array(e, dtype=np.float32) for e in model.embed(text_list)]

def get_sim(emb1, emb2):
    return round(cosine_sim(emb1, emb2), 4)

def semantic_chunk(text, threshold=0.75):
    sentences = sent_tokenize(text)
    if len(sentences) == 0:
        return []
    embeddings = em_list(sentences)
    chunks = []
    current_chunk = sentences[0]
    for i in range(len(sentences) - 1):
        sim = cosine_sim(embeddings[i], embeddings[i+1])
        if sim > threshold:
            current_chunk += " " + sentences[i+1]
        else:
            chunks.append(current_chunk)
            current_chunk = sentences[i+1]
    chunks.append(current_chunk)
    return chunks

# -------------------- RETRIEVAL --------------------

def find_ans(query_emb, text_list, embeddings_list, n):
    sim_list = [get_sim(query_emb, x) for x in embeddings_list]
    top_indices = np.argsort(sim_list)[-n:][::-1]
    ans_list = [text_list[i] for i in top_indices]
    return ans_list

# -------------------- WIKIPEDIA --------------------

def get_from_wiki(topic):
    import wikipedia
    try:
        page = wikipedia.page(topic, auto_suggest=True)
    except wikipedia.DisambiguationError as e:
        # Pick the first option from disambiguation
        page = wikipedia.page(e.options[0], auto_suggest=False)
    except wikipedia.PageError:
        raise ValueError(f"No Wikipedia page found for topic: '{topic}'")
    chunks = semantic_chunk(page.content)
    text_list = [c for c in chunks if len(c) > 30]
    return text_list

# -------------------- URL --------------------

def extract_paragraphs(url):
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    response = requests.get(url, headers=headers, timeout=15, verify=True)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    # Remove script/style noise
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    paragraphs = soup.find_all("p")
    text_list = []
    for p in paragraphs:
        text = p.get_text().strip()
        if text and len(text) > 30:
            chunks = semantic_chunk(text)
            text_list.extend(chunks)
    if not text_list:
        raise ValueError(f"No readable content found at URL: {url}")
    return text_list

# -------------------- PDF --------------------

def extract_text_from_pdf(pdf_file_object):
    text_list = []
    reader = PyPDF2.PdfReader(pdf_file_object)
    for page in reader.pages:
        text = page.extract_text()
        if text:
            chunks = semantic_chunk(text)
            text_list.extend(chunks)
    return text_list

# -------------------- LLM --------------------

def ans_from_llm(ans, query):
    api_key = os.environ.get("OPENROUTER_API_KEY", "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")
    client = openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": os.environ.get("FRONTEND_URL", "http://localhost:3001"),
            "X-Title": "RAG Application"
        }
    )
    context = "\n".join(ans)
    prompt = f"""
Context:
{context}

Query:
{query}

Answer using only the context above.
If not found, say: "Cannot answer from given context."
"""
    response = client.chat.completions.create(
        temperature=0.5,
        max_tokens=1024,
        model="openai/gpt-3.5-turbo",
        n=1,
        messages=[
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": prompt}
        ],
    )
    return response.choices[0].message.content.strip()

# Models
class TopicRequest(BaseModel):
    topic: str

class UrlRequest(BaseModel):
    url: str

class ChatRequest(BaseModel):
    query: str
    doc_id: int
    top_k: int = 5

# Endpoints
@app.post("/process_topic")
def process_topic(req: TopicRequest):
    try:
        text_list = get_from_wiki(req.topic)
        embeddings_list = em_list(text_list)
        content = json.dumps(text_list)
        embeddings = json.dumps([emb.tolist() for emb in embeddings_list])
        cursor.execute("INSERT INTO documents (type, content, embeddings) VALUES (%s, %s, %s) RETURNING id",
                       ("topic", content, embeddings))
        doc_id = cursor.fetchone()[0]
        conn.commit()
        return {"doc_id": doc_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process_url")
def process_url(req: UrlRequest):
    try:
        text_list = extract_paragraphs(req.url)
        embeddings_list = em_list(text_list)
        content = json.dumps(text_list)
        embeddings = json.dumps([emb.tolist() for emb in embeddings_list])
        cursor.execute("INSERT INTO documents (type, content, embeddings) VALUES (%s, %s, %s) RETURNING id",
                       ("url", content, embeddings))
        doc_id = cursor.fetchone()[0]
        conn.commit()
        return {"doc_id": doc_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process_pdf")
def process_pdf(file: UploadFile = File(...)):
    try:
        pdf_content = BytesIO(file.file.read())
        text_list = extract_text_from_pdf(pdf_content)
        embeddings_list = em_list(text_list)
        content = json.dumps(text_list)
        embeddings = json.dumps([emb.tolist() for emb in embeddings_list])
        cursor.execute("INSERT INTO documents (type, content, embeddings) VALUES (%s, %s, %s) RETURNING id",
                       ("pdf", content, embeddings))
        doc_id = cursor.fetchone()[0]
        conn.commit()
        return {"doc_id": doc_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        cursor.execute("SELECT content, embeddings FROM documents WHERE id = %s", (req.doc_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        text_list = json.loads(row[0])
        embeddings_list = [np.array(emb, dtype=np.float32) for emb in json.loads(row[1])]
        query_emb = model.encode(req.query)
        ans = find_ans(query_emb, text_list, embeddings_list, req.top_k)
        llm_ans = ans_from_llm(ans, req.query)
        return {"answer": llm_ans, "chunks": ans}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)