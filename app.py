import os
import json
import re
import asyncio
import logging
import secrets
import time
from datetime import datetime, date
from pathlib import Path
from typing import Optional
from collections import defaultdict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Query, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel, Field, field_validator

# 从环境变量读取允许的 CORS 源，逗号分隔；默认允许本地开发
_ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "")
CORS_ORIGINS = [s.strip() for s in _ALLOWED_ORIGINS.split(",") if s.strip()] if _ALLOWED_ORIGINS else ["http://localhost:*", "http://127.0.0.1:*"]

# 检测是否为生产环境（通过环境变量 IS_PRODUCTION 或 DEPLOY_ENV 判断）
_IS_PRODUCTION = os.environ.get("IS_PRODUCTION", "").lower() in ("true", "1", "yes") or os.environ.get("DEPLOY_ENV", "") == "production"

if _IS_PRODUCTION and not _ALLOWED_ORIGINS:
    import warnings
    warnings.warn(
        "生产环境下未配置 ALLOWED_ORIGINS，CORS 将拒绝所有请求。"
        "请设置 ALLOWED_ORIGINS 环境变量（逗号分隔的允许源列表）。",
        RuntimeWarning
    )
    # 生产环境下默认拒绝所有源，必须显式配置
    CORS_ORIGINS = []


from game_manager import game_manager, RoomState
from game.text_utils import filter_think_process
from game.config import (
    LLM_THINKING_TIMEOUT,
    LLM_THINKING_MODEL_KEYWORDS,
)
from game.error_handler import safe_execute, handle_api_error
from crypto import encrypt_api_key, decrypt_api_key, mask_api_key, _safe_decrypt_api_key, _is_encrypted_key
from game.engine import GameEngine
from game.roles import GAME_CONFIGS, ROLE_INFO, RoleType
from logger import log_game_event, log_game_start, log_game_end, log_error, log_warning

logger = logging.getLogger(__name__)
from db import db
from exam import (
    get_exam_questions, 
    get_question_by_id, 
    evaluate_answer,
    ExamQuestion,
    ExamAnswerRequest,
    ExamAnswerResponse,
    ExamResult,
    get_all_exam_files,
    get_exam_questions_by_file,
    save_uploaded_file,
    get_question_by_file_and_id
)

app = FastAPI(title="AI 狼人杀", description="AI 驱动的狼人杀游戏，支持 6/8/10 人局，所有玩家均由大语言模型驱动。")

# CORS 配置：通过环境变量 ALLOWED_ORIGINS 控制允许的源
# 例如: ALLOWED_ORIGINS="https://example.com,https://app.example.com"
# 未设置时默认允许本地开发环境
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== 简单的内存速率限制器 ====================

class RateLimiter:
    """基于滑动窗口的内存速率限制器，按客户端 IP 限流"""

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # {ip: [timestamp, ...]}
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        # 清理过期记录
        self._requests[client_ip] = [
            t for t in self._requests[client_ip]
            if now - t < self.window_seconds
        ]
        if len(self._requests[client_ip]) >= self.max_requests:
            return False
        self._requests[client_ip].append(now)
        return True


