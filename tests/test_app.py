"""FastAPI 应用单元测试"""
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import app, game_state, load_config, save_config, filter_think_process


@pytest.fixture(autouse=True)
def reset_game_state():
    """每个测试前重置游戏状态"""
    game_state.reset()
    game_state.connected_ws = None
    game_state.current_ws = None
    yield
    game_state.reset()


@pytest.fixture
def transport():
    return ASGITransport(app=app)


class TestFilterThinkProcess:
    """测试思考过程过滤"""

    def test_removes_think_tags(self):
        """应移除 <think>...</think> 内容"""
        text = "<think>我想想...</think>答案是42"
        result = filter_think_process(text)
        assert "我想想" not in result
        assert "42" in result

    def test_unclosed_think_takes_last_line(self):
        """未闭合的 <think> 应取最后一行"""
        text = "<think>思考过程\n最终答案是 100"
        result = filter_think_process(text)
        assert "100" in result

    def test_answer_with_colon(self):
        """'答：XX'格式应提取答案"""
        text = "经过计算，答：8"
        result = filter_think_process(text)
        assert "8" in result

    def test_answer_keyword(self):
        """'答案是 XX'格式应提取"""
        text = "经过分析，答案是 42"
        result = filter_think_process(text)
        assert "42" in result

    def test_no_special_format_returns_original(self):
        """无特殊格式时应返回原始内容"""
        text = "简单答案"
        result = filter_think_process(text)
        assert result == "简单答案"

    def test_empty_string(self):
        """空字符串应返回空"""
        result = filter_think_process("")
        assert result == ""

    def test_conclusion_keywords(self):
        """'所以/因此'等关键词应提取后面内容"""
        for keyword in ["所以", "因此", "那么"]:
            text = f"分析过程，{keyword}答案是 99"
            result = filter_think_process(text)
            assert "99" in result, f"关键词 '{keyword}' 未正确提取答案"


class TestIndexEndpoint:
    """测试主页端点"""

    @pytest.mark.asyncio
    async def test_index_returns_file_or_message(self, transport):
        """主页应返回文件或提示信息"""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/")
            assert resp.status_code == 200


class TestConfigEndpoints:
    """测试配置相关端点"""

    @pytest.mark.asyncio
    async def test_get_config_empty(self, transport):
        """无配置时应返回空 providers"""
        with patch("app.load_config", return_value={"providers": {}}):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/config")
                assert resp.status_code == 200
                data = resp.json()
                assert "providers" in data

    @pytest.mark.asyncio
    async def test_get_config_masks_keys(self, transport):
        """获取配置时应脱敏 API Key"""
        mock_config = {
            "providers": {
                "test": {
                    "id": "test",
                    "name": "Test",
                    "api_url": "https://api.test.com",
                    "api_key": "sk-1234567890abcdef",
                    "default_model": "gpt-4",
                    "used_models": [],
                }
            }
        }
        with patch("app.load_config", return_value=mock_config), \
             patch("app.decrypt_api_key", return_value="sk-1234567890abcdef"):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/config")
                data = resp.json()
                provider = data["providers"]["test"]
                assert "****" in provider["api_key"]

    @pytest.mark.asyncio
    async def test_save_provider(self, transport):
        """保存供应商应成功"""
        with patch("app.load_config", return_value={"providers": {}}), \
             patch("app.save_config") as mock_save, \
             patch("app.encrypt_api_key", return_value="encrypted_key"):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/config/provider",
                    json={
                        "id": "test-provider",
                        "name": "Test",
                        "api_url": "https://api.test.com",
                        "api_key": "sk-test-key",
                        "default_model": "gpt-4",
                        "used_models": [],
                    },
                )
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is True
                assert mock_save.called

    @pytest.mark.asyncio
    async def test_save_provider_without_id(self, transport):
        """无 ID 时应自动生成"""
        with patch("app.load_config", return_value={"providers": {}}), \
             patch("app.save_config") as mock_save, \
             patch("app.encrypt_api_key", return_value="encrypted_key"):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/config/provider",
                    json={
                        "id": "",
                        "name": "Auto",
                        "api_url": "https://api.test.com",
                        "api_key": "sk-test",
                        "default_model": "gpt-4",
                        "used_models": [],
                    },
                )
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is True
                assert "provider_" in data["provider_id"]

    @pytest.mark.asyncio
    async def test_delete_provider(self, transport):
        """删除供应商应成功"""
        mock_config = {
            "providers": {
                "to-delete": {"id": "to-delete", "name": "Delete Me"}
            }
        }
        with patch("app.load_config", return_value=mock_config), \
             patch("app.save_config") as mock_save:
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.delete("/api/config/provider/to-delete")
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is True
                assert mock_save.called

    @pytest.mark.asyncio
    async def test_delete_nonexistent_provider(self, transport):
        """删除不存在的供应商应返回失败"""
        with patch("app.load_config", return_value={"providers": {}}):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.delete("/api/config/provider/nonexistent")
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is False


