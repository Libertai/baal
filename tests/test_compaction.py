"""Tests for context window management and history compaction."""

import asyncio
import json
import tempfile
from unittest.mock import AsyncMock, MagicMock

import pytest

from baal_agent.compaction import estimate_tokens, get_context_limit, maybe_compact
from baal_agent.config import AgentSettings
from baal_agent.database import AgentDatabase


# ═══════════════════════════════════════════════════════════════════════
# 1. get_context_limit
# ═══════════════════════════════════════════════════════════════════════


class TestGetContextLimit:
    def test_configured_value_takes_precedence(self):
        assert get_context_limit("qwen3-coder-next", 10_000) == 10_000

    def test_known_model_lookup(self):
        assert get_context_limit("qwen3-coder-next", 0) == 98_304
        assert get_context_limit("glm-4.7", 0) == 131_072

    def test_unknown_model_uses_default(self):
        assert get_context_limit("some-future-model", 0) == 32_768


# ═══════════════════════════════════════════════════════════════════════
# 2. estimate_tokens
# ═══════════════════════════════════════════════════════════════════════


class TestEstimateTokens:
    def test_empty_messages(self):
        assert estimate_tokens([]) == 0

    def test_simple_text_messages(self):
        msgs = [
            {"role": "user", "content": "Hello"},  # 5 chars
            {"role": "assistant", "content": "Hi there"},  # 8 chars
        ]
        # (5 + 8) // 4 + 4 * 2 = 3 + 8 = 11
        assert estimate_tokens(msgs) == 11

    def test_message_with_tool_calls(self):
        tc = [{"id": "1", "type": "function", "function": {"name": "bash", "arguments": "{}"}}]
        msgs = [{"role": "assistant", "content": "Let me check", "tool_calls": tc}]
        tc_chars = len(json.dumps(tc))
        content_chars = len("Let me check")
        expected = (content_chars + tc_chars) // 4 + 4
        assert estimate_tokens(msgs) == expected

    def test_message_with_tool_call_id(self):
        msgs = [{"role": "tool", "content": "output", "tool_call_id": "call_abc123"}]
        total_chars = len("output") + len("call_abc123")
        expected = total_chars // 4 + 4
        assert estimate_tokens(msgs) == expected

    def test_no_content_message(self):
        msgs = [{"role": "assistant", "tool_calls": [{"id": "1"}]}]
        tc_chars = len(json.dumps([{"id": "1"}]))
        expected = tc_chars // 4 + 4
        assert estimate_tokens(msgs) == expected


# ═══════════════════════════════════════════════════════════════════════
# 3. compact_history (DB operation)
# ═══════════════════════════════════════════════════════════════════════


@pytest.fixture
async def test_db(tmp_path):
    db = AgentDatabase(db_path=str(tmp_path / "test.db"))
    await db.initialize()
    yield db
    await db.close()


class TestCompactHistory:
    @pytest.mark.asyncio
    async def test_compact_replaces_old_with_summary(self, tmp_path):
        db = AgentDatabase(db_path=str(tmp_path / "test.db"))
        await db.initialize()
        try:
            # Insert 10 messages
            for i in range(10):
                await db.add_message("chat1", "user" if i % 2 == 0 else "assistant", f"msg {i}")

            await db.compact_history("chat1", keep_recent=4, summary="This is a summary")

            history = await db.get_history("chat1", limit=100)
            # Should have: 2 summary messages + 4 kept = 6
            assert len(history) == 6
            # First message should be the summary user message
            assert history[0]["role"] == "user"
            assert "[Earlier conversation summary]" in history[0]["content"]
            assert "This is a summary" in history[0]["content"]
            # Second should be the assistant acknowledgment
            assert history[1]["role"] == "assistant"
            assert "context from our previous conversation" in history[1]["content"]
            # Last 4 should be the original recent messages
            assert history[2]["content"] == "msg 6"
            assert history[5]["content"] == "msg 9"
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_compact_noop_when_few_messages(self, tmp_path):
        db = AgentDatabase(db_path=str(tmp_path / "test.db"))
        await db.initialize()
        try:
            for i in range(3):
                await db.add_message("chat1", "user", f"msg {i}")

            await db.compact_history("chat1", keep_recent=5, summary="should not matter")

            history = await db.get_history("chat1", limit=100)
            assert len(history) == 3
            # No summary inserted
            assert "[Earlier conversation summary]" not in history[0].get("content", "")
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_compact_preserves_other_chats(self, tmp_path):
        db = AgentDatabase(db_path=str(tmp_path / "test.db"))
        await db.initialize()
        try:
            for i in range(10):
                await db.add_message("chat1", "user", f"chat1 msg {i}")
                await db.add_message("chat2", "user", f"chat2 msg {i}")

            await db.compact_history("chat1", keep_recent=4, summary="summary for chat1")

            # chat2 should be untouched
            history2 = await db.get_history("chat2", limit=100)
            assert len(history2) == 10
        finally:
            await db.close()


