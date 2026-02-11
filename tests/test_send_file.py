"""Tests for send_file feature: path security, tool executors, and FastAPI endpoints."""

import asyncio
import json
import os
import tempfile
from pathlib import Path

import pytest


# ═══════════════════════════════════════════════════════════════════════
# 1. Security module tests
# ═══════════════════════════════════════════════════════════════════════


class TestValidateWorkspacePath:
    """Test validate_workspace_path from security.py."""

    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.workspace = Path(self.tmpdir) / "workspace"
        self.workspace.mkdir()
        # Create test files
        (self.workspace / "hello.txt").write_text("hello")
        (self.workspace / "sub").mkdir()
        (self.workspace / "sub" / "deep.txt").write_text("deep")
        (self.workspace / ".env").write_text("SECRET=x")
        (self.workspace / "agent.db").write_text("db")

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_relative_path_within_workspace(self):
        from baal_agent.security import validate_workspace_path
        result = validate_workspace_path("hello.txt", self.workspace, must_exist=True)
        assert result == (self.workspace / "hello.txt").resolve()

    def test_absolute_path_within_workspace(self):
        from baal_agent.security import validate_workspace_path
        abs_path = str(self.workspace / "sub" / "deep.txt")
        result = validate_workspace_path(abs_path, self.workspace, must_exist=True)
        assert result == Path(abs_path).resolve()

    def test_dotdot_traversal_blocked(self):
        from baal_agent.security import PathSecurityError, validate_workspace_path
        with pytest.raises(PathSecurityError, match="escapes workspace"):
            validate_workspace_path("../../../etc/passwd", self.workspace)

    def test_absolute_path_outside_workspace(self):
        from baal_agent.security import PathSecurityError, validate_workspace_path
        with pytest.raises(PathSecurityError, match="escapes workspace"):
            validate_workspace_path("/etc/passwd", self.workspace)

    def test_symlink_escape_blocked(self):
        from baal_agent.security import PathSecurityError, validate_workspace_path
        # Create a symlink that points outside workspace
        link = self.workspace / "escape_link"
        link.symlink_to("/etc")
        with pytest.raises(PathSecurityError, match="escapes workspace"):
            validate_workspace_path("escape_link/passwd", self.workspace)

    def test_must_exist_nonexistent(self):
        from baal_agent.security import PathSecurityError, validate_workspace_path
        with pytest.raises(PathSecurityError, match="does not exist"):
            validate_workspace_path("nonexistent.txt", self.workspace, must_exist=True)

    def test_must_exist_false_nonexistent_ok(self):
        from baal_agent.security import validate_workspace_path
        # Should not raise — file doesn't exist but must_exist=False
        result = validate_workspace_path("new_file.txt", self.workspace, must_exist=False)
        assert result == (self.workspace / "new_file.txt").resolve()

    def test_reject_sensitive_env(self):
        from baal_agent.security import PathSecurityError, validate_workspace_path
        with pytest.raises(PathSecurityError, match="sensitive"):
            validate_workspace_path(".env", self.workspace, reject_sensitive=True)

    def test_reject_sensitive_db(self):
        from baal_agent.security import PathSecurityError, validate_workspace_path
        with pytest.raises(PathSecurityError, match="sensitive"):
            validate_workspace_path("agent.db", self.workspace, reject_sensitive=True)

    def test_non_sensitive_passes(self):
        from baal_agent.security import validate_workspace_path
        result = validate_workspace_path(
            "hello.txt", self.workspace, must_exist=True, reject_sensitive=True
        )
        assert result == (self.workspace / "hello.txt").resolve()

    def test_dot_resolves_to_workspace(self):
        from baal_agent.security import validate_workspace_path
        result = validate_workspace_path(".", self.workspace, must_exist=True)
        assert result == self.workspace.resolve()


# ═══════════════════════════════════════════════════════════════════════
# 2. Tool executor tests (with workspace enforcement)
# ═══════════════════════════════════════════════════════════════════════


