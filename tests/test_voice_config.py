"""语音配置单元测试"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from game.voice_config import (
    VoiceGender,
    VoiceStyle,
    VOICE_CONFIGS,
    get_voice_config,
    get_voice_params,
)
from game.roles import RoleType


class TestVoiceGender:
    """测试语音性别枚举"""

    def test_values(self):
        assert VoiceGender.MALE.value == "male"
        assert VoiceGender.FEMALE.value == "female"
        assert VoiceGender.NEUTRAL.value == "neutral"


class TestVoiceStyle:
    """测试语音风格枚举"""

    def test_values(self):
        assert VoiceStyle.CALM.value == "calm"
        assert VoiceStyle.CONFIDENT.value == "confident"
        assert VoiceStyle.MYSTERIOUS.value == "mysterious"
        assert VoiceStyle.AGGRESSIVE.value == "aggressive"
        assert VoiceStyle.FRIENDLY.value == "friendly"
        assert VoiceStyle.SERIOUS.value == "serious"


class TestVoiceConfigs:
    """测试角色语音配置"""

    def test_all_roles_have_config(self):
        """所有角色都应有语音配置"""
        for role in RoleType:
            assert role in VOICE_CONFIGS, f"{role} 缺少语音配置"

    def test_config_has_required_fields(self):
        """语音配置应包含所有必需字段"""
        required = {"gender", "style", "rate", "pitch", "volume", "lang", "name", "description"}
        for role, config in VOICE_CONFIGS.items():
            missing = required - set(config.keys())
            assert not missing, f"{role} 缺少字段: {missing}"

    def test_rate_in_valid_range(self):
        """语速应在有效范围内 (0.1-10)"""
        for role, config in VOICE_CONFIGS.items():
            assert 0.1 <= config["rate"] <= 10, f"{role} 语速 {config['rate']} 超出范围"

    def test_pitch_in_valid_range(self):
        """音调应在有效范围内 (0-2)"""
        for role, config in VOICE_CONFIGS.items():
            assert 0 <= config["pitch"] <= 2, f"{role} 音调 {config['pitch']} 超出范围"

    def test_volume_in_valid_range(self):
        """音量应为非负数"""
        for role, config in VOICE_CONFIGS.items():
            assert config["volume"] > 0, f"{role} 音量 {config['volume']} 应为正数"

    def test_lang_is_zh_cn(self):
        """所有角色语言应为中文"""
        for role, config in VOICE_CONFIGS.items():
            assert config["lang"] == "zh-CN", f"{role} 语言不是 zh-CN"

    def test_werewolf_is_aggressive(self):
        """狼人应为攻击性风格"""
        assert VOICE_CONFIGS[RoleType.WEREWOLF]["style"] == VoiceStyle.AGGRESSIVE

    def test_seer_is_mysterious(self):
        """预言家应为神秘风格"""
        assert VOICE_CONFIGS[RoleType.SEER]["style"] == VoiceStyle.MYSTERIOUS

    def test_villager_is_friendly(self):
        """村民应为友好风格"""
        assert VOICE_CONFIGS[RoleType.VILLAGER]["style"] == VoiceStyle.FRIENDLY


class TestGetVoiceConfig:
    """测试获取语音配置"""

    def test_get_werewolf_config(self):
        config = get_voice_config(RoleType.WEREWOLF)
        assert config["style"] == VoiceStyle.AGGRESSIVE

    def test_get_villager_config(self):
        config = get_voice_config(RoleType.VILLAGER)
        assert config["style"] == VoiceStyle.FRIENDLY


class TestGetVoiceParams:
    """测试获取语音合成参数"""

    def test_returns_required_params(self):
        """应返回所有必需的语音参数"""
        params = get_voice_params(RoleType.WEREWOLF)
        required = {"rate", "pitch", "volume", "lang"}
        assert set(params.keys()) == required

    def test_params_are_numeric_except_lang(self):
        """除 lang 外，参数应为数值类型"""
        for role in RoleType:
            params = get_voice_params(role)
            assert isinstance(params["rate"], (int, float))
            assert isinstance(params["pitch"], (int, float))
            assert isinstance(params["volume"], (int, float))
            assert isinstance(params["lang"], str)