# 全局限流实例：API 端点每分钟最多 30 次请求
api_rate_limiter = RateLimiter(max_requests=30, window_seconds=60)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """对 API 请求进行速率限制，静态资源和 WebSocket 升级请求豁免"""
    path = request.url.path
    if path.startswith("/static") or path == "/ws" or path == "/" or path.startswith("/api/exam/"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    if not api_rate_limiter.is_allowed(client_ip):
        return JSONResponse(
            status_code=429,
            content={"success": False, "message": "请求过于频繁，请稍后再试"},
            headers={"Retry-After": "60"},
        )
    return await call_next(request)

# 简单的 WebSocket 连接令牌（通过环境变量设置，未设置时不验证）
WS_AUTH_TOKEN = os.environ.get("WS_AUTH_TOKEN", "")

if _IS_PRODUCTION and not WS_AUTH_TOKEN:
    import warnings
    warnings.warn(
        "生产环境下未设置 WS_AUTH_TOKEN，WebSocket 连接将不验证身份。"
        "请设置 WS_AUTH_TOKEN 环境变量以增强安全性。",
        RuntimeWarning
    )

DATA_DIR = Path(__file__).parent / "data"
CONFIG_FILE = DATA_DIR / "config.json"
DATA_DIR.mkdir(exist_ok=True)


# 向后兼容的全局游戏状态实例（指向默认房间）
game_state = game_manager.get_or_create_room("default")


async def cleanup_game(room_id: str = "default"):
    """统一的游戏清理函数，避免代码重复

    安全地停止正在运行的游戏，清理所有相关资源。
    可在 stop_game 消息处理和 WebSocket 断连时复用。
    """
    await game_manager.cleanup_room(room_id)


async def broadcast_fn(message: dict, room_id: str = "default"):
    """向后兼容的广播函数，内部使用 safe_broadcast"""
    safe_broadcast(message, room_id)


def safe_broadcast(message: dict, room_id: str = "default") -> Optional[asyncio.Task]:
    """安全地广播消息到前端，返回任务引用以便跟踪

    替代直接使用 asyncio.create_task，确保广播任务被正确跟踪和管理。
    """
    room = game_manager.get_room(room_id)
    if room and room.connected_clients:
        try:
            loop = asyncio.get_running_loop()
            task = loop.create_task(room.broadcast(message))
            return task
        except Exception as e:
            log_error(e, context="广播消息失败")
    return None


def _save_game_to_db(game: GameEngine):
    """将游戏结果保存到数据库（在后台线程执行，不阻塞事件循环）

    使用事务保证 game_records、player_game_stats 的写入原子性。
    """
    if not game or not hasattr(game, 'winner') or not game.winner:
        return
    try:
        # 准备游戏数据
        game_data = {
            "speech_by_round": getattr(game, 'speech_by_round', []),
            "night_log": getattr(game, 'night_log', []),
            "death_log": getattr(game, 'death_log', []),
        }
        mvp_name = getattr(game, 'mvp', None)

        # 准备玩家数据
        players_data = []
        for p in game.players:
            speech_count = 0
            for sl in getattr(game, 'speech_by_round', []):
                if sl.get('player') == p.name:
                    speech_count += 1

            death_round = None
            death_cause = None
            if hasattr(game, 'death_log'):
                for dl in game.death_log:
                    if dl.get('name') == p.name:
                        death_round = dl.get('round')
                        death_cause = dl.get('cause')
                        break

            model_name = ""
            if hasattr(p, 'model_config') and p.model_config:
                model_name = getattr(p.model_config, 'model_name', '') or ""

            players_data.append({
                "id": p.id,
                "name": p.name,
                "role": p.role.value if p.role else "",
                "team": p.team or ("wolf" if p.role == RoleType.WEREWOLF else "good"),
                "is_alive": p.is_alive,
                "is_mvp": p.name == mvp_name if mvp_name else False,
                "speech_count": speech_count,
                "vote_target": None,
                "death_round": death_round,
                "death_cause": death_cause,
                "model": model_name,
            })

        # 使用事务原子写入游戏记录 + 玩家数据
        _save_game_and_players_atomic(game, game_data, players_data)

        # 检查成就（在事务外，失败不影响核心数据）
        _check_achievements(game)

        logger.info("Game %s saved to database", game.game_id)
    except Exception as e:
        log_error(e, context="保存游戏数据到数据库失败")


def _save_game_and_players_atomic(game: GameEngine, game_data: dict, players_data: list):
    """原子性地保存游戏记录和玩家数据"""
    ended_at = datetime.now().isoformat()
    duration = 0
    started_at = game.started_at if hasattr(game, 'started_at') else ended_at
    try:
        start_dt = datetime.fromisoformat(started_at)
        end_dt = datetime.fromisoformat(ended_at)
        duration = (end_dt - start_dt).total_seconds()
    except (ValueError, TypeError):
        pass

    # 构建事务操作列表
    operations = []

    # 1. 插入游戏记录
    game_sql = """
        INSERT INTO game_records (game_id, player_count, winner, round, started_at, ended_at, duration_seconds, game_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    game_params = (game.game_id, len(game.players), game.winner, game.round,
                   started_at, ended_at, duration, json.dumps(game_data, ensure_ascii=False))
    operations.append((game_sql, game_params))

    # 2. 插入每个玩家的数据
    for p in players_data:
        player_sql = """
            INSERT INTO player_game_stats
            (game_id, player_id, player_name, role, team, is_alive, is_mvp,
             speech_count, vote_target, death_round, death_cause, model)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        player_params = (
            game.game_id, p["id"], p["name"], p["role"], p["team"],
            1 if p["is_alive"] else 0, 1 if p["is_mvp"] else 0,
            p["speech_count"], p["vote_target"], p["death_round"],
            p["death_cause"], p["model"],
        )
        operations.append((player_sql, player_params))

    # 在单个事务中执行所有操作
    db.exec_in_transaction(operations)


def _check_achievements(game: GameEngine):
    """检查并解锁成就 - 使用增量更新避免重复计算"""
    try:
        unlocked = db.get_unlocked_achievement_ids()

        # 增量统计：只基于当前游戏结果更新
        is_good_win = game.winner == "good"
        is_wolf_win = game.winner == "wolf"
        
        # 基础胜场统计
        if is_good_win:
            db.unlock_achievement("guardian", game.game_id)
            # 检查幸存者成就
            alive_good_players = [p for p in game.players if p.is_alive and p.role != RoleType.WEREWOLF]
            if alive_good_players:
                db.unlock_achievement("survive_win", game.game_id)
            # 完美胜利：好人阵营全员存活
            all_good_alive = all(p.is_alive for p in game.players
                                 if p.role and p.role != RoleType.WEREWOLF)
            if all_good_alive:
                db.unlock_achievement("perfect_good_win", game.game_id)
        
        if is_wolf_win:
            db.unlock_achievement("wolf_king", game.game_id)

        # 快速游戏：5轮内结束
        if game.round <= 5:
            db.unlock_achievement("speed_demon", game.game_id)

        # 检查总胜场数成就
        total_wins = db.get_wins_by_team()
        total_wins_count = total_wins["good"] + total_wins["wolf"]
        if total_wins_count >= 1 and "first_win" not in unlocked:
            db.unlock_achievement("first_win", game.game_id)
        if total_wins_count >= 10 and "ten_wins" not in unlocked:
            db.unlock_achievement("ten_wins", game.game_id)
        if total_wins_count >= 50 and "fifty_wins" not in unlocked:
            db.unlock_achievement("fifty_wins", game.game_id)

        # MVP 成就
        mvp_rankings = db.get_mvp_rankings(100)
        total_mvp = sum(m["count"] for m in mvp_rankings)
        if total_mvp >= 1 and "mvp_star" not in unlocked:
            db.unlock_achievement("mvp_star", game.game_id)
        if total_mvp >= 5 and "mvp_legend" not in unlocked:
            db.unlock_achievement("mvp_legend", game.game_id)

        # 模式探索者
        wins_by_mode = db.get_wins_by_mode()
        good_modes = len([k for k, v in wins_by_mode.items() if v > 0])
        if good_modes >= 3 and "mode_explorer" not in unlocked:
            db.unlock_achievement("mode_explorer", game.game_id)

        # 角色大师
        wins_by_role = db.get_wins_by_role()
        if len(wins_by_role) >= 6 and "role_master" not in unlocked:
            db.unlock_achievement("role_master", game.game_id)

        # 首杀成就
        kill_stats = db.get_kill_stats()
        if kill_stats["total_deaths"] > 0 and "first_blood" not in unlocked:
            db.unlock_achievement("first_blood", game.game_id)

    except Exception as e:
        log_error(e, context="检查成就失败")


def load_config() -> dict:
    """加载配置文件，返回配置字典"""
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"providers": {}}


