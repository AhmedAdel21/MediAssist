from collections.abc import AsyncGenerator
from typing import Any

import google.generativeai as genai
import google.generativeai.protos as protos
from fastapi import HTTPException, status
from google.api_core.exceptions import ResourceExhausted

from config import settings
from logging_config import get_logger
from rag.service import RAGService

logger = get_logger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"

TOOL_DECLARATIONS = [
    protos.FunctionDeclaration(
        name="rag_search",
        description="Search indexed medical documents for relevant information about a query.",
        parameters=protos.Schema(
            type=protos.Type.OBJECT,
            properties={
                "query": protos.Schema(type=protos.Type.STRING, description="The search query"),
                "n_results": protos.Schema(type=protos.Type.INTEGER, description="Number of results to return"),
            },
            required=["query"],
        ),
    ),
    protos.FunctionDeclaration(
        name="calculate_dose",
        description="Calculate medication dose based on patient weight and protocol.",
        parameters=protos.Schema(
            type=protos.Type.OBJECT,
            properties={
                "medication": protos.Schema(type=protos.Type.STRING),
                "weight_kg": protos.Schema(type=protos.Type.NUMBER),
                "dose_mg_per_kg": protos.Schema(type=protos.Type.NUMBER),
                "age_years": protos.Schema(type=protos.Type.NUMBER),
            },
            required=["medication", "weight_kg", "dose_mg_per_kg"],
        ),
    ),
    protos.FunctionDeclaration(
        name="flag_urgent",
        description="Flag a case as urgent, triggering immediate escalation.",
        parameters=protos.Schema(
            type=protos.Type.OBJECT,
            properties={
                "reason": protos.Schema(type=protos.Type.STRING),
                "severity": protos.Schema(type=protos.Type.STRING, enum=["high", "critical"]),
            },
            required=["reason", "severity"],
        ),
    ),
]

SYSTEM_PROMPT = (
    "You are MediAssist AI, a clinical decision support assistant. "
    "Answer questions strictly based on uploaded medical protocols and guidelines. "
    "Do not provide medical advice from general knowledge — always search documents first. "
    "When calculations are needed, use the calculate_dose tool. "
    "Flag urgent situations with the flag_urgent tool immediately."
)


class MedicalAgent:
    MAX_ITERATIONS = 10

    def __init__(self, rag_service: RAGService) -> None:
        self.rag = rag_service
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            tools=TOOL_DECLARATIONS,
            system_instruction=SYSTEM_PROMPT,
        )

    async def _execute_tool(self, tool_name: str, tool_input: dict[str, Any]) -> str:
        logger.debug("Tool call: name=%s input=%s", tool_name, tool_input)

        if tool_name == "rag_search":
            chunks = await self.rag.query(tool_input["query"], tool_input.get("n_results", 5))
            if not chunks:
                return "No relevant documents found."
            parts = []
            for i, chunk in enumerate(chunks, 1):
                parts.append(
                    f"[Source {i}: {chunk['metadata'].get('filename', 'unknown')} "
                    f"(relevance: {chunk['relevance_score']:.0%})]\n{chunk['content']}"
                )
            return "\n\n".join(parts)

        if tool_name == "calculate_dose":
            med = tool_input["medication"]
            weight = tool_input["weight_kg"]
            dose_per_kg = tool_input["dose_mg_per_kg"]
            age = tool_input.get("age_years")
            total = weight * dose_per_kg
            result = f"{med}: {total:.1f} mg (based on {weight} kg × {dose_per_kg} mg/kg)"
            if age is not None:
                result += f" — patient age: {age} years"
            return result

        if tool_name == "flag_urgent":
            logger.warning("flag_urgent: severity=%s reason=%s", tool_input["severity"], tool_input["reason"])
            return f"⚠️ URGENT ({tool_input['severity'].upper()}) FLAG RAISED: {tool_input['reason']}"

        return f"Unknown tool: {tool_name}"

    def _build_history(self, conversation_history: list[dict[str, str]]) -> list[dict]:
        # Gemini uses "model" for the assistant role, not "assistant"
        result = []
        for m in conversation_history:
            role = "model" if m["role"] == "assistant" else "user"
            result.append({"role": role, "parts": [m["content"]]})
        return result

    async def stream(
        self,
        message: str,
        conversation_history: list[dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        chat = self.model.start_chat(history=self._build_history(conversation_history))
        current_input: Any = message
        iterations = 0

        while iterations < self.MAX_ITERATIONS:
            iterations += 1
            logger.debug("Agent stream iteration %d/%d", iterations, self.MAX_ITERATIONS)

            try:
                response = await chat.send_message_async(current_input)
            except ResourceExhausted as exc:
                logger.warning("Gemini quota exceeded on iteration %d: %s", iterations, exc)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="AI quota exceeded. Please try again later.",
                )
            except Exception as exc:
                logger.error("Gemini API error on iteration %d: %s", iterations, exc, exc_info=True)
                raise

            function_calls = [
                p.function_call
                for p in response.parts
                if p.function_call.name  # non-empty name means it's a real tool call
            ]
            text_parts = [p.text for p in response.parts if hasattr(p, "text") and p.text]

            if not function_calls:
                # Final answer — stream word by word
                full_text = "".join(text_parts)
                logger.info("Agent stream done: iterations=%d", iterations)
                for word in full_text.split(" "):
                    yield word + " "
                break

            # Execute all tool calls, collect responses
            fn_response_parts = []
            for fc in function_calls:
                tool_name = fc.name
                tool_input = dict(fc.args)
                yield f"[Using tool: {tool_name}...]\n"
                result = await self._execute_tool(tool_name, tool_input)
                fn_response_parts.append(
                    protos.Part(
                        function_response=protos.FunctionResponse(
                            name=tool_name,
                            response={"result": result},
                        )
                    )
                )

            current_input = fn_response_parts

    async def chat(
        self,
        message: str,
        conversation_history: list[dict[str, str]],
    ) -> dict[str, Any]:
        chat = self.model.start_chat(history=self._build_history(conversation_history))
        current_input: Any = message
        iterations = 0
        full_response = ""

        while iterations < self.MAX_ITERATIONS:
            iterations += 1
            logger.debug("Agent chat iteration %d/%d", iterations, self.MAX_ITERATIONS)

            try:
                response = await chat.send_message_async(current_input)
            except ResourceExhausted as exc:
                logger.warning("Gemini quota exceeded on iteration %d: %s", iterations, exc)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="AI quota exceeded. Please try again later.",
                )
            except Exception as exc:
                logger.error("Gemini API error on iteration %d: %s", iterations, exc, exc_info=True)
                raise

            function_calls = [
                p.function_call
                for p in response.parts
                if p.function_call.name
            ]
            text_parts = [p.text for p in response.parts if hasattr(p, "text") and p.text]

            if not function_calls:
                full_response = "".join(text_parts)
                break

            fn_response_parts = []
            for fc in function_calls:
                result = await self._execute_tool(fc.name, dict(fc.args))
                fn_response_parts.append(
                    protos.Part(
                        function_response=protos.FunctionResponse(
                            name=fc.name,
                            response={"result": result},
                        )
                    )
                )

            current_input = fn_response_parts

        logger.info("Agent chat done: iterations=%d response_len=%d", iterations, len(full_response))
        return {"response": full_response, "iterations_used": iterations}
