from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth.models import User
from authz.policies import require_medical_staff
from agents.service import MedicalAgent
from logging_config import get_logger
from rag.service import RAGService, get_rag_service

router = APIRouter(prefix="/api/v1/agent", tags=["agent"])
logger = get_logger(__name__)


class ConversationMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[ConversationMessage] = []


def _get_agent(rag: RAGService = Depends(get_rag_service)) -> MedicalAgent:
    return MedicalAgent(rag)


@router.post("/chat/stream")
async def chat_stream(
    data: ChatRequest,
    current_user: User = Depends(require_medical_staff),
    agent: MedicalAgent = Depends(_get_agent),
):
    history = [{"role": m.role, "content": m.content} for m in data.conversation_history]
    logger.info(
        "Agent stream started: user_id=%s message_preview=%.80r history_len=%d",
        current_user.id, data.message, len(data.conversation_history),
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for chunk in agent.stream(data.message, history):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
            logger.info("Agent stream complete: user_id=%s", current_user.id)
        except Exception as exc:
            logger.error("Agent stream error: user_id=%s error=%s", current_user.id, exc, exc_info=True)
            yield f"data: [ERROR] {str(exc)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat")
async def chat(
    data: ChatRequest,
    current_user: User = Depends(require_medical_staff),
    agent: MedicalAgent = Depends(_get_agent),
):
    history = [{"role": m.role, "content": m.content} for m in data.conversation_history]
    logger.info(
        "Agent chat started: user_id=%s message_preview=%.80r history_len=%d",
        current_user.id, data.message, len(data.conversation_history),
    )
    result = await agent.chat(data.message, history)
    logger.info(
        "Agent chat complete: user_id=%s iterations=%d response_len=%d",
        current_user.id, result.get("iterations_used", 0), len(result.get("response", "")),
    )
    return result
