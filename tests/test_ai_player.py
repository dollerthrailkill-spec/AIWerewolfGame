"""AI玩家解析逻辑单元测试"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from game.ai_player import AIPlayer, get_mode_config
from game.context_builder import MODE_CONFIGS
from game.roles import Player, RoleType, ROLE_INFO, ModelConfig


def _make_player(role=RoleType.VILLAGER, name="测试玩家"):
    """创建测试用 AI 玩家"""
    mc = ModelConfig(
        provider_id="test",
        model_name="test-model",
        use_default_personality=True,
    )
    player = Player(id="p1", name=name, role=role, model_config=mc)
    providers = {
        "test": {
            "id": "test",
            "name": "Test",
            "api_url": "https://api.test.com",
            "api_key": "test-key",
            "default_model": "test-model",
        }
    }
    return AIPlayer(player, providers)


class TestGetModeConfig:
    """测试游戏模式配置获取"""

    def test_six_player_mode(self):
        desc = get_mode_config(6)
        assert "狼人" in desc
        assert "预言家" in desc
        assert "女巫" in desc

    def test_eight_player_mode(self):
        desc = get_mode_config(8)
        assert "狼人" in desc
        assert "猎人" in desc

    def test_ten_player_mode(self):
        desc = get_mode_config(10)
        assert "狼人" in desc
        assert "守卫" in desc

    def test_unknown_mode(self):
        """未知人数应返回默认描述"""
        result = get_mode_config(7)
        assert "7人局" in result

    def test_mode_configs_complete(self):
        """MODE_CONFIGS 应包含所有标准人数"""
        assert 6 in MODE_CONFIGS
        assert 8 in MODE_CONFIGS
        assert 10 in MODE_CONFIGS


class TestAIPlayerParseTarget:
    """测试目标解析"""

    def test_direct_name_match(self):
        """直接包含玩家名应匹配"""
        ai = _make_player()
        result = ai._parse_target("我认为应该投给张三", ["张三", "李四", "王五"])
        assert result == "张三"

    def test_first_target_fallback(self):
        """无匹配时应随机返回一个有效目标"""
        ai = _make_player()
        result = ai._parse_target("随便吧", ["张三", "李四"])
        assert result in ["张三", "李四"]

    def test_empty_targets(self):
        """空目标列表应返回 None"""
        ai = _make_player()
        result = ai._parse_target("投给张三", [])
        assert result is None

    def test_colon_format(self):
        """冒号格式应正确解析"""
        ai = _make_player()
        result = ai._parse_target("投票：张三\n理由：他很可疑", ["张三", "李四"])
        assert result == "张三"

    def test_colon_format_with_brackets(self):
        """带括号格式应正确解析"""
        ai = _make_player()
        result = ai._parse_target("投票：【张三】\n理由：他很可疑", ["张三", "李四"])
        assert result == "张三"

    def test_choose_format(self):
        """'选择 XX'格式应正确解析"""
        ai = _make_player()
        result = ai._parse_target("我选择 李四 作为目标", ["张三", "李四", "王五"])
        assert result == "李四"

    def test_multiple_names_in_response(self):
        """响应包含多个名字时，应返回第一个匹配的"""
        ai = _make_player()
        result = ai._parse_target("我觉得李四和王五都可疑，投给李四", ["张三", "李四", "王五"])
        assert result == "李四"

    def test_json_format_target(self):
        """JSON 格式应正确解析目标"""
        ai = _make_player()
        result = ai._parse_target('{"action": "kill", "target": "张三", "reason": "可疑"}', ["张三", "李四"])
        assert result == "张三"

    def test_json_format_with_extra_text(self):
        """JSON 嵌入文本中应正确解析"""
        ai = _make_player()
        result = ai._parse_target('分析后决定：{"action": "vote", "target": "李四", "reason": "发言矛盾"}', ["张三", "李四"])
        assert result == "李四"


class TestAIPlayerParseWitchAction:
    """测试女巫行为解析"""

    def test_use_antidote(self):
        """使用解药应被正确解析"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            "我要使用解药救活他", "张三", True, True, ["李四", "王五"]
        )
        assert result["save"] is True
        assert result["poison"] is None

    def test_use_poison(self):
        """使用毒药应被正确解析"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            "我要使用毒药毒杀李四", "张三", True, True, ["李四", "王五"]
        )
        assert result["save"] is False
        assert result["poison"] == "李四"

    def test_use_both_save_priority(self):
        """同时使用救药和毒药时优先救人"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            "我要使用解药救人，同时使用毒药毒杀李四",
            "张三", True, True, ["李四", "王五"]
        )
        assert result["save"] is True
        assert result["poison"] is None

    def test_no_action(self):
        """不采取任何行动"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            "今晚我什么也不做", "张三", True, True, ["李四", "王五"]
        )
        assert result["save"] is False
        assert result["poison"] is None

    def test_no_antidote_available(self):
        """没有解药时不应救人"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            "我要使用解药救活他", "张三", False, True, ["李四", "王五"]
        )
        assert result["save"] is False

    def test_no_poison_available(self):
        """没有毒药时不应毒人"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            "我要使用毒药毒杀李四", "张三", True, False, ["李四", "王五"]
        )
        assert result["poison"] is None

    def test_negative_save_not_matched(self):
        """'不救'（无其他关键词）不应被解析为救人"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            "不救", "张三", True, True, ["李四", "王五"]
        )
        assert result["save"] is False

    def test_negative_poison_not_matched(self):
        """'不毒'不应被解析为毒人"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            "我不毒李四", "张三", True, True, ["李四", "王五"]
        )
        assert result["poison"] is None

    def test_jiu_keyword_without_negation(self):
        """单独的'救'字应被解析为救人"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            "救", "张三", True, True, ["李四", "王五"]
        )
        assert result["save"] is True

    def test_poison_keyword_format(self):
        """'毒杀：XX'格式应正确解析"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            "毒杀：李四", "张三", True, True, ["李四", "王五"]
        )
        assert result["poison"] == "李四"

    def test_json_save(self):
        """JSON 格式救人应正确解析"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            '{"action": "save", "target": "张三", "reason": "必须救"}', "张三", True, True, ["李四", "王五"]
        )
        assert result["save"] is True
        assert result["poison"] is None

    def test_json_poison(self):
        """JSON 格式毒人应正确解析"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            '{"action": "poison", "target": "李四", "reason": "他是狼"}', "张三", True, True, ["李四", "王五"]
        )
        assert result["save"] is False
        assert result["poison"] == "李四"

    def test_json_none(self):
        """JSON 格式不行动应正确解析"""
        ai = _make_player(RoleType.WITCH)
        result = ai._parse_witch_action(
            '{"action": "none", "reason": "先观望"}', "张三", True, True, ["李四", "王五"]
        )
        assert result["save"] is False
        assert result["poison"] is None


class TestAIPlayerPersonality:
    """测试人格获取"""

    def test_default_personality(self):
        """默认应使用角色预设人格"""
        ai = _make_player(RoleType.WEREWOLF)
        personality = ai._get_personality()
        assert personality == ROLE_INFO[RoleType.WEREWOLF]["default_personality"]

    def test_custom_personality(self):
        """自定义人格应覆盖默认"""
        mc = ModelConfig(
            provider_id="test",
            model_name="test-model",
            personality="自定义人格",
            use_default_personality=False,
        )
        player = Player(id="p1", name="测试", role=RoleType.VILLAGER, model_config=mc)
        providers = {
            "test": {"api_key": "key", "api_url": "https://test.com", "id": "test"},
        }
        ai = AIPlayer(player, providers)
        assert ai._get_personality() == "自定义人格"

    def test_empty_custom_uses_default(self):
        """空自定义人格应回退到默认"""
        mc = ModelConfig(
            provider_id="test",
            model_name="test-model",
            personality="",
            use_default_personality=True,
        )
        player = Player(id="p1", name="测试", role=RoleType.SEER, model_config=mc)
        providers = {
            "test": {"api_key": "key", "api_url": "https://test.com", "id": "test"},
        }
        ai = AIPlayer(player, providers)
        assert ai._get_personality() == ROLE_INFO[RoleType.SEER]["default_personality"]


class TestAIPlayerClientConfig:
    """测试客户端配置获取"""

    def test_get_valid_provider(self):
        """应返回有效的 provider"""
        ai = _make_player()
        provider, pid = ai._get_client_config()
        assert provider is not None
        assert pid == "test"

    def test_no_providers(self):
        """无 provider 时应返回 None"""
        player = Player(id="p1", name="测试", role=RoleType.VILLAGER)
        ai = AIPlayer(player, {})
        provider, pid = ai._get_client_config()
        assert provider is None
        assert pid is None

    def test_provider_missing_api_key(self):
        """缺少 api_key 的 provider 应被跳过"""
        mc = ModelConfig(provider_id="bad")
        player = Player(id="p1", name="测试", role=RoleType.VILLAGER, model_config=mc)
        providers = {
            "bad": {"id": "bad", "api_url": "", "api_key": ""},
        }
        ai = AIPlayer(player, providers)
        provider, pid = ai._get_client_config()
        assert provider is None

    def test_fallback_to_first_available(self):
        """指定 provider 不可用时应回退到第一个可用 provider"""
        mc = ModelConfig(provider_id="nonexistent")
        player = Player(id="p1", name="测试", role=RoleType.VILLAGER, model_config=mc)
        providers = {
            "fallback": {"id": "fallback", "api_url": "https://test.com", "api_key": "key"},
        }
        ai = AIPlayer(player, providers)
        provider, pid = ai._get_client_config()
        assert provider is not None
        assert pid == "fallback"
