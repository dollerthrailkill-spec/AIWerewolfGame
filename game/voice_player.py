"""
语音播放器 - 基于Web Speech API的语音合成功能

实际语音合成由前端 Web Speech API 完成。
后端通过 on_speech_start 回调通知前端开始播放，
并通过 _speech_complete_event 等待前端播放完成信号。
"""
import asyncio
import logging
from typing import Optional, Dict, Callable
from game.roles import RoleType
from game.voice_config import get_voice_params

logger = logging.getLogger(__name__)


class VoicePlayer:
    """语音播放器类"""

    def __init__(self):
        self.is_speaking = False
        self.current_speech_id: Optional[str] = None
        self.speech_queue = asyncio.Queue()
        self._stop_event = asyncio.Event()
        self._speech_task: Optional[asyncio.Task] = None

        # 当前语音完成事件：前端播放完成后调用 resolve
        self._speech_complete_event: Optional[asyncio.Event] = None

        # 回调函数
        self.on_speech_start: Optional[Callable] = None
        self.on_speech_end: Optional[Callable] = None
        self.on_error: Optional[Callable] = None

    async def start(self):
        """启动语音播放器"""
        if self._speech_task is None:
            self._speech_task = asyncio.create_task(self._speech_worker())
            logger.info("语音播放器已启动")

    async def stop(self):
        """停止语音播放器"""
        self._stop_event.set()
        # 如果有正在等待的语音完成事件，立即 resolve 以避免阻塞
        if self._speech_complete_event and not self._speech_complete_event.is_set():
            self._speech_complete_event.set()
        if self._speech_task:
            self._speech_task.cancel()
            try:
                await self._speech_task
            except asyncio.CancelledError:
                pass
        self._speech_task = None
        self._stop_event.clear()
        logger.info("语音播放器已停止")

    async def speak(self, text: str, role_type: RoleType, player_name: str, speech_id: str = None):
        """
        播放语音

        Args:
            text: 要朗读的文本
            role_type: 角色类型
            player_name: 玩家名称
            speech_id: 语音ID（可选）
        """
        if not text or not text.strip():
            return

        speech_id = speech_id or f"speech_{id(text)}"

        # 将语音任务加入队列
        speech_data = {
            "id": speech_id,
            "text": text,
            "role_type": role_type,
            "player_name": player_name,
            "voice_params": get_voice_params(role_type)
        }

        await self.speech_queue.put(speech_data)
        logger.debug(f"语音任务已加入队列: {player_name} - {text[:50]}...")

    def notify_speech_complete(self, speech_id: str = None):
        """
        通知当前语音播放完成。

        当前端 Web Speech API 完成朗读后调用此方法，
        以解除 _play_speech 中的等待。
        """
        if self._speech_complete_event and not self._speech_complete_event.is_set():
            self._speech_complete_event.set()
            logger.debug(f"语音播放完成通知: {speech_id}")

    async def _speech_worker(self):
        """语音播放工作线程"""
        while not self._stop_event.is_set():
            try:
                get_task = asyncio.create_task(self.speech_queue.get())
                stop_task = asyncio.create_task(self._stop_event.wait())
                done, pending = await asyncio.wait(
                    [get_task, stop_task],
                    return_when=asyncio.FIRST_COMPLETED
                )
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except (asyncio.CancelledError, Exception):
                        pass

                if get_task in done and not get_task.cancelled():
                    speech_data = get_task.result()
                    await self._play_speech(speech_data)
                    self.speech_queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"语音播放错误: {e}")
                if self.on_error:
                    self.on_error(str(e))

    async def _play_speech(self, speech_data: Dict):
        """
        播放单个语音。

        1. 触发 on_speech_start 回调（前端开始 Web Speech API 朗读）
        2. 等待 _speech_complete_event（前端朗读完成后调用 notify_speech_complete）
        3. 若 30 秒内未收到完成信号，自动超时继续（防止永久阻塞）
        4. 触发 on_speech_end 回调
        """
        try:
            self.is_speaking = True
            self.current_speech_id = speech_data["id"]

            # 创建完成事件
            self._speech_complete_event = asyncio.Event()

            # 触发开始回调（前端开始朗读）
            if self.on_speech_start:
                self.on_speech_start(speech_data)

            text_length = len(speech_data["text"])
            # 估算朗读时长：中文约每秒 4 字，英文约每秒 2 词，最少 2 秒
            estimated_duration = max(2.0, text_length / 4.0)

            logger.info(f"开始播放语音: {speech_data['player_name']} - {speech_data['text'][:30]}... (预估 {estimated_duration:.1f}s)")

            # 等待前端完成信号，超时时间为预估时长的 3 倍（最多 30 秒）
            timeout = min(max(estimated_duration * 3, 5.0), 30.0)
            try:
                await asyncio.wait_for(
                    self._speech_complete_event.wait(),
                    timeout=timeout
                )
                logger.debug(f"语音正常完成: {speech_data['player_name']}")
            except asyncio.TimeoutError:
                logger.warning(f"语音播放超时（{timeout:.1f}s），自动继续: {speech_data['player_name']}")

            # 触发结束回调
            if self.on_speech_end:
                self.on_speech_end(speech_data)

        except Exception as e:
            logger.error(f"播放语音时出错: {e}")
            if self.on_error:
                self.on_error(str(e))
        finally:
            self.is_speaking = False
            self.current_speech_id = None
            self._speech_complete_event = None

    def is_busy(self) -> bool:
        """检查是否正在播放语音"""
        return self.is_speaking or not self.speech_queue.empty()

    async def wait_for_silence(self):
        """等待所有语音播放完成"""
        await self.speech_queue.join()
        while self.is_speaking:
            await asyncio.sleep(0.1)

    def clear_queue(self):
        """清空语音队列"""
        while not self.speech_queue.empty():
            try:
                self.speech_queue.get_nowait()
                self.speech_queue.task_done()
            except asyncio.QueueEmpty:
                break

    async def emergency_stop(self):
        """紧急停止：清空队列并解除当前等待，用于 WebSocket 断连等场景"""
        # 清空队列
        self.clear_queue()
        # 解除当前语音等待状态
        if self._speech_complete_event and not self._speech_complete_event.is_set():
            self._speech_complete_event.set()
            logger.info("语音播放器紧急停止：已解除当前等待")
