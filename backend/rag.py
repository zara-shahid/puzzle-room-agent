import os
import secrets
import math
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter

class SimpleEmbeddingFunction:
    """
    Term frequency vectorizer for fast local semantic retrieval without external network dependencies.
    """
    def __init__(self, vocab_size: int = 512):
        self.vocab_size = vocab_size

    def _hash_token(self, token: str) -> int:
        h = 0
        for char in token:
            h = (h * 31 + ord(char)) % self.vocab_size
        return h

    def __call__(self, texts: List[str]) -> List[List[float]]:
        embeddings = []
        for text in texts:
            vec = [0.0] * self.vocab_size
            tokens = [t.strip(",.()[]{}").lower() for t in text.split() if t.strip()]
            if not tokens:
                embeddings.append(vec)
                continue
            for token in tokens:
                idx = self._hash_token(token)
                vec[idx] += 1.0
            # L2 Normalize
            norm = math.sqrt(sum(v * v for v in vec))
            if norm > 0:
                vec = [v / norm for v in vec]
            embeddings.append(vec)
        return embeddings

class StudyMaterialRAG:
    def __init__(self, collection_name: str = "study_materials"):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=200,
            chunk_overlap=30,
            separators=["\n\n", "\n", ". "]
        )
        self.documents: List[Dict[str, Any]] = []
        self.embedding_fn = SimpleEmbeddingFunction()

    def ingest_material(self, text: str, topic: str) -> int:
        """
        Splits pasted study material text into chunks and indexes them with metadata.
        """
        chunks = self.text_splitter.split_text(text)
        ingested_count = 0
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
            doc_id = f"chunk_{secrets.token_hex(4)}"
            doc_obj = {
                "id": doc_id,
                "text": chunk.strip(),
                "metadata": {"topic": topic, "chunk_index": i},
                "embedding": self.embedding_fn([chunk])[0]
            }
            self.documents.append(doc_obj)
            ingested_count += 1
        return ingested_count

    def retrieve_relevant_chunks(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieves top_k most relevant text chunks based on vector cosine similarity and keyword overlap.
        """
        if not self.documents:
            return []

        query_tokens = set(t.strip(",.()[]{}").lower() for t in query.split() if len(t.strip()) > 3)
        query_emb = self.embedding_fn([query])[0]
        scored_docs = []

        for doc in self.documents:
            # Vector similarity
            dot = sum(a * b for a, b in zip(query_emb, doc["embedding"]))
            
            # Keyword overlap boost
            doc_tokens = set(t.strip(",.()[]{}").lower() for t in doc["text"].split())
            overlap = len(query_tokens.intersection(doc_tokens))
            score = dot + (overlap * 0.25)
            
            scored_docs.append((score, doc))

        # Sort descending by score
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [{"text": doc["text"], "score": round(score, 4), "metadata": doc["metadata"]} for score, doc in scored_docs[:top_k]]

    def clear(self):
        self.documents = []
