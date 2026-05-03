import asyncio
import random
import logging
from typing import Optional

from game.roles import Player, RoleType, ROLE_INFO
from game.ai_player import AIPlayer
from game.utils import smart_truncate
from game.config import (
    SLEEP_AFTER_PHASE_CHANGE,
    SLEEP_AFTER_SUB_PHASE,
    SLEEP_AFTER_DAWN,
    SLEEP_WEREWOLF_THINKING,
    SLEEP_AFTER_EULOGY,
    SLEEP_NIGHT_ACTION_ANIMATION,
    SLEEP_WEREWOLF_VOTE_PAUSE,
    AI_EULOGY_TIMEOUT,
)
from logger import log_game_state, log_player_action

logger = logging.getLogger(__name__)


class NightPhaseMixin:

    async def night_phase(self):
        self.phase = "night"
        self.night_kill_target = None
        self.night_log = []

        await self.broadcast("phase_change", {
            "phase": "night",
            "round": self.round,
            "message": f"第{self.round}夜，天黑请闭眼...",
        })
        await asyncio.sleep(SLEEP_AFTER_PHASE_CHANGE)

        if await self._check_running_and_pause():
            return
        kill_target = await self._werewolf_phase()
        if await self._check_running_and_pause():
            return
        seer_result = await self._seer_phase()
        if await self._check_running_and_pause():
            return
        witch_result = await self._witch_phase(kill_target)
        if await self._check_running_and_pause():
            return
        guard_target = await self._guard_phase()

        seers = self._get_alive_by_role(RoleType.SEER)
        witches = self._get_alive_by_role(RoleType.WITCH)
        guards = self._get_alive_by_role(RoleType.GUARD)
        wolves = self._get_alive_by_role(RoleType.WEREWOLF)

        deaths = self._resolve_night(kill_target, witch_result, guard_target)

        night_summary = []
        if kill_target:
            night_summary.append(f"狼人击杀 {kill_target}")
        if witch_result and witch_result.get("save"):
            night_summary.append("女巫使用解药救人")
        if witch_result and witch_result.get("poison"):
            night_summary.append(f"女巫毒杀 {witch_result['poison']}")

        self.last_night_result = "；".join(night_summary) if night_summary else "平安夜"

        night_actions = []
        if kill_target and wolves:
            for wolf in wolves:
                night_actions.append({"player": wolf.name, "action": f"选择击杀 {kill_target}"})
        if seer_result and seer_result.get("target") and seers:
            is_wolf_text = "狼人" if seer_result.get("is_werewolf") else "好人"
            night_actions.append({"player": seers[0].name, "action": f"查验{seer_result['target']}：{is_wolf_text}"})
        if witch_result and witches:
            if witch_result.get("save"):
                night_actions.append({"player": witches[0].name, "action": f"使用解药救了 {kill_target}"})
            if witch_result.get("poison"):
                night_actions.append({"player": witches[0].name, "action": f"使用毒药毒杀 {witch_result['poison']}"})
        if guard_target and guards:
            night_actions.append({"player": guards[0].name, "action": f"保护了 {guard_target}"})

        logger.debug("准备发送夜间动作动画，动作数量: %d", len(night_actions))
        logger.debug("夜间动作: %s", night_actions)

        if night_actions:
            await self.broadcast("night_actions", {"actions": night_actions})
            await asyncio.sleep(len(night_actions) * SLEEP_NIGHT_ACTION_ANIMATION)
        else:
            logger.debug("没有夜间动作需要播放动画")

        self.phase = "dawn"
        await self.broadcast("dawn", {"message": "天亮了..."})
        await asyncio.sleep(SLEEP_AFTER_DAWN)

        death_names = []
        for d in deaths:
            death_names.append(d["name"])
            log_game_state("night", self.round, f"第{self.round}夜：{d['name']}死亡（{d['cause']}）")

        if deaths:
            self.public_log.append(f"第{self.round}夜：{', '.join(death_names)} 死亡")
        else:
            self.public_log.append(f"第{self.round}夜：平安夜，无人死亡")

        if not deaths:
            self.last_dead_seat = None

        await self.broadcast("night_result", {
            "deaths": death_names,
            "round": self.round,
            "night_summary": self.last_night_result,
        })

        eulogy_players = []
        hunter_players = []
        for d in deaths:
            player = self._get_player_by_name(d["name"])
            if player:
                player.is_alive = False
                self.death_log.append({
                    "name": d["name"],
                    "round": self.round,
                    "cause": d["cause"],
                    "role": player.role.value,
                    "seat": player.seat_number,
                })
                eulogy_players.append(player)
                if self.last_dead_seat is None:
                    self.last_dead_seat = player.seat_number

                if player.role == RoleType.HUNTER and d["cause"] != "poison":
                    hunter_players.append(player)

        for player in eulogy_players:
            if not self.is_running or self.game_over:
                break
            await self._execute_eulogy(player)

        for player in hunter_players:
            if not self.is_running or self.game_over:
                break
            await self._hunter_phase(player)

        result = self._check_game_over()
        if result:
            self.game_over = True
            self.winner = result

    async def _execute_eulogy(self, dead_player: Player):
        try:
            await self.broadcast("eulogy_start", {
                "player": dead_player.name,
                "message": f"{dead_player.name}（{dead_player.display_role}）正在发表遗言...",
                "role": dead_player.role.value,
                "role_name": dead_player.display_role,
            })

            await asyncio.sleep(SLEEP_AFTER_SUB_PHASE)

            await self.broadcast("ai_thinking", {"player": dead_player.name, "message": f"{dead_player.name}正在思考遗言..."})
            ai = AIPlayer(dead_player, self.providers)
            gs = self._build_game_state({
                "is_eulogy": True,
                "eulogy_target": dead_player.name,
            })

            try:
                result = await asyncio.wait_for(ai.eulogy_action(gs), timeout=AI_EULOGY_TIMEOUT)
                speech = result.get("speech", result if isinstance(result, str) else "...")
                reasoning = result.get("reasoning", "") if isinstance(result, dict) else ""
                if reasoning:
                    await self.broadcast("ai_reasoning", {"player": dead_player.name, "reasoning": reasoning})
            except asyncio.TimeoutError:
                logger.warning(f"玩家 {dead_player.name} 遗言超时，使用默认遗言")
                speech = f"我是{dead_player.name}，很遗憾要离开了。希望大家能找出真正的狼人。"

            speech = smart_truncate(speech)
            entry = {"player": dead_player.name, "player_id": dead_player.id, "content": speech, "round": self.round, "is_eulogy": True}
            self.speech_log.append(entry)
            log_player_action(dead_player.name, "遗言", speech[:50])

            eulogy_entry = f"{dead_player.name}(遗言): {speech}"
            round_found = False
            for rd in self.speech_by_round:
                if rd.get("round") == self.round:
                    rd["speeches"].append(eulogy_entry)
                    round_found = True
                    break
            if not round_found:
                self.speech_by_round.append({
                    "round": self.round,
                    "speeches": [eulogy_entry]
                })

            self.current_round_speeches.append(eulogy_entry)

            await self.broadcast("eulogy_speech", entry)

            await self.voice_player.speak(speech, dead_player.role, dead_player.name, f"eulogy_{dead_player.id}_{self.round}")

            await asyncio.sleep(SLEEP_AFTER_EULOGY)

            await self.broadcast("eulogy_end", {
                "player": dead_player.name,
                "player_id": dead_player.id,
            })
        except Exception as e:
            logger.error(f"执行 {dead_player.name} 遗言时出错：{e}")
            await self.broadcast("eulogy_end", {
                "player": dead_player.name,
                "player_id": dead_player.id,
            })

    async def _werewolf_phase(self) -> Optional[str]:
        wolves = self._get_alive_by_role(RoleType.WEREWOLF)
        if not wolves:
            return None

        targets = [p.name for p in self._get_alive_players() if p.role != RoleType.WEREWOLF]
        if not targets:
            return None

        await self.broadcast("sub_phase", {
            "sub_phase": "werewolf",
            "message": "狼人请睁眼，选择今晚要击杀的目标...",
        })
        await asyncio.sleep(SLEEP_AFTER_SUB_PHASE)

        votes = {}
        for wolf in wolves:
            await self.broadcast("ai_thinking", {"player": wolf.name, "message": f"{wolf.name}正在思考..."})
            ai = AIPlayer(wolf, self.providers)
            shuffled_targets = list(targets)
            random.shuffle(shuffled_targets)
            gs = self._build_game_state({
                "kill_targets": shuffled_targets,
                "werewolf_teammates": [w.name for w in wolves if w.id != wolf.id],
            })
            action = await ai.werewolf_action(gs)
            reasoning = action.get("reasoning", "")
            if reasoning:
                await self.broadcast("ai_reasoning", {"player": wolf.name, "reasoning": reasoning})
            if action["target"] and action["target"] in targets:
                votes[action["target"]] = votes.get(action["target"], 0) + 1
                self.night_log.append({
                    "player": wolf.name, "action": "werewolf_suggest",
                    "target": action["target"], "reason": action.get("reason", ""),
                })
            await asyncio.sleep(SLEEP_WEREWOLF_VOTE_PAUSE)

        if votes:
            max_votes = max(votes.values())
            top_targets = [t for t, v in votes.items() if v == max_votes]
            target = random.choice(top_targets)
        else:
            target = random.choice(targets)

        self.night_kill_target = target
        self.night_log.append({"player": "狼人", "action": "kill", "target": target})

        return target

    async def _seer_phase(self) -> Optional[dict]:
        seers = self._get_alive_by_role(RoleType.SEER)
        if not seers:
            return None

        seer = seers[0]
        targets = [p.name for p in self._get_alive_players() if p.id != seer.id]
        random.shuffle(targets)

        await self.broadcast("sub_phase", {
            "sub_phase": "seer",
            "message": "预言家请睁眼，选择要查验的玩家...",
        })
        await asyncio.sleep(SLEEP_AFTER_SUB_PHASE)

        await self.broadcast("ai_thinking", {"player": seer.name, "message": f"{seer.name}正在思考..."})
        ai = AIPlayer(seer, self.providers)
        gs = self._build_game_state({
            "check_targets": targets,
            "seer_results": self.seer_results,
        })
        action = await ai.seer_action(gs)
        target_name = action["target"]
        reasoning = action.get("reasoning", "")
        if reasoning:
            await self.broadcast("ai_reasoning", {"player": seer.name, "reasoning": reasoning})

        if target_name and target_name in targets:
            target_player = self._get_player_by_name(target_name)
            is_wolf = target_player.role == RoleType.WEREWOLF
            result_text = f"查验{target_name}：{'狼人' if is_wolf else '好人'}"
            self.seer_results.append(result_text)

            return {"target": target_name, "is_werewolf": is_wolf}

        return None

    async def _witch_phase(self, kill_target: Optional[str]) -> dict:
        witches = self._get_alive_by_role(RoleType.WITCH)
        if not witches:
            return {"save": False, "poison": None}

        witch = witches[0]
        poison_targets = [p.name for p in self._get_alive_players() if p.id != witch.id]
        random.shuffle(poison_targets)

        await self.broadcast("sub_phase", {
            "sub_phase": "witch",
            "message": "女巫请睁眼...",
        })
        await asyncio.sleep(SLEEP_AFTER_SUB_PHASE)

        if kill_target:
            await self.broadcast("witch_info", {
                "killed_player": kill_target,
                "has_antidote": not self.witch_antidote_used,
                "has_poison": not self.witch_poison_used,
            })

        await self.broadcast("ai_thinking", {"player": witch.name, "message": f"{witch.name}正在思考..."})
        ai = AIPlayer(witch, self.providers)
        gs = self._build_game_state({
            "poison_targets": poison_targets,
        })
        action = await ai.witch_action(
            gs, kill_target,
            not self.witch_antidote_used,
            not self.witch_poison_used,
        )
        save = action.get("save", False)
        poison = action.get("poison", None)
        reasoning = action.get("reasoning", "")
        if reasoning:
            await self.broadcast("ai_reasoning", {"player": witch.name, "reasoning": reasoning})

        if save:
            self.witch_antidote_used = True
            self.witch_save_history.append(kill_target)
        if poison:
            self.witch_poison_used = True
            self.witch_poison_history.append(poison)

        return {"save": save, "poison": poison}

    async def _guard_phase(self) -> Optional[str]:
        guards = self._get_alive_by_role(RoleType.GUARD)
        if not guards:
            return None

        guard = guards[0]
        targets = [p.name for p in self._get_alive_players()]
        if self.last_guard_target:
            targets = [t for t in targets if t != self.last_guard_target]
        random.shuffle(targets)

        guard_message = "守卫请睁眼，选择要保护的玩家..."
        if self.last_guard_target:
            guard_message += f"\n注意：今晚不能保护 {self.last_guard_target}"

        await self.broadcast("sub_phase", {
            "sub_phase": "guard",
            "message": guard_message,
        })
        await asyncio.sleep(SLEEP_AFTER_SUB_PHASE)

        await self.broadcast("ai_thinking", {"player": guard.name, "message": f"{guard.name}正在思考..."})
        ai = AIPlayer(guard, self.providers)
        gs = self._build_game_state({
            "protect_targets": targets,
        })
        action = await ai.guard_action(gs, self.last_guard_target)
        target_name = action["target"]
        reasoning = action.get("reasoning", "")
        if reasoning:
            await self.broadcast("ai_reasoning", {"player": guard.name, "reasoning": reasoning})

        if target_name and target_name in targets:
            self.last_guard_target = target_name
            self.guard_history.append(f"第{self.round}夜保护了{target_name}")
            return target_name

        return None

    async def _hunter_phase(self, hunter: Player):
        targets = [p.name for p in self._get_alive_players() if p.id != hunter.id]
        random.shuffle(targets)
        if not targets:
            return

        await self.broadcast("hunter_shoot", {
            "hunter": hunter.name,
            "message": f"{hunter.name}是猎人，可以开枪带走一名玩家！",
        })
        await asyncio.sleep(SLEEP_AFTER_SUB_PHASE)

        await self.broadcast("ai_thinking", {"player": hunter.name, "message": f"{hunter.name}正在思考..."})
        ai = AIPlayer(hunter, self.providers)
        gs = self._build_game_state({"shoot_targets": targets})
        action = await ai.hunter_action(gs)
        target_name = action["target"]
        reasoning = action.get("reasoning", "")
        if reasoning:
            await self.broadcast("ai_reasoning", {"player": hunter.name, "reasoning": reasoning})

        if target_name and target_name in targets:
            target_player = self._get_player_by_name(target_name)
            if target_player:
                target_player.is_alive = False
                self.death_log.append({
                    "name": target_name,
                    "round": self.round,
                    "cause": "shoot",
                    "role": target_player.role.value,
                    "seat": target_player.seat_number,
                })
                self.last_dead_seat = target_player.seat_number
                log_game_state("hunter", self.round, f"{hunter.name}（猎人）开枪带走了{target_name}")
                self.public_log.append(f"第{self.round}轮：{hunter.name}（猎人）开枪带走了{target_name}（{target_player.display_role}）")

                await self.broadcast("hunter_result", {
                    "hunter": hunter.name,
                    "target": target_name,
                    "target_role": target_player.role.value,
                    "target_role_name": target_player.display_role,
                })

                result = self._check_game_over()
                if result:
                    self.game_over = True
                    self.winner = result

    def _resolve_night(self, kill_target: Optional[str],
                        witch_result: dict, guard_target: Optional[str]) -> list:
        deaths = []

        if kill_target:
            saved = witch_result.get("save", False)
            guarded = (guard_target == kill_target)

            if not saved and not guarded:
                deaths.append({"name": kill_target, "cause": "werewolf"})

        poison_target = witch_result.get("poison")
        if poison_target:
            deaths.append({"name": poison_target, "cause": "poison"})

        seen = set()
        unique_deaths = []
        for d in deaths:
            if d["name"] not in seen:
                seen.add(d["name"])
                unique_deaths.append(d)

        return unique_deaths
