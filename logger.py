import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from logging.handlers import RotatingFileHandler
from typing import Optional

# 设置 Windows 控制台编码
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except (OSError, AttributeError):
        pass

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

GAME_LOG_FILE = LOG_DIR / "game.log"
ERROR_LOG_FILE = LOG_DIR / "error.log"

GAME_LOG_MAX_BYTES = 10 * 1024 * 1024
GAME_LOG_BACKUP_COUNT = 5

game_logger = logging.getLogger("game")
game_logger.setLevel(logging.DEBUG)

error_logger = logging.getLogger("game_error")
error_logger.setLevel(logging.ERROR)

if not game_logger.handlers:
    game_handler = RotatingFileHandler(
        GAME_LOG_FILE,
        maxBytes=GAME_LOG_MAX_BYTES,
        backupCount=GAME_LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    game_handler.setLevel(logging.DEBUG)
    game_formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    game_handler.setFormatter(game_formatter)
    game_logger.addHandler(game_handler)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(game_formatter)
    game_logger.addHandler(console_handler)

if not error_logger.handlers:
    error_handler = RotatingFileHandler(
        ERROR_LOG_FILE,
        maxBytes=GAME_LOG_MAX_BYTES,
        backupCount=GAME_LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    error_handler.setLevel(logging.ERROR)
    error_formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    error_handler.setFormatter(error_formatter)
    error_logger.addHandler(error_handler)

    error_console = logging.StreamHandler()
    error_console.setLevel(logging.ERROR)
    error_console.setFormatter(error_formatter)
    error_logger.addHandler(error_console)


def log_game_event(event_type: str, message: str, level: str = "INFO", **kwargs):
    """记录游戏事件，将额外字段序列化到日志消息中"""
    log_message = f"[{event_type}] {message}"
    # 将 kwargs 序列化为消息的一部分，避免 extra 字段与 formatter 不匹配
    if kwargs:
        extra_str = " | " + " ".join(f"{k}={v}" for k, v in kwargs.items())
        log_message += extra_str

    if level == "DEBUG":
        game_logger.debug(log_message)
    elif level == "WARNING":
        game_logger.warning(log_message)
        error_logger.warning(log_message)
    elif level == "ERROR":
        game_logger.error(log_message)
        error_logger.error(log_message)
    elif level == "CRITICAL":
        game_logger.critical(log_message)
        error_logger.critical(log_message)
    else:
        game_logger.info(log_message)


def log_player_action(player_name: str, action: str, details: str = ""):
    msg = f"玩家[{player_name}] {action}"
    if details:
        msg += f" - {details}"
    log_game_event("PLAYER_ACTION", msg)


def log_game_state(phase: str, round_num: int, message: str):
    log_game_event("GAME_STATE", message, phase=phase, round=round_num)


def log_ai_thinking(player_name: str, role: str, action: str):
    log_game_event("AI_THINKING", f"AI玩家[{player_name}]({role}) {action}")


def log_model_call(player_name: str, model_name: str, status: str, duration: float = None):
    msg = f"模型调用 [{model_name}] for {player_name}: {status}"
    if duration is not None:
        msg += f" ({duration:.2f}s)"
    log_game_event("MODEL_CALL", msg)


def log_error(error: Exception, context: str = "", player_name: str = ""):
    msg = f"{context}: {type(error).__name__}: {error}"
    if player_name:
        msg = f"[{player_name}] {msg}"
    game_logger.error(msg, exc_info=True)
    error_logger.error(msg, exc_info=True)


def log_warning(context: str = "", player_name: str = ""):
    msg = context
    if player_name:
        msg = f"[{player_name}] {msg}"
    game_logger.warning(msg)
    error_logger.warning(msg)


def log_game_start(game_id: str, player_count: int, play_mode: str):
    log_game_event("GAME_START", f"游戏开始 - ID:{game_id}, 人数:{player_count}, 模式:{play_mode}")


def log_game_end(game_id: str, winner: str, rounds: int):
    log_game_event("GAME_END", f"游戏结束 - ID:{game_id}, 胜利方:{winner}, 轮数:{rounds}")


def get_log_file_path() -> Path:
    return GAME_LOG_FILE


def get_error_log_file_path() -> Path:
    return ERROR_LOG_FILE