def save_config(config: dict) -> None:
    """保存配置到文件"""
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


class ProviderInput(BaseModel):
    id: str = ""
    name: str = ""
    api_url: str = ""
    api_key: str = ""
    default_model: str = ""
    used_models: list[str] = []

    @field_validator('api_url')
    @classmethod
    def validate_api_url(cls, v: str) -> str:
        v = v.strip()
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('API URL 必须以 http:// 或 https:// 开头')
        return v

    @field_validator('id')
    @classmethod
    def validate_id(cls, v: str) -> str:
        v = v.strip()
        if v and not re.match(r'^[a-zA-Z0-9_\-]+$', v):
            raise ValueError('Provider ID 只能包含字母、数字、下划线和连字符')
        return v


class PlayerConfigInput(BaseModel):
    """单个玩家配置的验证模型"""
    name: str = Field(default="", max_length=20)
    provider_id: str = Field(default="", max_length=100)
    model_name: str = Field(default="", max_length=100)
    personality: str = Field(default="", max_length=2000)
    use_default_personality: bool = True
    role: str = Field(default="", max_length=20)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if v and not re.match(r'^[\u4e00-\u9fff\w\s\-]+$', v):
            raise ValueError('玩家名称只能包含中文、字母、数字、下划线、连字符和空格')
        return v

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        v = v.strip()
        if v:
            valid_roles = {'werewolf', 'werewolf2', 'werewolf3', 'seer', 'witch',
                          'hunter', 'guard', 'villager', 'villager2', 'villager3'}
            if v not in valid_roles:
                raise ValueError(f'无效的角色: {v}')
        return v


class GameStartInput(BaseModel):
    player_count: int = Field(default=6, ge=6, le=10)
    player_configs: list[PlayerConfigInput] = []


@app.get("/", summary="主页", description="返回游戏主页 HTML，首次访问时显示 API 配置引导")
async def index():
    static_path = Path(__file__).parent / "static" / "index.html"
    if static_path.exists():
        return FileResponse(str(static_path))
    return {"message": "AI 狼人杀服务运行中，请确保 static/index.html 存在"}


@app.get("/health", summary="健康检查", description="返回服务健康状态")
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
    }


