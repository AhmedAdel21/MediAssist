from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel

from auth.models import User
from authz.policies import require_doctor, require_medical_staff
from logging_config import get_logger
from rag.service import RAGService, get_rag_service

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])
logger = get_logger(__name__)


class QueryRequest(BaseModel):
    question: str
    n_results: int = 5


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile,
    current_user: User = Depends(require_doctor),
    rag: RAGService = Depends(get_rag_service),
):
    logger.info("Document upload started: filename=%s user_id=%s", file.filename, current_user.id)
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        logger.warning("Document upload failed — not UTF-8: filename=%s user_id=%s", file.filename, current_user.id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be UTF-8 encoded text")

    if not text.strip():
        logger.warning("Document upload failed — empty file: filename=%s user_id=%s", file.filename, current_user.id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty")

    result = await rag.index_document(
        filename=file.filename or "unknown",
        content=text,
        uploader_id=current_user.id,
    )

    logger.info(
        "Document indexed: doc_id=%s filename=%s chunks=%d user_id=%s",
        result["doc_id"], result["filename"], result["chunks_created"], current_user.id,
    )
    return {
        "doc_id": result["doc_id"],
        "filename": result["filename"],
        "chunks_created": result["chunks_created"],
        "message": f"Document indexed successfully into {result['chunks_created']} searchable chunks",
    }


@router.post("/query")
async def query_documents(
    data: QueryRequest,
    current_user: User = Depends(require_medical_staff),
    rag: RAGService = Depends(get_rag_service),
):
    logger.info("RAG query: question=%.80r n_results=%d user_id=%s", data.question, data.n_results, current_user.id)
    chunks = await rag.query(data.question, data.n_results)
    logger.info("RAG query result: found=%d user_id=%s", len(chunks), current_user.id)
    return {
        "question": data.question,
        "chunks": chunks,
        "total_found": len(chunks),
    }


@router.get("/stats")
async def get_stats(
    current_user: User = Depends(require_doctor),
    rag: RAGService = Depends(get_rag_service),
):
    stats = rag.get_stats()
    logger.debug("RAG stats requested: user_id=%s stats=%s", current_user.id, stats)
    return stats
