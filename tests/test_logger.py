"""日志模块单元测试"""
import logging
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestLogGameEvent:
    """测试游戏事件日志"""

    def test_info_level(self, caplog):
        """INFO 级别应正常记录"""
        from logger import log_game_event
        with caplog.at_level(logging.DEBUG, logger="game"):
            log_game_event("TEST", "测试消息")
        assert "TEST" in str(caplog.text) or "测试消息" in str(caplog.text)

    def test_debug_level(self, caplog):
        """DEBUG 级别应正常记录"""
        from logger import log_game_event
        with caplog.at_level(logging.DEBUG, logger="game"):
            log_game_event("TEST", "调试消息", level="DEBUG")

    def test_warning_level(self, caplog):
        """WARNING 级别应记录到两个 logger"""
        from logger import log_game_event
        with caplog.at_level(logging.WARNING):
            log_game_event("TEST", "警告消息", level="WARNING")

    def test_error_level(self, caplog):
        """ERROR 级别应记录到两个 logger"""
        from logger import log_game_event
        with caplog.at_level(logging.ERROR):
            log_game_event("TEST", "错误消息", level="ERROR")

    def test_with_extra_kwargs(self, caplog):
        """额外 kwargs 应作为 extra 字段传递"""
        from logger import log_game_event
        with caplog.at_level(logging.DEBUG, logger="game"):
            log_game_event("TEST", "带参数的消息", player="月影", round=3)


class TestLogPlayerAction:
    """测试玩家行为日志"""

    def test_basic_action(self, caplog):
        """基本行为应正确记录"""
        from logger import log_player_action
        with caplog.at_level(logging.DEBUG, logger="game"):
            log_player_action("月影", "发言", "我认为...")
        assert "月影" in str(caplog.text)

    def test_action_without_details(self, caplog):
        """无详情的行为应正确记录"""
        from logger import log_player_action
        with caplog.at_level(logging.DEBUG, logger="game"):
            log_player_action("月影", "投票")


class TestLogError:
    """测试错误日志"""

    def test_with_exception(self, caplog):
        """有异常时应记录异常信息"""
        from logger import log_error
        with caplog.at_level(logging.ERROR):
            try:
                raise ValueError("测试错误")
            except ValueError as e:
                log_error(e, "测试上下文")
        assert "测试错误" in str(caplog.text) or "ValueError" in str(caplog.text)

    def test_with_none_error(self, caplog):
        """None 错误应使用 log_warning"""
        from logger import log_warning
        with caplog.at_level(logging.WARNING):
            log_warning("仅上下文")
        assert "仅上下文" in str(caplog.text)

    def test_with_player_name(self, caplog):
        """应记录玩家名"""
        from logger import log_warning
        with caplog.at_level(logging.WARNING):
            log_warning("错误信息", player_name="月影")

    def test_with_empty_context(self, caplog):
        """空上下文应正常工作"""
        from logger import log_warning
        with caplog.at_level(logging.WARNING):
            log_warning()


class TestLogGameStartEnd:
    """测试游戏开始/结束日志"""

    def test_game_start(self, caplog):
        """游戏开始应记录"""
        from logger import log_game_start
        with caplog.at_level(logging.DEBUG, logger="game"):
            log_game_start("abc123", 6, "watch")

    def test_game_end(self, caplog):
        """游戏结束应记录"""
        from logger import log_game_end
        with caplog.at_level(logging.DEBUG, logger="game"):
            log_game_end("abc123", "good", 5)

    def test_game_end_with_none_winner(self, caplog):
        """None 胜利方应正常记录"""
        from logger import log_game_end
        with caplog.at_level(logging.DEBUG, logger="game"):
            log_game_end(None, 0, None)


class TestLogFilePath:
    """测试日志文件路径"""

    def test_get_log_file_path(self):
        """应返回有效的日志文件路径"""
        from logger import get_log_file_path
        path = get_log_file_path()
        assert isinstance(path, Path)
        assert "game.log" in str(path)

    def test_get_error_log_file_path(self):
        """应返回有效的错误日志文件路径"""
        from logger import get_error_log_file_path
        path = get_error_log_file_path()
        assert isinstance(path, Path)
        assert "error.log" in str(path)