# 挂载静态文件目录
app.mount("/static", StaticFiles(directory=str(Path(__file__).parent / "static")), name="static")




@app.get("/api/config", summary="获取供应商配置", description="返回所有已配置的模型供应商信息（API Key 已脱敏）")
async def get_config():
    config = load_config()
    safe_providers = {}
    for pid, prov in config.get("providers", {}).items():
        encrypted_key = prov.get("api_key", "")
        decrypted_key = decrypt_api_key(encrypted_key)
        safe_providers[pid] = {
            "id": prov.get("id", pid),
            "name": prov.get("name", ""),
            "api_url": prov.get("api_url", ""),
            "api_key": mask_api_key(decrypted_key),  # 用于显示的脱敏 key
            "encrypted_api_key": encrypted_key,  # 用于保存的原始加密 key
            "default_model": prov.get("default_model", ""),
            "used_models": prov.get("used_models", []),
        }
    return {"providers": safe_providers}


@app.post("/api/config/test-provider", summary="测试供应商连接", description="向指定供应商发送测试请求，验证 API Key 和 URL 是否可用")
async def test_provider(provider: ProviderInput):
    # 解密API Key（使用安全的方式判断是否为加密格式）
    api_key = _safe_decrypt_api_key(provider.api_key)

    base_url = provider.api_url.rstrip("/")
    if not base_url.endswith("/v1"):
        base_url += "/v1"

    url = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"}

    model = provider.default_model or "gpt-3.5-turbo"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                return {"success": True, "message": "连接成功", "response": resp.json()}
            else:
                return {"success": False, "message": f"连接失败：{resp.status_code}", "error": resp.text}
    except Exception as e:
        return {"success": False, "message": f"连接错误：{str(e)}"}


@app.post("/api/config/list-models", summary="获取模型列表", description="从指定供应商获取可用的模型列表")
async def list_models(provider: ProviderInput):
    # 解密API Key（使用安全的方式）
    api_key = _safe_decrypt_api_key(provider.api_key)

    base_url = provider.api_url.rstrip("/")
    if not base_url.endswith("/v1"):
        base_url += "/v1"
    
    url = f"{base_url}/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                result = resp.json()
                models = []
                if isinstance(result, dict) and "data" in result:
                    models = [model["id"] for model in result["data"]]
                return {"success": True, "models": models}
            else:
                return {"success": False, "message": f"获取模型列表失败：{resp.status_code}", "error": resp.text}
    except Exception as e:
        return {"success": False, "message": f"获取模型列表错误：{str(e)}"}


@app.post("/api/config/provider", summary="保存供应商配置", description="创建或更新模型供应商配置（API Key 会自动加密存储）")
async def save_provider(provider: ProviderInput):
    config = load_config()
    if not provider.id:
        provider.id = f"provider_{int(datetime.now().timestamp())}"
    
    # 判断 api_key 是否已经是加密格式
    # 优先通过 enc: 前缀判断，避免双重加密
    api_key_to_save = provider.api_key
    if not _is_encrypted_key(provider.api_key):
        # 不是加密格式，需要加密
        api_key_to_save = encrypt_api_key(provider.api_key)
    else:
        # 已经是加密格式，直接存储原始值
        api_key_to_save = provider.api_key
    
    config["providers"][provider.id] = {
        "id": provider.id,
        "name": provider.name,
        "api_url": provider.api_url,
        "api_key": api_key_to_save,
        "default_model": provider.default_model,
        "used_models": provider.used_models,
    }
    save_config(config)
    return {"success": True, "provider_id": provider.id}


@app.delete("/api/config/provider/{provider_id}", summary="删除供应商", description="删除指定的模型供应商配置")
async def delete_provider(provider_id: str):
    config = load_config()
    if provider_id in config["providers"]:
        del config["providers"][provider_id]
        save_config(config)
        return {"success": True}
    return {"success": False, "message": "Provider not found"}


@app.get("/api/game-configs", summary="获取游戏配置", description="返回所有可用的游戏模式配置（6人/8人/10人局的角色分配）")
async def get_game_configs():
    configs = []
    for player_count, config in GAME_CONFIGS.items():
        configs.append({
            "player_count": player_count,
            "roles": [role.value for role in config["roles"]],
            "description": config["description"],
        })
    return configs


