import json
from collections.abc import AsyncGenerator
from typing import Any

from anthropic import AsyncAnthropic

from config import settings
from logging_config import get_logger
from rag.service import RAGService

logger = get_logger(__name__)

TOOL_DEFINITIONS = [
    {
        "name": "rag_search",
        "description": "Search indexed medical documents for relevant information about a query.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "n_results": {"type": "integer", "description": "Number of results to return", "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "calculate_dose",
        "description": "Calculate medication dose based on patient weight and protocol.",
        "input_schema": {
            "type": "object",
            "properties": {
                "medication": {"type": "string"},
                "weight_kg": {"type": "number"},
                "dose_mg_per_kg": {"type": "number"},
                "age_years": {"type": "number"},
            },
            "required": ["medication", "weight_kg", "dose_mg_per_kg"],
        },
    },
    {
        "name": "flag_urgent",
        "description": "Flag a case as urgent, triggering immediate escalation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "reason": {"type": "string"},
                "severity": {"type": "string", "enum": ["high", "critical"]},
            },
            "required": ["reason", "severity"],
        },
    },
]

SYSTEM_PROMPT = """You are MediAssist AI, a clinical decision support assistant.
Answer questions strictly based on uploaded medical protocols and guidelines.
Do not provide medical advice from general knowledge — always search documents first.
When calculations are needed, use the calculate_dose tool.
Flag urgent situations with the flag_urgent tool immediately."""


class MedicalAgent:
    MAX_ITERATIONS = 10

    def __init__(self, rag_service: RAGService) -> None:
        self.rag = rag_service
        self.anthropic = AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def _execute_tool(self, tool_name: str, tool_input: dict[str, Any]) -> str:
        logger.debug("Tool call: name=%s input=%s", tool_name, tool_input)
        if tool_name == "rag_search":
            chunks = await self.rag.query(
                tool_input["query"],
                tool_input.get("n_results", 5),
            )
            if not chunks:
                logger.debug("Tool rag_search: no results for query=%r", tool_input["query"])
                return "No relevant documents found."
            logger.debug("Tool rag_search: found %d chunks for query=%r", len(chunks), tool_input["query"])
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
            logger.debug("Tool calculate_dose: %s", result)
            return result

        if tool_name == "flag_urgent":
            logger.warning(
                "Tool flag_urgent: severity=%s reason=%s",
                tool_input["severity"], tool_input["reason"],
            )
            return (
                f"⚠️ URGENT ({tool_input['severity'].upper()}) FLAG RAISED: {tool_input['reason']}"
            )

        logger.error("Tool call to unknown tool: %s", tool_name)
        return f"Unknown tool: {tool_name}"

    async def stream(
        self,
        message: str,
        conversation_history: list[dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        messages = [*conversation_history, {"role": "user", "content": message}]
        iterations = 0
        tools_called: list[str] = []

        while iterations < self.MAX_ITERATIONS:
            iterations += 1
            logger.debug("Agent stream iteration %d/%d", iterations, self.MAX_ITERATIONS)
            try:
                response = await self.anthropic.messages.create(
                    model="claude-opus-4-5",
                    max_tokens=4096,
                    system=SYSTEM_PROMPT,
                    tools=TOOL_DEFINITIONS,
                    messages=messages,
                )
            except Exception as exc:
                logger.error("Anthropic API error on iteration %d: %s", iterations, exc, exc_info=True)
                raise

            # Stream text content blocks
            text_yielded = False
            tool_calls: list[dict[str, Any]] = []

            for block in response.content:
                if block.type == "text":
                    # Yield text word by word for streaming effect
                    for word in block.text.split(" "):
                        yield word + " "
                    text_yielded = True
                elif block.type == "tool_use":
                    tool_calls.append({"id": block.id, "name": block.name, "input": block.input})

            if response.stop_reason == "end_turn" or not tool_calls:
                logger.info(
                    "Agent stream loop done: iterations=%d tools_called=%s stop_reason=%s",
                    iterations, tools_called, response.stop_reason,
                )
                break

            # Process tool calls
            tool_results = []
            for tc in tool_calls:
                tools_called.append(tc["name"])
                yield f"[Using tool: {tc['name']}...]\n"
                result = await self._execute_tool(tc["name"], tc["input"])
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tc["id"],
                        "content": result,
                    }
                )

            # Add assistant turn + tool results to messages
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

    async def chat(
        self,
        message: str,
        conversation_history: list[dict[str, str]],
    ) -> dict[str, Any]:
        messages = [*conversation_history, {"role": "user", "content": message}]
        iterations = 0
        full_response = ""
        tools_called: list[str] = []

        while iterations < self.MAX_ITERATIONS:
            iterations += 1
            logger.debug("Agent chat iteration %d/%d", iterations, self.MAX_ITERATIONS)
            try:
                response = await self.anthropic.messages.create(
                    model="claude-opus-4-5",
                    max_tokens=4096,
                    system=SYSTEM_PROMPT,
                    tools=TOOL_DEFINITIONS,
                    messages=messages,
                )
            except Exception as exc:
                logger.error("Anthropic API error on iteration %d: %s", iterations, exc, exc_info=True)
                raise

            tool_calls: list[dict[str, Any]] = []
            for block in response.content:
                if block.type == "text":
                    full_response += block.text
                elif block.type == "tool_use":
                    tool_calls.append({"id": block.id, "name": block.name, "input": block.input})

            if response.stop_reason == "end_turn" or not tool_calls:
                logger.info(
                    "Agent chat loop done: iterations=%d tools_called=%s stop_reason=%s",
                    iterations, tools_called, response.stop_reason,
                )
                break

            tool_results = []
            for tc in tool_calls:
                tools_called.append(tc["name"])
                result = await self._execute_tool(tc["name"], tc["input"])
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": tc["id"], "content": result}
                )

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        return {"response": full_response, "iterations_used": iterations}
