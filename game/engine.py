import asyncio
import random
import uuid
import logging
from datetime import datetime
from typing import Optional, Callable, Awaitable, List, Dict
from game.roles import Player, RoleType, ROLE_INFO, GAME_CONFIGS, DEFAULT_NAMES, ModelConfig
from game.voice_player import VoicePlayer
from game.night_phase import NightPhaseMixin
from game.day_phase import DayPhaseMixin
from game.mvp import MVPMixin
from game.config import (
    SLEEP_AFTER_GAME_START,
)
from logger import log_game_event, log_game_start, log_game_end

logger = logging.getLogger(__name__)


class GameEngine(NightPhaseMixin, DayPhaseMixin, MVPMixin):
    def __init__(self, player_count: int,
                 player_configs: list, providers: dict):
        self.game_id = str(uuid.uuid4())[:8]
        self.player_count = player_count
        self.providers = providers

        self.players: list[Player] = []
        self.round = 0
        self.phase = "lobby"
        self.is_running = False
        self.game_over = False
        self.winner = None
        self.started_at: str = datetime.now().isoformat()
        self.mvp: Optional[str] = None

        self.witch_antidote_used = False
        self.witch_poison_used = False
        self.witch_save_history: list[str] = []
        self.witch_poison_history: list[str] = []
        self.last_guard_target: Optional[str] = None
        self.guard_history: list[str] = []
        self.seer_results: list[str] = []
        self.night_kill_target: Optional[str] = None
        self.last_night_result: str = ""
        self.last_dead_seat: Optional[int] = None

        self.public_log: list[str] = []
        self.speech_log: list[dict] = []
        self.vote_log: list[dict] = []
        self.night_log: list[dict] = []
        self.death_log: list[dict] = []

        self.speech_by_round: list[Dict] = []

        self.current_round_speeches: list[str] = []

        self._broadcast: Optional[Callable[[dict], Awaitable[None]]] = None
        self._pause_check: Optional[Callable[[], bool]] = None
        self._pause_event: Optional[asyncio.Event] = None

        self.voice_player = VoicePlayer()

        self._game_state_cache: Optional[dict] = None
        self._cache_round: int = -1
        self._cache_alive_hash: int = -1
        self._cache_vote_count: int = -1
        self._cache_speech_count: int = -1
        self._cache_night_state_hash: int = -1

        self._init_players(player_configs)

    def set_pause_control(self, pause_check: Callable[[], bool], pause_event: asyncio.Event):
        self._pause_check = pause_check
        self._pause_event = pause_event

    async def _wait_if_paused(self):
        if self._pause_check and self._pause_check():
            logger.debug("Game engine: Game is paused, waiting for resume...")
            await self.broadcast("game_paused", {"message": "游戏已暂停"})
            if self._pause_event:
                logger.debug("Game engine: Waiting for pause_event...")
                await self._pause_event.wait()
                logger.debug("Game engine: Pause event received, game resumed")
            await self.broadcast("game_resumed", {"message": "游戏已继续"})
        else:
            logger.debug("Game engine: not paused, _pause_check=%s, check_result=%s",
                         self._pause_check is not None,
                         self._pause_check() if self._pause_check else 'None')

    def _init_players(self, player_configs: list):
        roles = list(GAME_CONFIGS[self.player_count]["roles"])
        use_assigned_roles = True

        for config in player_configs:
            if not config.get("role"):
                use_assigned_roles = False
                break

        role_ids = []

        if use_assigned_roles:
            from game.roles import RoleType
            role_mapping = {
                "werewolf": RoleType.WEREWOLF,
                "werewolf2": RoleType.WEREWOLF,
                "werewolf3": RoleType.WEREWOLF,
                "seer": RoleType.SEER,
                "witch": RoleType.WITCH,
                "hunter": RoleType.HUNTER,
                "guard": RoleType.GUARD,
                "villager": RoleType.VILLAGER,
                "villager2": RoleType.VILLAGER,
                "villager3": RoleType.VILLAGER,
            }
            roles = []
            for config in player_configs:
                role_str = config.get("role", "villager")
                role_ids.append(role_str)
                roles.append(role_mapping.get(role_str, RoleType.VILLAGER))
        else:
            random.shuffle(roles)
            role_ids = [r.value for r in roles]

        for i in range(self.player_count):
            config = player_configs[i] if i < len(player_configs) else {}

            mc = ModelConfig(
                provider_id=config.get("provider_id", ""),
                model_name=config.get("model_name", ""),
                personality=config.get("personality", ""),
                use_default_personality=config.get("use_default_personality", True),
            )

            player = Player(
                id=f"p{i}",
                name=config.get("name", DEFAULT_NAMES[i]),
                role=roles[i],
                role_id=role_ids[i] if i < len(role_ids) else "",
                is_alive=True,
                seat_number=i,
                model_config=mc,
            )
            self.players.append(player)

        random.shuffle(self.players)
        for i, player in enumerate(self.players):
            player.seat_number = i

    def set_broadcast(self, broadcast_fn):
        self._broadcast = broadcast_fn

    async def broadcast(self, msg_type: str, data: dict):
        if self._broadcast:
            await self._broadcast({"type": msg_type, **data})

    def _get_alive_players(self) -> list[Player]:
        return [p for p in self.players if p.is_alive]

    def _get_alive_by_role(self, role: RoleType) -> list[Player]:
        return [p for p in self.players if p.is_alive and p.role == role]

    def _get_player_by_id(self, pid: str) -> Optional[Player]:
        for p in self.players:
            if p.id == pid:
                return p
        return None

    def _get_player_by_name(self, name: str) -> Optional[Player]:
        for p in self.players:
            if p.name == name:
                return p
        return None

    def _invalidate_cache(self):
        self._game_state_cache = None
        self._cache_round = -1
        self._cache_alive_hash = -1
        self._cache_vote_count = -1
        self._cache_speech_count = -1
        self._cache_night_state_hash = -1

    def _compute_night_state_hash(self) -> int:
        return hash((
            self.last_night_result,
            tuple(self.seer_results),
            self.witch_antidote_used,
            self.witch_poison_used,
            tuple(self.witch_save_history),
            tuple(self.witch_poison_history),
            self.last_guard_target,
            tuple(self.guard_history),
        ))

    def _build_game_state(self, extra: dict = None) -> dict:
        alive_players = self._get_alive_players()
        alive_hash = hash(tuple(sorted(p.name for p in alive_players)))
        vote_count = len(self.vote_log)
        speech_count = len(self.speech_log)
        night_state_hash = self._compute_night_state_hash()

        cache_valid = (
            self._game_state_cache is not None
            and self._cache_round == self.round
            and self._cache_alive_hash == alive_hash
            and self._cache_vote_count == vote_count
            and self._cache_speech_count == speech_count
            and self._cache_night_state_hash == night_state_hash
        )

        if cache_valid:
            state = dict(self._game_state_cache)
            state["phase"] = self.phase
            if extra:
                state.update(extra)
            return state

        death_info = []
        for p in self.players:
            if not p.is_alive:
                death_info.append(f"{p.name}（{p.display_role}）")

        vote_history = []
        for vl in self.vote_log:
            round_num = vl.get("round", "?")
            votes = vl.get("votes", {})
            vote_lines = [f"{voter}→{target}" for voter, target in votes.items()]
            eliminated = vl.get("eliminated", "无")
            vote_history.append(f"第{round_num}轮投票：{', '.join(vote_lines)}；放逐：{eliminated}")

        speech_by_round = list(self.speech_by_round)

        alive_wolves = [p for p in alive_players if p.role == RoleType.WEREWOLF]
        alive_goods = [p for p in alive_players if p.role != RoleType.WEREWOLF]

        death_history = []
        for dl in self.death_log:
            cause_map = {"werewolf": "夜间被杀", "kill": "夜间被杀", "poison": "被毒杀", "vote": "被投票放逐", "shoot": "被猎人带走"}
            cause_text = cause_map.get(dl["cause"], dl["cause"])
            role_name = ROLE_INFO.get(RoleType(dl["role"]), {}).get("name", dl["role"])
            death_history.append(f"第{dl['round']}轮：{dl['name']}（{role_name}）{cause_text}")

        state = {
            "round": self.round,
            "phase": self.phase,
            "initial_player_count": self.player_count,
            "alive_players": [p.name for p in alive_players],
            "dead_players": death_info,
            "death_history": death_history,
            "alive_count": len(alive_players),
            "dead_count": len(death_info),
            "alive_wolf_count": len(alive_wolves),
            "alive_good_count": len(alive_goods),
            "public_log": self.public_log,
            "vote_history": vote_history,
            "speech_history": [f"{sl['player']}：{sl['content']}" for sl in self.speech_log],
            "speech_by_round": speech_by_round,
            "last_night_result": self.last_night_result,
            "seer_results": self.seer_results,
            "witch_antidote_used": self.witch_antidote_used,
            "witch_poison_used": self.witch_poison_used,
            "witch_save_history": self.witch_save_history,
            "witch_poison_history": self.witch_poison_history,
            "last_guard_target": self.last_guard_target,
            "guard_history": self.guard_history,
        }

        self._game_state_cache = dict(state)
        self._cache_round = self.round
        self._cache_alive_hash = alive_hash
        self._cache_vote_count = vote_count
        self._cache_speech_count = speech_count
        self._cache_night_state_hash = night_state_hash

        if extra:
            state.update(extra)
        return state

    def _check_game_over(self) -> Optional[str]:
        alive = self._get_alive_players()
        wolves = [p for p in alive if p.role == RoleType.WEREWOLF]
        goods = [p for p in alive if p.role != RoleType.WEREWOLF]

        if len(wolves) == 0:
            return "good"
        if len(wolves) >= len(goods):
            return "wolf"
        return None

    async def run(self):
        self.is_running = True
        self.phase = "role_reveal"

        await self.voice_player.start()

        await self.broadcast("game_start", {
            "game_id": self.game_id,
            "player_count": self.player_count,
            "players": [p.to_dict(reveal_role=True) for p in self.players],
            "config_desc": GAME_CONFIGS[self.player_count]["description"],
        })

        log_game_start(self.game_id, self.player_count, "watch")

        for player in self.players:
            provider = self.providers.get(player.model_config.provider_id, {})
            model_name = player.model_config.model_name or provider.get("default_model", "gpt-3.5-turbo")
            log_game_event("MODEL_CONFIG", f"{player.name}（{player.display_role}）使用模型：{model_name}")

        await asyncio.sleep(SLEEP_AFTER_GAME_START)

        while self.is_running and not self.game_over:
            await self._wait_if_paused()
            if not self.is_running:
                break
            self.round += 1
            await self.night_phase()
            if self.game_over:
                break
            await self._wait_if_paused()
            if not self.is_running:
                break
            await self.day_phase()
            if self.game_over:
                break

        self.is_running = False

        await self.voice_player.stop()

        mvp_name, mvp_reasons = await self._evaluate_mvp()
        self.mvp = mvp_name

        log_game_end(self.game_id, self.winner, self.round)
        await self.broadcast("game_over", {
            "winner": self.winner,
            "winner_name": "好人阵营" if self.winner == "good" else "狼人阵营",
            "players": [p.to_dict(reveal_role=True) for p in self.players],
            "mvp": mvp_name,
            "mvp_reasons": mvp_reasons,
        })

    async def _check_running_and_pause(self):
        if not self.is_running or self.game_over:
            return True
        await self._wait_if_paused()
        return False

    def get_state_summary(self) -> dict:
        return {
            "game_id": self.game_id,
            "round": self.round,
            "phase": self.phase,
            "player_count": self.player_count,
            "is_running": self.is_running,
            "game_over": self.game_over,
            "winner": self.winner,
            "players": [p.to_dict(reveal_role=True) for p in self.players],
        }