class TestToolsWorkspaceEnforcement:
    """Test that file tools respect workspace boundaries."""

    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.workspace = Path(self.tmpdir) / "workspace"
        self.workspace.mkdir()
        (self.workspace / "test.txt").write_text("line1\nline2\nline3\n")
        (self.workspace / "subdir").mkdir()

        # Configure workspace for tools module
        from baal_agent.tools import configure_tools
        configure_tools(str(self.workspace))

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)
        # Reset workspace
        from baal_agent import tools
        tools._workspace_path = None

    @pytest.mark.asyncio
    async def test_read_file_within_workspace(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("read_file", {"path": "test.txt"})
        assert "line1" in result
        assert "line2" in result

    @pytest.mark.asyncio
    async def test_read_file_outside_workspace_blocked(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("read_file", {"path": "/etc/hostname"})
        assert "escapes workspace" in result

    @pytest.mark.asyncio
    async def test_read_file_traversal_blocked(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("read_file", {"path": "../../etc/passwd"})
        assert "escapes workspace" in result

    @pytest.mark.asyncio
    async def test_write_file_within_workspace(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("write_file", {
            "path": "new.txt",
            "content": "hello world",
        })
        assert "Wrote" in result
        assert (self.workspace / "new.txt").read_text() == "hello world"

    @pytest.mark.asyncio
    async def test_write_file_outside_workspace_blocked(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("write_file", {
            "path": "/tmp/baal_escape_test.txt",
            "content": "evil",
        })
        assert "escapes workspace" in result
        assert not Path("/tmp/baal_escape_test.txt").exists()

    @pytest.mark.asyncio
    async def test_edit_file_within_workspace(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("edit_file", {
            "path": "test.txt",
            "old_string": "line2",
            "new_string": "LINE_TWO",
        })
        assert "Edited" in result
        assert "LINE_TWO" in (self.workspace / "test.txt").read_text()

    @pytest.mark.asyncio
    async def test_edit_file_outside_workspace_blocked(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("edit_file", {
            "path": "/etc/hostname",
            "old_string": "x",
            "new_string": "y",
        })
        assert "escapes workspace" in result

    @pytest.mark.asyncio
    async def test_list_dir_within_workspace(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("list_dir", {"path": "."})
        assert "[dir]" in result or "[file]" in result

    @pytest.mark.asyncio
    async def test_list_dir_outside_workspace_blocked(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("list_dir", {"path": "/etc"})
        assert "escapes workspace" in result

    @pytest.mark.asyncio
    async def test_send_file_success(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("send_file", {"path": "test.txt", "caption": "my file"})
        assert result.startswith("__SEND_FILE__:")
        assert "test.txt" in result
        assert "my file" in result

    @pytest.mark.asyncio
    async def test_send_file_outside_workspace_blocked(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("send_file", {"path": "/etc/passwd"})
        assert "escapes workspace" in result

    @pytest.mark.asyncio
    async def test_send_file_sensitive_blocked(self):
        from baal_agent.tools import execute_tool
        (self.workspace / ".env").write_text("SECRET=x")
        result = await execute_tool("send_file", {"path": ".env"})
        assert "sensitive" in result

    @pytest.mark.asyncio
    async def test_send_file_nonexistent(self):
        from baal_agent.tools import execute_tool
        result = await execute_tool("send_file", {"path": "nope.txt"})
        assert "does not exist" in result

    @pytest.mark.asyncio
    async def test_send_file_too_large(self):
        from baal_agent.security import MAX_SEND_FILE_SIZE
        from baal_agent.tools import execute_tool
        # Create a file just over the limit using a sparse file approach
        big = self.workspace / "big.bin"
        big.write_bytes(b"\0" * 100)  # small actual file
        # Monkey-patch stat to simulate large file
        import unittest.mock as mock
        fake_stat = mock.MagicMock()
        fake_stat.st_size = MAX_SEND_FILE_SIZE + 1
        with mock.patch.object(Path, "stat", return_value=fake_stat):
            result = await execute_tool("send_file", {"path": "big.bin"})
        assert "too large" in result


# ═══════════════════════════════════════════════════════════════════════
# 3. FastAPI endpoint tests
# ═══════════════════════════════════════════════════════════════════════


@pytest.fixture
def agent_workspace(tmp_path):
    """Create a workspace with test files."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "memory").mkdir()
    (workspace / "skills").mkdir()
    (workspace / "photo.png").write_bytes(b"\x89PNG fake image data")
    (workspace / "doc.txt").write_text("hello document")
    (workspace / ".env").write_text("SECRET=bad")
    return workspace


@pytest.fixture
def agent_app(agent_workspace, monkeypatch):
    """Create a test FastAPI app with mocked settings."""
    # Set environment variables before importing the agent module
    monkeypatch.setenv("AGENT_NAME", "test-agent")
    monkeypatch.setenv("SYSTEM_PROMPT", "Be helpful")
    monkeypatch.setenv("MODEL", "qwen3-coder-next")
    monkeypatch.setenv("LIBERTAI_API_KEY", "fake-key")
    monkeypatch.setenv("AGENT_SECRET", "test-secret-123")
    monkeypatch.setenv("WORKSPACE_PATH", str(agent_workspace))
    monkeypatch.setenv("DB_PATH", str(agent_workspace / "test_agent.db"))

    # We need to reload the module to pick up the new env vars
    # Instead, we'll create a fresh app using httpx test client
    # But the agent module-level settings are already initialized...
    # So let's just test the endpoint logic directly via the security module
    # and use httpx TestClient for the /files endpoint
    return None  # We'll use a different approach


class TestFilesEndpoint:
    """Test the /files/{path} endpoint logic via security module."""

    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.workspace = Path(self.tmpdir) / "workspace"
        self.workspace.mkdir()
        (self.workspace / "photo.png").write_bytes(b"\x89PNG fake")
        (self.workspace / "doc.txt").write_text("hello")
        (self.workspace / ".env").write_text("SECRET=x")

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_valid_file_resolves(self):
        from baal_agent.security import validate_workspace_path
        resolved = validate_workspace_path(
            "photo.png", self.workspace, must_exist=True, reject_sensitive=True
        )
        assert resolved.name == "photo.png"
        assert resolved.exists()

    def test_sensitive_file_blocked(self):
        from baal_agent.security import PathSecurityError, validate_workspace_path
        with pytest.raises(PathSecurityError):
            validate_workspace_path(
                ".env", self.workspace, must_exist=True, reject_sensitive=True
            )

    def test_traversal_blocked(self):
        from baal_agent.security import PathSecurityError, validate_workspace_path
        with pytest.raises(PathSecurityError):
            validate_workspace_path(
                "../../../etc/passwd", self.workspace, must_exist=False, reject_sensitive=True
            )


# ═══════════════════════════════════════════════════════════════════════
# 4. Proxy download_agent_file tests
# ═══════════════════════════════════════════════════════════════════════


class TestDownloadAgentFile:
    """Test the proxy download_agent_file function."""

    @pytest.mark.asyncio
    async def test_image_detection_png(self):
        """Test that .png files are detected as photos."""
        import httpx
        import unittest.mock as mock

        from baal.services.proxy import download_agent_file

        # Mock httpx response
        mock_resp = mock.MagicMock()
        mock_resp.content = b"\x89PNG fake image " * 100  # small image
        mock_resp.raise_for_status = mock.MagicMock()

        async def mock_get(*args, **kwargs):
            return mock_resp

        mock_client = mock.AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = mock.AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = mock.AsyncMock(return_value=None)

        with mock.patch("baal.services.proxy.httpx.AsyncClient", return_value=mock_client):
            result = await download_agent_file("http://localhost:8080", "token", "photo.png")

        assert result is not None
        data, filename, is_photo = result
        assert filename == "photo.png"
        assert is_photo is True

    @pytest.mark.asyncio
    async def test_non_image_detection(self):
        """Test that .txt files are not detected as photos."""
        import unittest.mock as mock

        from baal.services.proxy import download_agent_file

        mock_resp = mock.MagicMock()
        mock_resp.content = b"hello text"
        mock_resp.raise_for_status = mock.MagicMock()

        async def mock_get(*args, **kwargs):
            return mock_resp

        mock_client = mock.AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = mock.AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = mock.AsyncMock(return_value=None)

        with mock.patch("baal.services.proxy.httpx.AsyncClient", return_value=mock_client):
            result = await download_agent_file("http://localhost:8080", "token", "doc.txt")

        assert result is not None
        data, filename, is_photo = result
        assert filename == "doc.txt"
        assert is_photo is False

    @pytest.mark.asyncio
    async def test_nested_path_filename_extraction(self):
        """Test filename extraction from nested paths."""
        import unittest.mock as mock

        from baal.services.proxy import download_agent_file

        mock_resp = mock.MagicMock()
        mock_resp.content = b"data"
        mock_resp.raise_for_status = mock.MagicMock()

        async def mock_get(*args, **kwargs):
            return mock_resp

        mock_client = mock.AsyncMock()
        mock_client.get = mock_get
        mock_client.__aenter__ = mock.AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = mock.AsyncMock(return_value=None)

        with mock.patch("baal.services.proxy.httpx.AsyncClient", return_value=mock_client):
            result = await download_agent_file(
                "http://localhost:8080", "token", "sub/dir/file.pdf"
            )

        assert result is not None
        _, filename, is_photo = result
        assert filename == "file.pdf"
        assert is_photo is False

    @pytest.mark.asyncio
    async def test_failure_returns_none(self):
        """Test that connection errors return None."""
        import unittest.mock as mock

        from baal.services.proxy import download_agent_file

        mock_client = mock.AsyncMock()
        mock_client.get = mock.AsyncMock(side_effect=Exception("connection refused"))
        mock_client.__aenter__ = mock.AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = mock.AsyncMock(return_value=None)

        with mock.patch("baal.services.proxy.httpx.AsyncClient", return_value=mock_client):
            result = await download_agent_file("http://localhost:8080", "token", "file.txt")

        assert result is None


# ═══════════════════════════════════════════════════════════════════════
# 5. SSE marker detection tests
# ═══════════════════════════════════════════════════════════════════════


class TestSendFileMarker:
    """Test the __SEND_FILE__ marker parsing logic."""

    def test_marker_format(self):
        """Test that the marker is correctly formatted and parsed."""
        marker = "__SEND_FILE__:photos/test.png:My caption here"
        assert marker.startswith("__SEND_FILE__:")
        parts = marker.split(":", 2)
        assert parts[0] == "__SEND_FILE__"
        assert parts[1] == "photos/test.png"
        assert parts[2] == "My caption here"

    def test_marker_with_colon_in_caption(self):
        """Test that colons in captions don't break parsing."""
        marker = "__SEND_FILE__:file.txt:Caption: with colons: here"
        parts = marker.split(":", 2)
        assert parts[0] == "__SEND_FILE__"
        assert parts[1] == "file.txt"
        assert parts[2] == "Caption: with colons: here"

    def test_marker_empty_caption(self):
        """Test marker with empty caption."""
        marker = "__SEND_FILE__:file.txt:"
        parts = marker.split(":", 2)
        assert parts[0] == "__SEND_FILE__"
        assert parts[1] == "file.txt"
        assert parts[2] == ""


# ═══════════════════════════════════════════════════════════════════════
# 6. Integration: FastAPI /files endpoint with TestClient
# ═══════════════════════════════════════════════════════════════════════


class TestFastAPIFilesEndpoint:
    """Integration test for the /files endpoint using a minimal FastAPI app."""

    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.workspace = Path(self.tmpdir) / "workspace"
        self.workspace.mkdir()
        (self.workspace / "memory").mkdir()
        (self.workspace / "skills").mkdir()
        (self.workspace / "hello.txt").write_text("hello world")
        (self.workspace / ".env").write_text("SECRET=x")

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _make_app(self):
        """Create a minimal FastAPI app mimicking the /files endpoint."""
        import secrets as _secrets

        from fastapi import FastAPI, Request
        from fastapi.responses import FileResponse, JSONResponse

        from baal_agent.security import PathSecurityError, validate_workspace_path

        test_secret = "test-secret-123"
        workspace_path = str(self.workspace)

        app = FastAPI()

        @app.middleware("http")
        async def verify_auth(request: Request, call_next):
            if request.url.path == "/health":
                return await call_next(request)
            token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
            if not token or not _secrets.compare_digest(token, test_secret):
                return JSONResponse(status_code=401, content={"error": "unauthorized"})
            return await call_next(request)

        @app.get("/files/{file_path:path}")
        async def serve_file(file_path: str):
            try:
                resolved = validate_workspace_path(
                    file_path, workspace_path, must_exist=True, reject_sensitive=True
                )
                return FileResponse(resolved, filename=resolved.name)
            except PathSecurityError as e:
                return JSONResponse(status_code=403, content={"error": str(e)})

        return app, test_secret

    def test_serve_valid_file(self):
        from starlette.testclient import TestClient

        app, secret = self._make_app()
        client = TestClient(app)
        resp = client.get("/files/hello.txt", headers={"Authorization": f"Bearer {secret}"})
        assert resp.status_code == 200
        assert resp.text == "hello world"

    def test_unauthorized_without_token(self):
        from starlette.testclient import TestClient

        app, _ = self._make_app()
        client = TestClient(app)
        resp = client.get("/files/hello.txt")
        assert resp.status_code == 401

    def test_sensitive_file_blocked(self):
        from starlette.testclient import TestClient

        app, secret = self._make_app()
        client = TestClient(app)
        resp = client.get("/files/.env", headers={"Authorization": f"Bearer {secret}"})
        assert resp.status_code == 403
        assert "sensitive" in resp.json()["error"]

    def test_traversal_blocked(self):
        from starlette.testclient import TestClient

        app, secret = self._make_app()
        client = TestClient(app)
        resp = client.get(
            "/files/../../../etc/passwd",
            headers={"Authorization": f"Bearer {secret}"},
        )
        # Starlette normalizes /../ in URLs → 404 (path doesn't match route),
        # or our handler catches it → 403. Either way, access is denied.
        assert resp.status_code in (403, 404)

    def test_nonexistent_file(self):
        from starlette.testclient import TestClient

        app, secret = self._make_app()
        client = TestClient(app)
        resp = client.get("/files/nope.txt", headers={"Authorization": f"Bearer {secret}"})
        assert resp.status_code == 403
        assert "does not exist" in resp.json()["error"]