@app.get("/api/game-status", summary="获取游戏状态", description="返回当前是否有游戏正在进行，以及游戏状态摘要")
async def get_game_status():
    if game_state.current_game:
        return {"running": True, "state": game_state.current_game.get_state_summary()}
    return {"running": False}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(""), room_id: str = Query("default")):
    if WS_AUTH_TOKEN and not secrets.compare_digest(token, WS_AUTH_TOKEN):
        await ws.close(code=4001, reason="认证失败：无效的连接令牌")
        return

    await ws.accept()

    room = game_manager.get_or_create_room(room_id)
    room.connected_clients.add(ws)
    room.game_paused = False
    room.pause_event = asyncio.Event()
    room.pause_event.set()
    
    try:
        while True:
            data = await ws.receive_text()

            try:
                msg = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                await room.broadcast({"type": "error", "message": "无效的消息格式"})
                continue

            if not isinstance(msg, dict) or not msg.get("type"):
                await room.broadcast({"type": "error", "message": "消息缺少 type 字段"})
                continue

            msg_type = msg.get("type")

            if msg_type == "start_game":
                if room.current_game:
                    await room.broadcast({"type": "error", "message": "游戏正在进行中"})
                    continue

                player_count = msg.get("player_count", 6)
                if not isinstance(player_count, int) or player_count < 6 or player_count > 10:
                    await room.broadcast({"type": "error", "message": "玩家人数必须在 6-10 之间"})
                    continue

                player_configs = msg.get("player_configs", [])
                if not isinstance(player_configs, list):
                    await room.broadcast({"type": "error", "message": "player_configs 必须是数组"})
                    continue

                validated_configs = []
                configs_valid = True
                for idx, pc in enumerate(player_configs):
                    if not isinstance(pc, dict):
                        await room.broadcast({
                            "type": "error",
                            "message": f"player_configs[{idx}] 必须是对象"
                        })
                        configs_valid = False
                        break
                    for field_name in ("name", "provider_id", "model_name", "personality", "role"):
                        if field_name in pc and not isinstance(pc[field_name], str):
                            await room.broadcast({
                                "type": "error",
                                "message": f"player_configs[{idx}].{field_name} 必须是字符串"
                            })
                            configs_valid = False
                            break
                    if not configs_valid:
                        break
                    if len(pc.get("name", "")) > 20:
                        await room.broadcast({
                            "type": "error",
                            "message": f"player_configs[{idx}].name 长度不能超过 20"
                        })
                        configs_valid = False
                        break
                    if len(pc.get("personality", "")) > 2000:
                        await room.broadcast({
                            "type": "error",
                            "message": f"player_configs[{idx}].personality 长度不能超过 2000"
                        })
                        configs_valid = False
                        break
                    if not isinstance(pc.get("use_default_personality", True), bool):
                        await room.broadcast({
                            "type": "error",
                            "message": f"player_configs[{idx}].use_default_personality 必须是布尔值"
                        })
                        configs_valid = False
                        break
                    validated_configs.append(pc)

                if not configs_valid:
                    continue
                player_configs = validated_configs

                config = load_config()
                providers = config.get("providers", {})
                if not providers:
                    await room.broadcast({
                        "type": "error",
                        "message": "请先配置至少一个模型供应商（API Key 和 API URL）"
                    })
                    continue
                
                valid_providers = {}
                for pid, prov in providers.items():
                    encrypted_key = prov.get("api_key", "")
                    api_key = decrypt_api_key(encrypted_key)
                    api_url = prov.get("api_url", "")
                    
                    if api_key and api_url:
                        valid_providers[pid] = {
                            "id": pid,
                            "name": prov.get("name", ""),
                            "api_key": api_key,
                            "api_url": api_url,
                            "default_model": prov.get("default_model", "gpt-3.5-turbo"),
                            "used_models": prov.get("used_models", [])
                        }
                
                if not valid_providers:
                    await room.broadcast({
                        "type": "error",
                        "message": "所有供应商配置不完整，请检查 API Key 和 API URL"
                    })
                    continue
                
                room.current_game = GameEngine(player_count, player_configs, valid_providers)
                room.current_game.set_broadcast(lambda msg: room.broadcast(msg))
                room.current_game.set_pause_control(
                    pause_check=lambda: room.game_paused,
                    pause_event=room.pause_event
                )
                log_game_start(room.current_game.game_id, player_count, "watch")
                
                async def game_runner():
                    current_game = room.current_game
                    try:
                        await current_game.run()
                    except asyncio.CancelledError:
                        pass
                    except Exception as e:
                        log_error(e, context="游戏运行错误")
                    finally:
                        if current_game and current_game.winner:
                            await asyncio.to_thread(_save_game_to_db, current_game)
                        room.game_task = None
                        room.current_game = None
                        room.game_paused = False
                        if room.pause_event:
                            room.pause_event.set()
                
                room.game_task = asyncio.create_task(game_runner())
                
            elif msg_type == "stop_game":
                await cleanup_game(room_id)
                safe_broadcast({"type": "game_stopped", "message": "游戏已停止"}, room_id)

            elif msg_type == "pause_game":
                if room.current_game and not room.game_paused:
                    room.game_paused = True
                    if room.pause_event:
                        room.pause_event.clear()
                    safe_broadcast({"type": "game_paused", "message": "游戏已暂停"}, room_id)

            elif msg_type == "resume_game":
                if room.current_game and room.game_paused:
                    room.game_paused = False
                    if room.pause_event:
                        room.pause_event.set()
                    safe_broadcast({"type": "game_resumed", "message": "游戏已继续"}, room_id)

            elif msg_type == "ready_for_next":
                if room.current_game and room.pause_event and room.game_paused:
                    room.pause_event.set()

            elif msg_type == "vote":
                safe_broadcast({
                    "type": "error",
                    "message": "投票功能当前由 AI 自动完成，暂不支持手动投票"
                }, room_id)

            else:
                safe_broadcast({"type": "error", "message": f"未知的消息类型: {msg_type}"}, room_id)

    except WebSocketDisconnect:
        log_warning(context="WebSocket 连接断开")
    except Exception as e:
        log_error(e, context="WebSocket 处理异常")
    finally:
        room.connected_clients.discard(ws)
        if not room.connected_clients:
            try:
                task = asyncio.create_task(cleanup_game(room_id))
            except RuntimeError:
                pass


