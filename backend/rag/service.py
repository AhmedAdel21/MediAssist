import random
import uuid
from typing import Any

import chromadb
from anthropic import AsyncAnthropic

from config import settings
from logging_config import get_logger

logger = get_logger(__name__)


class RAGService:
    CHUNK_SIZE = 500
    CHUNK_OVERLAP = 50
    MIN_CHUNK_LENGTH = 20
    COLLECTION_NAME = "medical_documents"
    EMBEDDING_DIMENSIONS = 384

    def __init__(self) -> None:
        self.client = chromadb.PersistentClient(path=settings.chroma_persist_directory)
        self.collection = self.client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        self.anthropic = AsyncAnthropic(api_key=settings.anthropic_api_key) if settings.anthropic_api_key else None

    def _chunk_text(self, text: str) -> list[str]:
        chunks: list[str] = []
        start = 0
        while start < len(text):
            end = start + self.CHUNK_SIZE
            if end >= len(text):
                chunk = text[start:]
            else:
                # Try to split at sentence boundary within the last 100 chars of the window
                search_start = max(start, end - 100)
                best_split = -1
                for sep in (". ", "! ", "? "):
                    idx = text.rfind(sep, search_start, end)
                    if idx > best_split:
                        best_split = idx + len(sep)
                if best_split > start:
                    chunk = text[start:best_split]
                    end = best_split
                else:
                    chunk = text[start:end]

            chunk = chunk.strip()
            if len(chunk) >= self.MIN_CHUNK_LENGTH:
                chunks.append(chunk)

            start = end - self.CHUNK_OVERLAP
            if start <= 0 and end >= len(text):
                break
        return chunks

    async def _get_embedding(self, text: str) -> list[float]:
        if not settings.anthropic_api_key or settings.anthropic_api_key.startswith("sk-ant-test"):
            logger.debug("Using pseudo-embeddings (no real API key)")
            import hashlib
            seed = int(hashlib.md5(text.encode()).hexdigest(), 16) % (2**32)
            rng = random.Random(seed)
            return [rng.gauss(0, 1) for _ in range(self.EMBEDDING_DIMENSIONS)]

        try:
            response = await self.anthropic.embeddings.create(
                model="voyage-medical-2",
                input=text,
            )
            return response.embeddings[0].embedding
        except Exception as exc:
            logger.error("Embedding API error: text_preview=%.50r error=%s", text, exc, exc_info=True)
            raise

    async def index_document(self, filename: str, content: str, uploader_id: str) -> dict[str, Any]:
        doc_id = str(uuid.uuid4())
        chunks = self._chunk_text(content)

        embeddings = []
        for chunk in chunks:
            embedding = await self._get_embedding(chunk)
            embeddings.append(embedding)

        ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
        metadatas = [
            {"filename": filename, "doc_id": doc_id, "chunk_index": i, "uploader_id": uploader_id}
            for i in range(len(chunks))
        ]

        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
        )

        return {"doc_id": doc_id, "filename": filename, "chunks_created": len(chunks)}

    async def query(self, question: str, n_results: int = 5) -> list[dict[str, Any]]:
        embedding = await self._get_embedding(question)
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=min(n_results, self.collection.count() or 1),
            include=["documents", "metadatas", "distances"],
        )

        chunks = []
        if results["documents"] and results["documents"][0]:
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                chunks.append(
                    {
                        "content": doc,
                        "relevance_score": round(1 - dist, 4),
                        "metadata": meta,
                    }
                )
        return chunks

    def get_stats(self) -> dict[str, Any]:
        return {
            "total_chunks": self.collection.count(),
            "collection_name": self.COLLECTION_NAME,
        }


_rag_service: RAGService | None = None


def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