class TestGameConfigsEndpoint:
    """测试游戏配置端点"""

    @pytest.mark.asyncio
    async def test_get_game_configs(self, transport):
        """应返回所有游戏配置"""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/game-configs")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) >= 3
            counts = [c["player_count"] for c in data]
            assert 6 in counts
            assert 8 in counts
            assert 10 in counts

    @pytest.mark.asyncio
    async def test_game_config_has_description(self, transport):
        """每个配置都应包含描述"""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/game-configs")
            data = resp.json()
            for config in data:
                assert "description" in config
                assert "roles" in config
                assert "player_count" in config


class TestGameStatusEndpoint:
    """测试游戏状态端点"""

    @pytest.mark.asyncio
    async def test_no_game_running(self, transport):
        """无游戏时应返回 running=False"""
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/game-status")
            assert resp.status_code == 200
            data = resp.json()
            assert data["running"] is False


class TestProviderInputValidation:
    """测试 ProviderInput 验证器"""

    def test_valid_api_url(self):
        """合法 URL 应通过验证"""
        from app import ProviderInput
        p = ProviderInput(api_url="https://api.openai.com")
        assert p.api_url == "https://api.openai.com"

    def test_invalid_api_url_rejected(self):
        """非法 URL 应被拒绝"""
        from app import ProviderInput
        with pytest.raises(ValueError, match="API URL"):
            ProviderInput(api_url="ftp://invalid.com")

    def test_empty_api_url_allowed(self):
        """空 URL 应被允许"""
        from app import ProviderInput
        p = ProviderInput(api_url="")
        assert p.api_url == ""

    def test_whitespace_trimmed(self):
        """URL 前后空格应被去除"""
        from app import ProviderInput
        p = ProviderInput(api_url="  https://api.test.com  ")
        assert p.api_url == "https://api.test.com"

    def test_valid_id(self):
        """合法 ID 应通过验证"""
        from app import ProviderInput
        p = ProviderInput(id="my_provider-123")
        assert p.id == "my_provider-123"

    def test_invalid_id_rejected(self):
        """含特殊字符的 ID 应被拒绝"""
        from app import ProviderInput
        with pytest.raises(ValueError, match="Provider ID"):
            ProviderInput(id="bad id!")


class TestGameStartInputValidation:
    """测试 GameStartInput 验证器"""

    def test_default_player_count(self):
        """默认人数应为 6"""
        from app import GameStartInput
        g = GameStartInput()
        assert g.player_count == 6

    def test_valid_player_counts(self):
        """6/8/10 应通过验证"""
        from app import GameStartInput
        for count in [6, 8, 10]:
            g = GameStartInput(player_count=count)
            assert g.player_count == count

    def test_too_small_rejected(self):
        """小于 6 应被拒绝"""
        from app import GameStartInput
        with pytest.raises(ValueError):
            GameStartInput(player_count=5)

    def test_too_large_rejected(self):
        """大于 10 应被拒绝"""
        from app import GameStartInput
        with pytest.raises(ValueError):
            GameStartInput(player_count=11)


class TestLoadSaveConfig:
    """测试配置加载和保存"""

    def test_load_nonexistent_config(self, tmp_path):
        """不存在的配置文件应返回空配置"""
        with patch("app.CONFIG_FILE", tmp_path / "nonexistent.json"):
            config = load_config()
            assert config == {"providers": {}}

    def test_save_and_load_config(self, tmp_path):
        """保存后应能正确加载"""
        config_file = tmp_path / "test_config.json"
        with patch("app.CONFIG_FILE", config_file):
            test_config = {
                "providers": {
                    "test": {"name": "Test", "api_key": "encrypted"}
                }
            }
            save_config(test_config)
            loaded = load_config()
            assert loaded == test_config

    def test_save_creates_file(self, tmp_path):
        """保存应创建文件"""
        config_file = tmp_path / "new_config.json"
        with patch("app.CONFIG_FILE", config_file):
            save_config({"providers": {}})
            assert config_file.exists()
