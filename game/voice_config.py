"""
语音配置模块 - 定义角色音色参数
"""
from enum import Enum
from typing import Dict
from game.roles import RoleType


class VoiceGender(str, Enum):
    """语音性别"""
    MALE = "male"
    FEMALE = "female"
    NEUTRAL = "neutral"


class VoiceStyle(str, Enum):
    """语音风格"""
    CALM = "calm"
    CONFIDENT = "confident"
    MYSTERIOUS = "mysterious"
    AGGRESSIVE = "aggressive"
    FRIENDLY = "friendly"
    SERIOUS = "serious"


# 角色音色配置
VOICE_CONFIGS: Dict[RoleType, Dict] = {
    RoleType.WEREWOLF: {
        "gender": VoiceGender.MALE,
        "style": VoiceStyle.AGGRESSIVE,
        "rate": 0.9,  # 语速 (0.1-10, 默认1)
        "pitch": 1.2,  # 音调 (0-2, 默认1)
        "volume": 1.0,  # 音量 (0-1, 默认1)
        "lang": "zh-CN",
        "name": "狼人音色",
        "description": "低沉、富有威胁性的声音"
    },
    RoleType.SEER: {
        "gender": VoiceGender.FEMALE,
        "style": VoiceStyle.MYSTERIOUS,
        "rate": 0.8,
        "pitch": 1.1,
        "volume": 0.9,
        "lang": "zh-CN",
        "name": "预言家音色",
        "description": "神秘、富有智慧的声音"
    },
    RoleType.WITCH: {
        "gender": VoiceGender.FEMALE,
        "style": VoiceStyle.CONFIDENT,
        "rate": 1.0,
        "pitch": 1.0,
        "volume": 1.0,
        "lang": "zh-CN",
        "name": "女巫音色",
        "description": "自信、略带神秘的声音"
    },
    RoleType.HUNTER: {
        "gender": VoiceGender.MALE,
        "style": VoiceStyle.CONFIDENT,
        "rate": 1.1,
        "pitch": 0.9,
        "volume": 1.1,
        "lang": "zh-CN",
        "name": "猎人音色",
        "description": "坚定、有力的声音"
    },
    RoleType.GUARD: {
        "gender": VoiceGender.MALE,
        "style": VoiceStyle.SERIOUS,
        "rate": 0.9,
        "pitch": 0.95,
        "volume": 0.95,
        "lang": "zh-CN",
        "name": "守卫音色",
        "description": "稳重、可靠的声音"
    },
    RoleType.VILLAGER: {
        "gender": VoiceGender.NEUTRAL,
        "style": VoiceStyle.FRIENDLY,
        "rate": 1.0,
        "pitch": 1.0,
        "volume": 0.9,
        "lang": "zh-CN",
        "name": "村民音色",
        "description": "普通、友好的声音"
    }
}


def get_voice_config(role_type: RoleType) -> Dict:
    """获取指定角色的语音配置"""
    return VOICE_CONFIGS.get(role_type, VOICE_CONFIGS[RoleType.VILLAGER])


def get_voice_params(role_type: RoleType) -> Dict[str, any]:
    """获取语音合成参数"""
    config = get_voice_config(role_type)
    return {
        "rate": config["rate"],
        "pitch": config["pitch"],
        "volume": config["volume"],
        "lang": config["lang"]
    }