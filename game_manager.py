"""
game_manager.py - 多房间游戏管理器

支持同时运行多局游戏，每局游戏有独立的状态和WebSocket连接。
解决原单例模式只能支持一局游戏的问题。
"""
import asyncio
import logging
from typing import Optional, Dict, Set
from fastapi import WebSocket

from game.engine import GameEngine
from logger import log_error, log_game_end

logger = logging.getLogger(__name__)


class RoomState:
    """单个房间的游戏状态"""
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.current_game: Optional[GameEngine] = None
        self.game_task: Optional[asyncio.Task] = None
        self.connected_clients: Set[WebSocket] = set()
        self.game_paused: bool = False
        self.pause_event: Optional[asyncio.Event] = None
        self._pending_tasks: set = set()

    def reset(self):
        """重置房间状态"""
        self.current_game = None
        self.game_task = None
        self.game_paused = False
        self.pause_event = None
        self._pending_tasks.clear()

    def add_pending_task(self, task: asyncio.Task):
        """添加待处理任务引用，防止任务泄漏"""
        self._pending_tasks.add(task)
        task.add_done_callback(self._pending_tasks.discard)

    def cancel_pending_tasks(self):
        """取消所有待处理的广播任务"""
        for task in list(self._pending_tasks):
            if not task.done():
                task.cancel()
        self._pending_tasks.clear()

    async def broadcast(self, message: dict):
        """向房间内所有客户端广播消息"""
        disconnected = set()
        for ws in self.connected_clients:
            try:
                await ws.send_json(message)
            except Exception as e:
                log_error(e, context=f"房间 {self.room_id} 广播消息失败")
                disconnected.add(ws)
        
        for ws in disconnected:
            self.connected_clients.discard(ws)


class GameManager:
    """多房间游戏管理器"""
    
    def __init__(self):
        self._rooms: Dict[str, RoomState] = {}
        self._default_room_id = "default"
    
    def get_or_create_room(self, room_id: str = None) -> RoomState:
        """获取或创建房间"""
        rid = room_id or self._default_room_id
        if rid not in self._rooms:
            self._rooms[rid] = RoomState(rid)
        return self._rooms[rid]
    
    def get_room(self, room_id: str = None) -> Optional[RoomState]:
        """获取房间"""
        rid = room_id or self._default_room_id
        return self._rooms.get(rid)
    
    def remove_room(self, room_id: str):
        """移除房间"""
        if room_id in self._rooms:
            self._rooms.pop(room_id)
    
    def list_rooms(self) -> Dict[str, RoomState]:
        """列出所有房间"""
        return dict(self._rooms)
    
    async def cleanup_room(self, room_id: str):
        """清理指定房间的所有资源"""
        room = self.get_room(room_id)
        if not room:
            return
        
        if room.current_game:
            room.current_game.is_running = False
            room.current_game.game_over = True
        
        if room.game_task and not room.game_task.done():
            room.game_task.cancel()
            try:
                await asyncio.wait_for(room.game_task, timeout=5.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
            except Exception as e:
                log_error(e, context=f"清理房间 {room_id} 游戏任务时出错")
        
        room.cancel_pending_tasks()
        
        if room.current_game:
            if hasattr(room.current_game, 'voice_player'):
                await room.current_game.voice_player.emergency_stop()
            room.current_game.players = []
            
            if hasattr(room.current_game, 'winner') and room.current_game.winner:
                log_game_end(
                    room.current_game.game_id,
                    room.current_game.winner,
                    room.current_game.round
                )
            else:
                log_game_end(None, None, None)
        
        room.reset()
        self.remove_room(room_id)


game_manager = GameManager()