# ═══════════════════════════════════════════════════════════════════════
# 4. maybe_compact
# ═══════════════════════════════════════════════════════════════════════


def _make_settings(**overrides) -> AgentSettings:
    defaults = {
        "libertai_api_key": "test-key",
        "agent_secret": "test-secret",
        "max_history": 100,
        "max_context_tokens": 100_000,  # large budget by default
        "generation_reserve": 1000,
        "compaction_keep_messages": 4,
    }
    defaults.update(overrides)
    return AgentSettings(**defaults)


class TestMaybeCompact:
    @pytest.mark.asyncio
    async def test_under_budget_returns_as_is(self, tmp_path):
        db = AgentDatabase(db_path=str(tmp_path / "test.db"))
        await db.initialize()
        try:
            await db.add_message("chat1", "user", "hello")
            await db.add_message("chat1", "assistant", "hi there")

            mock_inference = MagicMock()
            s = _make_settings()
            msgs = await maybe_compact(
                db, mock_inference, "chat1", "You are helpful.", "qwen3-coder-next", s
            )

            assert msgs[0]["role"] == "system"
            assert msgs[0]["content"] == "You are helpful."
            assert len(msgs) == 3  # system + 2 history
            mock_inference.chat.assert_not_called()
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_over_budget_triggers_compaction(self, tmp_path):
        db = AgentDatabase(db_path=str(tmp_path / "test.db"))
        await db.initialize()
        try:
            # Insert many messages with large content to exceed a tiny budget
            for i in range(20):
                role = "user" if i % 2 == 0 else "assistant"
                await db.add_message("chat1", role, f"message number {i} " + "x" * 200)

            mock_inference = MagicMock()
            summary_response = MagicMock()
            summary_response.content = "Summary of the conversation so far."
            mock_inference.chat = AsyncMock(return_value=summary_response)

            # Tiny budget to force compaction
            s = _make_settings(max_context_tokens=500, generation_reserve=100, compaction_keep_messages=4)

            msgs = await maybe_compact(
                db, mock_inference, "chat1", "System prompt.", "qwen3-coder-next", s
            )

            # Inference should have been called for summarization
            mock_inference.chat.assert_called_once()
            call_args = mock_inference.chat.call_args
            # Should have tools=None
            assert call_args.kwargs.get("tools") is None or call_args[1].get("tools") is None

            # Result should have summary pair + kept messages
            assert msgs[0]["role"] == "system"
            # Should contain the summary message
            found_summary = any(
                "[Earlier conversation summary]" in m.get("content", "")
                for m in msgs
            )
            assert found_summary
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_empty_history_no_compaction(self, tmp_path):
        db = AgentDatabase(db_path=str(tmp_path / "test.db"))
        await db.initialize()
        try:
            mock_inference = MagicMock()
            s = _make_settings()
            msgs = await maybe_compact(
                db, mock_inference, "chat1", "System.", "qwen3-coder-next", s
            )

            assert len(msgs) == 1  # just system prompt
            mock_inference.chat.assert_not_called()
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_inference_failure_returns_uncompacted(self, tmp_path):
        db = AgentDatabase(db_path=str(tmp_path / "test.db"))
        await db.initialize()
        try:
            for i in range(20):
                role = "user" if i % 2 == 0 else "assistant"
                await db.add_message("chat1", role, f"msg {i} " + "x" * 200)

            mock_inference = MagicMock()
            mock_inference.chat = AsyncMock(side_effect=RuntimeError("API down"))

            s = _make_settings(max_context_tokens=500, generation_reserve=100, compaction_keep_messages=4)

            msgs = await maybe_compact(
                db, mock_inference, "chat1", "System.", "qwen3-coder-next", s
            )

            # Should return uncompacted messages as fallback
            assert len(msgs) == 21  # system + 20 history
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_history_shorter_than_keep_no_compaction(self, tmp_path):
        """When history is small but system prompt is huge, don't crash."""
        db = AgentDatabase(db_path=str(tmp_path / "test.db"))
        await db.initialize()
        try:
            await db.add_message("chat1", "user", "hello")
            await db.add_message("chat1", "assistant", "hi")

            mock_inference = MagicMock()
            # Tiny budget but only 2 messages (less than keep=4)
            s = _make_settings(max_context_tokens=10, generation_reserve=1, compaction_keep_messages=4)

            msgs = await maybe_compact(
                db, mock_inference, "chat1", "System.", "qwen3-coder-next", s
            )

            # Should return as-is since history <= keep_messages
            assert len(msgs) == 3
            mock_inference.chat.assert_not_called()
        finally:
            await db.close()
