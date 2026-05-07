import asyncio
import time
import uuid
import logging
from typing import Optional, Dict, List
from pydantic import BaseModel, Field, field_validator
from game.text_utils import filter_think_process
from game.config import LLM_THINKING_TIMEOUT, LLM_THINKING_MODEL_KEYWORDS
from crypto import decrypt_api_key
import httpx

logger = logging.getLogger(__name__)


class ModelConfig(BaseModel):
    provider_id: str
    model_name: str
    display_name: str = ""
    side: str = "pro"

    @field_validator("side")
    @classmethod
    def validate_side(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("pro", "con"):
            raise ValueError("side 必须为 pro 或 con")
        return v


class GroupChatCreateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    models: List[ModelConfig] = Field(..., min_length=2, max_length=10)
    max_rounds: int = Field(default=3, ge=1, le=20)

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("话题不能为空")
        return v


class ChatMessage(BaseModel):
    model_name: str
    display_name: str
    content: str
    round_num: int
    side: str = "pro"
    timestamp: float


class GroupChatRoom:
    def __init__(self, room_id: str, topic: str, models: List[ModelConfig], max_rounds: int, providers: dict):
        self.room_id = room_id
        self.topic = topic
        self.models = models
        self.max_rounds = max_rounds
        self.providers = providers
        self.messages: List[ChatMessage] = []
        self.is_running = False
        self.is_stopped = False
        self.chat_task: Optional[asyncio.Task] = None
        self.broadcast_fn = None
        self.current_round = 0

    def set_broadcast(self, broadcast_fn):
        self.broadcast_fn = broadcast_fn

    async def broadcast(self, message: dict):
        if self.broadcast_fn:
            await self.broadcast_fn(message)

    async def run_discussion(self):
        self.is_running = True
        self.is_stopped = False

        await self.broadcast({
            "type": "chat_started",
            "room_id": self.room_id,
            "topic": self.topic,
            "models": [
                {
                    "display_name": m.display_name,
                    "model_name": m.model_name,
                    "provider_id": m.provider_id,
                    "side": m.side,
                }
                for m in self.models
            ],
            "max_rounds": self.max_rounds,
        })

        for round_num in range(1, self.max_rounds + 1):
            if self.is_stopped:
                break

            self.current_round = round_num
            await self.broadcast({
                "type": "round_start",
                "round": round_num,
                "max_rounds": self.max_rounds,
            })

            for model_cfg in self.models:
                if self.is_stopped:
                    break

                await self.broadcast({
                    "type": "model_thinking",
                    "display_name": model_cfg.display_name,
                    "model_name": model_cfg.model_name,
                    "side": model_cfg.side,
                    "round": round_num,
                })

                content = await self._call_model(model_cfg, round_num)

                if self.is_stopped:
                    break

                msg = ChatMessage(
                    model_name=model_cfg.model_name,
                    display_name=model_cfg.display_name,
                    content=content,
                    round_num=round_num,
                    side=model_cfg.side,
                    timestamp=time.time(),
                )
                self.messages.append(msg)

                await self.broadcast({
                    "type": "model_message",
                    "display_name": model_cfg.display_name,
                    "model_name": model_cfg.model_name,
                    "content": content,
                    "round": round_num,
                    "side": model_cfg.side,
                })

                await asyncio.sleep(0.5)

        if not self.is_stopped:
            await self.broadcast({
                "type": "chat_completed",
                "room_id": self.room_id,
                "total_messages": len(self.messages),
            })
        else:
            await self.broadcast({
                "type": "chat_stopped",
                "room_id": self.room_id,
            })

        self.is_running = False

    async def _call_model(self, model_cfg: ModelConfig, round_num: int) -> str:
        provider = self.providers.get(model_cfg.provider_id)
        if not provider:
            return f"[错误：未找到供应商 {model_cfg.provider_id}]"

        api_key = provider.get("api_key", "")
        api_url = provider.get("api_url", "").rstrip("/")
        if not api_url.endswith("/v1"):
            api_url += "/v1"

        url = f"{api_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

        system_prompt = self._build_system_prompt(model_cfg, round_num)
        user_prompt = self._build_user_prompt(model_cfg, round_num)

        payload = {
            "model": model_cfg.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": 1000,
            "temperature": 0.8,
        }

        is_thinking_model = any(
            keyword in model_cfg.model_name.lower() for keyword in LLM_THINKING_MODEL_KEYWORDS
        )
        timeout = LLM_THINKING_TIMEOUT if is_thinking_model else 90.0

        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        choices = data.get("choices", [])
                        if choices:
                            message = choices[0].get("message", {})
                            content = (message.get("content") or "").strip()
                            if not content:
                                for key in ["reasoning_content", "reasoning", "thinking"]:
                                    if message.get(key):
                                        content = message[key].strip()
                                        break
                            content = filter_think_process(content)
                            return content or "[模型返回空内容]"
                        return "[模型返回格式异常]"
                    elif resp.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    else:
                        return f"[模型调用失败 ({resp.status_code})]"
            except httpx.TimeoutException:
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                    continue
                return "[模型响应超时]"
            except Exception as e:
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                    continue
                return f"[模型调用出错：{str(e)[:100]}]"

        return "[模型调用失败，已重试多次]"

    def _build_system_prompt(self, model_cfg: ModelConfig, round_num: int) -> str:
        side_label = "正方（支持）" if model_cfg.side == "pro" else "反方（反对）"
        side_instruction = "你需要为这个话题的正方立场辩护，提出支持性的论点和论据。" if model_cfg.side == "pro" else "你需要为这个话题的反方立场辩护，提出反对性的论点和论据。"

        return (
            f"你是一个AI模型，名字叫「{model_cfg.display_name}」，你是{side_label}。"
            f"{side_instruction}"
            f"你正在和其他AI模型一起辩论一个话题，请坚定地站在你的立场上。"
            f"请用简洁、有逻辑的方式表达你的观点。"
            f"你可以反驳对方阵营的观点，但要有理有据。"
            f"不要重复别人已经说过的内容，尽量提出新的角度或论据。"
            f"回复控制在200字以内。"
        )

    def _build_user_prompt(self, model_cfg: ModelConfig, round_num: int) -> str:
        side_label = "正方" if model_cfg.side == "pro" else "反方"
        prompt = f"辩论话题：{self.topic}\n"
        prompt += f"你的立场：{side_label}\n\n"

        if round_num == 1 and not self.messages:
            prompt += "这是第一轮辩论，请发表你的观点。"
        else:
            prompt += "以下是之前的辩论内容：\n\n"
            for msg in self.messages:
                msg_side = "正方" if msg.side == "pro" else "反方"
                prompt += f"【{msg_side}·{msg.display_name}】：{msg.content}\n\n"
            prompt += f"现在是第{round_num}轮，请基于以上辩论继续发表你的观点，坚持你的立场。"

        return prompt

    def stop(self):
        self.is_stopped = True


class GroupChatManager:
    def __init__(self):
        self._rooms: Dict[str, GroupChatRoom] = {}

    def create_room(self, topic: str, models: List[ModelConfig], max_rounds: int, providers: dict) -> GroupChatRoom:
        room_id = str(uuid.uuid4())[:8]
        room = GroupChatRoom(room_id, topic, models, max_rounds, providers)
        self._rooms[room_id] = room
        return room

    def get_room(self, room_id: str) -> Optional[GroupChatRoom]:
        return self._rooms.get(room_id)

    def remove_room(self, room_id: str):
        room = self._rooms.pop(room_id, None)
        if room:
            room.stop()


group_chat_manager = GroupChatManager()