# ==================== 考试API ====================

@app.get("/api/exam/files", summary="获取题库文件列表", description="返回所有已上传的题库文件名称")
async def get_exam_file_list():
    try:
        files = get_all_exam_files()
        return {
            "success": True,
            "files": files
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }


@app.get("/api/exam/questions", summary="获取考试题目", description="获取所有考试题目列表（不含答案），可通过 file_name 参数指定题库文件")
async def get_questions(file_name: str = None):
    try:
        if file_name:
            questions = get_exam_questions_by_file(file_name)
        else:
            questions = get_exam_questions()
        
        return {
            "success": True,
            "questions": [
                {"id": q.id, "question": q.question}
                for q in questions
            ]
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }


@app.post("/api/exam/upload", summary="上传题库文件", description="上传新的题库文件（仅支持 .txt 格式，最大 1MB），上传后自动解析题目")
async def upload_exam_file(file: UploadFile = File(...)):
    try:
        content = await file.read()
        # save_uploaded_file 返回 UUID 格式的安全文件名
        saved_name = save_uploaded_file(file.filename, content)
        
        # 清除该文件的缓存，确保解析最新内容
        clear_question_cache(saved_name)

        # 使用保存后的安全文件名解析题目
        questions = get_exam_questions_by_file(saved_name)

        return {
            "success": True,
            "message": f"上传成功！共 {len(questions)} 道题",
            "file_name": saved_name,
            "original_name": file.filename,
            "question_count": len(questions)
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }


@app.get("/api/exam/question/{question_id}", summary="获取单个题目", description="根据题目 ID 获取题目内容（不含答案）")
async def get_single_question(question_id: int):
    question = get_question_by_id(question_id)
    if question:
        return {
            "success": True,
            "question": {"id": question.id, "question": question.question}
        }
    return {"success": False, "message": "题目不存在"}


class ExamAnswerInput(BaseModel):
    provider_id: str
    question_id: int
    user_answer: str = ""
    model: str = None
    file_name: str = None


