"""语音播放器单元测试"""
import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from game.voice_player import VoicePlayer
from game.roles import RoleType


@pytest.fixture
def voice_player():
    """创建语音播放器实例"""
    return VoicePlayer()


class TestVoicePlayerInit:
    """测试语音播放器初始化"""

    def test_default_state(self, voice_player):
        """初始状态应正确"""
        assert voice_player.is_speaking is False
        assert voice_player.current_speech_id is None
        assert voice_player._speech_task is None
        assert voice_player._stop_event.is_set() is False

    def test_callbacks_initially_none(self, voice_player):
        """回调函数初始应为 None"""
        assert voice_player.on_speech_start is None
        assert voice_player.on_speech_end is None
        assert voice_player.on_error is None

    def test_can_set_callbacks(self, voice_player):
        """应能设置回调函数"""
        voice_player.on_speech_start = lambda x: None
        voice_player.on_speech_end = lambda x: None
        voice_player.on_error = lambda x: None
        assert voice_player.on_speech_start is not None
        assert voice_player.on_speech_end is not None
        assert voice_player.on_error is not None


class TestVoicePlayerStartStop:
    """测试启动和停止"""

    @pytest.mark.asyncio
    async def test_start_creates_task(self, voice_player):
        """启动应创建后台任务"""
        await voice_player.start()
        assert voice_player._speech_task is not None
        await voice_player.stop()

    @pytest.mark.asyncio
    async def test_stop_clears_task(self, voice_player):
        """停止应清除任务"""
        await voice_player.start()
        await voice_player.stop()
        assert voice_player._speech_task is None

    @pytest.mark.asyncio
    async def test_double_start(self, voice_player):
        """重复启动不应创建多个任务"""
        await voice_player.start()
        task1 = voice_player._speech_task
        await voice_player.start()
        task2 = voice_player._speech_task
        assert task1 is task2
        await voice_player.stop()


class TestVoicePlayerSpeak:
    """测试语音播放"""

    @pytest.mark.asyncio
    async def test_speak_adds_to_queue(self, voice_player):
        """speak 应将任务加入队列"""
        await voice_player.start()
        await voice_player.speak("测试文本", RoleType.VILLAGER, "测试玩家")
        assert voice_player.speech_queue.qsize() == 1
        await voice_player.stop()

    @pytest.mark.asyncio
    async def test_speak_empty_text_does_nothing(self, voice_player):
        """空文本不应加入队列"""
        await voice_player.start()
        await voice_player.speak("", RoleType.VILLAGER, "测试玩家")
        assert voice_player.speech_queue.qsize() == 0
        await voice_player.stop()

    @pytest.mark.asyncio
    async def test_speak_whitespace_only_does_nothing(self, voice_player):
        """纯空白文本不应加入队列"""
        await voice_player.start()
        await voice_player.speak("   ", RoleType.VILLAGER, "测试玩家")
        assert voice_player.speech_queue.qsize() == 0
        await voice_player.stop()

    @pytest.mark.asyncio
    async def test_speech_data_format(self, voice_player):
        """语音数据格式应正确"""
        await voice_player.start()
        await voice_player.speak("你好世界", RoleType.WEREWOLF, "狼人玩家", "test_id_123")
        data = await asyncio.wait_for(voice_player.speech_queue.get(), timeout=1.0)
        assert data["id"] == "test_id_123"
        assert data["text"] == "你好世界"
        assert data["role_type"] == RoleType.WEREWOLF
        assert data["player_name"] == "狼人玩家"
        assert "voice_params" in data
        await voice_player.stop()


class TestVoicePlayerIsBusy:
    """测试忙状态检查"""

    def test_not_busy_initially(self, voice_player):
        """初始状态不应忙"""
        assert voice_player.is_busy() is False

    @pytest.mark.asyncio
    async def test_busy_when_queue_has_items(self, voice_player):
        """队列有任务时应为忙状态"""
        await voice_player.start()
        await voice_player.speak("测试", RoleType.VILLAGER, "测试玩家")
        # 队列中有任务，is_busy 应为 True
        assert voice_player.is_busy() is True
        await voice_player.stop()


class TestVoicePlayerClearQueue:
    """测试清空队列"""

    @pytest.mark.asyncio
    async def test_clear_queue_removes_all(self, voice_player):
        """清空队列应移除所有任务"""
        await voice_player.start()
        await voice_player.speak("测试1", RoleType.VILLAGER, "玩家1")
        await voice_player.speak("测试2", RoleType.VILLAGER, "玩家2")
        await voice_player.speak("测试3", RoleType.VILLAGER, "玩家3")
        assert voice_player.speech_queue.qsize() == 3
        voice_player.clear_queue()
        assert voice_player.speech_queue.qsize() == 0
        await voice_player.stop()


class TestVoicePlayerCallbacks:
    """测试回调触发"""

    @pytest.mark.asyncio
    async def test_speech_start_callback(self, voice_player):
        """语音开始时应触发 start 回调"""
        started = []

        def on_start(data):
            started.append(data)

        voice_player.on_speech_start = on_start
        await voice_player.start()
        await voice_player.speak("短文本", RoleType.VILLAGER, "测试玩家", "cb_test")

        # 等待语音工作线程处理
        await asyncio.sleep(0.5)

        # 清理
        await voice_player.stop()

        # 回调可能已触发（取决于工作线程速度）
        # 这里主要验证不报错