@app.post("/api/exam/answer", summary="提交答案并评分", description="提交用户答案或使用模型生成答案，系统自动评分并返回结果")
async def submit_exam_answer(input_data: ExamAnswerInput):
    if input_data.file_name:
        question = get_question_by_file_and_id(input_data.file_name, input_data.question_id)
    else:
        question = get_question_by_id(input_data.question_id)
    
    if not question:
        return {"success": False, "message": "题目不存在"}
    
    config = load_config()
    providers = config.get("providers", {})
    provider = providers.get(input_data.provider_id)
    if not provider:
        return {"success": False, "message": "Provider不存在"}
    
    # 如果用户没有提供答案，需要请求模型生成
    model_answer = input_data.user_answer
    if not model_answer:
        try:
            decrypted_key = decrypt_api_key(provider.get("api_key", ""))
            base_url = provider.get("api_url", "").rstrip("/")
            if not base_url.endswith("/v1"):
                base_url += "/v1"
            
            url = f"{base_url}/chat/completions"
            headers = {"Authorization": f"Bearer {decrypted_key}"}
            
            model = input_data.model or provider.get("default_model", "gpt-3.5-turbo")
            
            is_thinking_model = any(
                keyword in model.lower() for keyword in LLM_THINKING_MODEL_KEYWORDS
            )
            timeout = LLM_THINKING_TIMEOUT if is_thinking_model else 30.0
            max_tokens = 2000 if is_thinking_model else 200

            subject_hint = ""
            if input_data.file_name:
                fn_lower = input_data.file_name.lower()
                if '语文' in fn_lower or 'chinese' in fn_lower:
                    subject_hint = "语文"
                elif '数学' in fn_lower or '奥数' in fn_lower or 'math' in fn_lower:
                    subject_hint = "数学"
                elif '英语' in fn_lower or 'english' in fn_lower:
                    subject_hint = "英语"
                elif '物理' in fn_lower or 'physics' in fn_lower:
                    subject_hint = "物理"
                elif '化学' in fn_lower or 'chemistry' in fn_lower:
                    subject_hint = "化学"

            subject_line = f"请直接回答以下{subject_hint}题" if subject_hint else "请直接回答以下题目"
            prompt = f"""{subject_line}，不要任何思考过程，不要解释，只给最终答案。

题目：{question.question}

要求：
1. 不要写  thinking 或任何思考内容
2. 不要写解题步骤
3. 只给出最终答案，越简短越好"""
            
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": 0.3
            }
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    result = resp.json()
                    message = result["choices"][0].get("message", {})
                    model_answer = (message.get("content") or "").strip()
                    reasoning = (message.get("reasoning_content") or "").strip()
                    if not model_answer and reasoning:
                        model_answer = reasoning
                    model_answer = filter_think_process(model_answer)
                else:
                    return {"success": False, "message": f"模型请求失败：{resp.status_code}", "error": resp.text}
        except Exception as e:
            return {"success": False, "message": f"模型请求错误：{str(e)}"}
    
    # 评分
    score, is_correct = evaluate_answer(model_answer, question.answer)
    
    return {
        "success": True,
        "question_id": question.id,
        "question": question.question,
        "model_answer": model_answer,
        "correct_answer": question.answer,
        "score": score,
        "is_correct": is_correct
    }


class ExamRecordInput(BaseModel):
    model_name: str
    subject: str
    score: int
    total_questions: int
    correct_count: int
    exam_date: str = None


@app.post("/api/exam/record", summary="保存考试记录", description="考试完成后保存本次考试记录")
async def save_exam_record(input_data: ExamRecordInput):
    try:
        record_id = db.save_exam_record(
            model_name=input_data.model_name,
            subject=input_data.subject,
            score=input_data.score,
            total_questions=input_data.total_questions,
            correct_count=input_data.correct_count,
            exam_date=input_data.exam_date,
        )
        return {"success": True, "record_id": record_id}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/exam/records", summary="获取考试记录", description="分页获取考试记录，按分数从高到低排序，每页10条")
async def get_exam_records(page: int = Query(1, ge=1)):
    try:
        result = db.get_exam_records(page=page, page_size=10)
        return {"success": True, **result}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/exam")
async def exam_page():
    """考试页面"""
    exam_path = Path(__file__).parent / "static" / "exam.html"
    if exam_path.exists():
        return FileResponse(str(exam_path))
    return {"message": "考试页面不存在，请创建 static/exam.html"}


# ==================== 数据中心 API ====================

@app.get("/api/stats/summary", summary="获取游戏统计摘要")
async def get_stats_summary():
    """获取游戏统计摘要（总场数、胜率、连胜等）"""
    try:
        total_games = db.get_total_games()
        wins_by_team = db.get_wins_by_team()
        win_streak = db.get_win_streak()
        speech_stats = db.get_speech_stats()
        kill_stats = db.get_kill_stats()
        avg_duration = db.get_avg_game_duration()
        fastest_round = db.get_fastest_win_round()

        good_wins = wins_by_team.get("good", 0)
        wolf_wins = wins_by_team.get("wolf", 0)
        total = good_wins + wolf_wins
        good_win_rate = f"{good_wins / total * 100:.1f}%" if total > 0 else "0%"

        return {
            "success": True,
            "totalGames": total,
            "goodWins": good_wins,
            "wolfWins": wolf_wins,
            "goodWinRate": good_win_rate,
            "currentStreak": win_streak["current_streak"],
            "bestStreak": win_streak["best_streak"],
            "totalSpeeches": speech_stats["total_speeches"],
            "avgSpeechesPerPlayer": speech_stats["avg_speeches_per_player"],
            "totalDeaths": kill_stats["total_deaths"],
            "voteDeaths": kill_stats["vote_deaths"],
            "killDeaths": kill_stats["kill_deaths"],
            "poisonDeaths": kill_stats["poison_deaths"],
            "shootDeaths": kill_stats["shoot_deaths"],
            "avgDuration": avg_duration,
            "fastestWinRound": fastest_round,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/stats/history", summary="获取游戏历史记录")
async def get_stats_history(limit: int = 50, offset: int = 0):
    """获取游戏历史记录列表"""
    try:
        history = db.get_game_history(limit=limit, offset=offset)
        # 转换为驼峰式命名
        def to_camel_case(snake_str):
            components = snake_str.split('_')
            return components[0] + ''.join(x.title() for x in components[1:])
        
        converted_history = []
        for item in history:
            converted = {}
            for key, value in item.items():
                converted[to_camel_case(key)] = value
            converted_history.append(converted)
        
        return {"success": True, "history": converted_history}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/stats/wins-by-role", summary="获取各角色胜场统计")
async def get_wins_by_role():
    """获取各角色胜场统计"""
    try:
        return {"success": True, "wins": db.get_wins_by_role()}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/stats/wins-by-mode", summary="获取各模式胜场统计")
async def get_wins_by_mode():
    """获取各模式好人胜场统计"""
    try:
        return {"success": True, "wins": db.get_wins_by_mode()}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ==================== 排行榜 API ====================

@app.get("/api/leaderboard/mvp", summary="获取 MVP 排行榜")
async def get_mvp_leaderboard(limit: int = 10):
    """获取 MVP 次数排行榜"""
    try:
        rankings = db.get_mvp_rankings(limit=limit)
        return {"success": True, "rankings": rankings}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/leaderboard/models", summary="获取模型胜率排行榜")
async def get_model_leaderboard(min_games: int = 3, limit: int = 10):
    """获取模型胜率排行榜"""
    try:
        rankings = db.get_model_stats(min_games=min_games, limit=limit)
        return {"success": True, "rankings": rankings}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/leaderboard/model-mvp", summary="获取模型MVP排行榜")
async def get_model_mvp_leaderboard(limit: int = 10):
    """获取模型MVP排行榜（按MVP获得次数排名）"""
    try:
        rankings = db.get_model_mvp_stats(limit=limit)
        return {"success": True, "rankings": rankings}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ==================== 经验值与等级 API ====================

@app.get("/api/user/exp", summary="获取用户经验值和等级信息")
async def get_user_exp():
    """获取用户当前经验值、等级和进度"""
    try:
        data = db.get_user_exp()
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/api/user/exp/sync", summary="同步成就和挑战积分到经验值")
async def sync_exp():
    """同步成就和每日挑战的积分到经验值"""
    try:
        result = db.sync_exp_from_achievements_and_challenges()
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ==================== 成就系统 API ====================

@app.get("/api/achievements", summary="获取所有成就")
async def get_achievements():
    """获取所有成就及其解锁状态"""
    try:
        achievements = db.get_all_achievements()
        total_points = db.get_achievement_points()
        unlocked_count = sum(1 for a in achievements if a.get("unlocked"))
        return {
            "success": True,
            "achievements": achievements,
            "total": len(achievements),
            "unlocked": unlocked_count,
            "totalPoints": total_points,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/api/achievements/check", summary="检查成就解锁")
async def check_achievements():
    """手动触发成就检查（通常在游戏结束后自动调用）"""
    try:
        if game_state.current_game:
            _check_achievements(game_state.current_game)
        return {"success": True, "message": "成就检查完成"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ==================== 数据库管理 API ====================

@app.post("/api/db/cleanup", summary="清理过期数据库记录")
async def cleanup_database(days: int = 90):
    """清理过期的游戏记录，默认保留 90 天"""
    try:
        result = db.cleanup_old_records(days_to_keep=days)
        size_info = db.get_database_size()
        return {
            "success": True,
            "message": f"清理完成：删除 {result['cleaned_games']} 条游戏记录，{result['cleaned_stats']} 条玩家数据",
            "cleaned_games": result["cleaned_games"],
            "cleaned_stats": result["cleaned_stats"],
            "database_size": size_info
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/db/size", summary="获取数据库大小")
async def get_database_size():
    """获取数据库文件大小信息"""
    try:
        size_info = db.get_database_size()
        return {
            "success": True,
            "database_size": size_info
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


# ==================== 每日挑战 API ====================

@app.get("/api/daily-challenges", summary="获取每日挑战")
async def get_daily_challenges(date: str = None):
    """获取指定日期的每日挑战，不指定则返回今天的"""
    try:
        challenges = db.get_daily_challenges(date)
        total_points = db.get_challenge_points(date) if date else db.get_challenge_points()
        total_all_points = db.get_total_challenge_points()
        return {
            "success": True,
            "challenges": challenges,
            "todayPoints": total_points,
            "totalPoints": total_all_points,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/api/daily-challenges/complete", summary="完成每日挑战")
async def complete_daily_challenge(challenge_date: str = None, challenge_index: int = 0):
    """完成一个每日挑战"""
    try:
        if challenge_date is None:
            challenge_date = date.today().isoformat()
        success = db.complete_challenge(challenge_date, challenge_index)
        if success:
            return {"success": True, "message": "挑战已完成！"}
        return {"success": False, "message": "挑战不存在或已完成"}
    except Exception as e:
        return {"success": False, "message": str(e)}
