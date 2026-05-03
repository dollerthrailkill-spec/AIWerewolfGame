import asyncio
import random
from typing import Optional

from game.roles import Player, RoleType, ROLE_INFO
from game.ai_player import AIPlayer
from game.utils import smart_truncate
from game.config import (
    SLEEP_AFTER_DAY_START,
    SLEEP_BETWEEN_SPEECHES,
    SLEEP_AFTER_VOTE_START,
)
from logger import log_game_state, log_player_action


class DayPhaseMixin:

    async def day_phase(self):
        self.phase = "day"
        self.current_round_speeches = []

        await self.broadcast("phase_change", {
            "phase": "day",
            "round": self.round,
            "message": f"第{self.round}天，讨论开始",
        })
        await asyncio.sleep(SLEEP_AFTER_DAY_START)

        if not self.is_running or self.game_over:
            return
        await self._wait_if_paused()

        await self._discussion_phase()

        if not self.is_running or self.game_over:
            return
        await self._wait_if_paused()

        await self._vote_phase()

        result = self._check_game_over()
        if result:
            self.game_over = True
            self.winner = result

    async def _discussion_phase(self):
        alive = self._get_alive_players()

        speaking_order = []
        if self.last_dead_seat is not None:
            dead_seat = self.last_dead_seat
            alive_sorted = sorted(alive, key=lambda p: p.seat_number)

            dead_index = -1
            for i, p in enumerate(alive_sorted):
                if p.seat_number == dead_seat:
                    dead_index = i
                    break

            if dead_index != -1:
                if dead_index == len(alive_sorted) - 1:
                    speaking_order = alive_sorted
                else:
                    speaking_order = alive_sorted[dead_index+1:] + alive_sorted[:dead_index+1]
            else:
                self.last_dead_seat = None
                speaking_order = alive_sorted
        else:
            speaking_order = sorted(alive, key=lambda p: p.seat_number)

        for player in speaking_order:
            if not player.is_alive:
                continue

            if not self.is_running or self.game_over:
                break

            await self.broadcast("current_speaker", {
                "player": player.name,
                "player_id": player.id,
                "message": f"轮到 {player.name} 发言",
            })

            await self.broadcast("ai_thinking", {"player": player.name, "message": f"{player.name}正在思考发言..."})
            ai = AIPlayer(player, self.providers)
            extra_state = {
                "today_speeches": self.current_round_speeches,
                "speaking_order": [p.name for p in speaking_order],
                "already_spoken": [s.split(":")[0] for s in self.current_round_speeches],
            }
            if player.role == RoleType.WEREWOLF:
                wolves = self._get_alive_by_role(RoleType.WEREWOLF)
                extra_state["werewolf_teammates"] = [w.name for w in wolves if w.id != player.id]
            gs = self._build_game_state(extra_state)
            result = await ai.day_speech(gs)

            if not self.is_running or self.game_over:
                break

            speech = result.get("speech", result if isinstance(result, str) else "...")
            reasoning = result.get("reasoning", "") if isinstance(result, dict) else ""
            if reasoning:
                await self.broadcast("ai_reasoning", {"player": player.name, "reasoning": reasoning})

            speech = smart_truncate(speech)
            entry = {"player": player.name, "player_id": player.id, "content": speech, "round": self.round}
            self.speech_log.append(entry)
            self.current_round_speeches.append(f"{player.name}: {speech}")
            log_player_action(player.name, "发言", speech[:50])

            await self.broadcast("speech", entry)

            await self.voice_player.speak(speech, player.role, player.name, f"speech_{player.id}_{self.round}")

            await asyncio.sleep(SLEEP_BETWEEN_SPEECHES)

        if self.current_round_speeches:
            existing_round = None
            for rd in self.speech_by_round:
                if rd.get("round") == self.round:
                    existing_round = rd
                    break
            if existing_round:
                existing_round["speeches"] = self.current_round_speeches
            else:
                self.speech_by_round.append({
                    "round": self.round,
                    "speeches": self.current_round_speeches
                })

    async def _vote_phase(self):
        alive = self._get_alive_players()
        vote_targets = [p.name for p in alive]

        await self.broadcast("vote_start", {
            "message": "投票环节开始，请选择要放逐的玩家",
            "targets": vote_targets,
        })
        await asyncio.sleep(SLEEP_AFTER_VOTE_START)

        votes = {}
        vote_details = []

        for player in alive:
            if not player.is_alive:
                continue

            if not self.is_running or self.game_over:
                break

            await self.broadcast("ai_thinking", {"player": player.name, "message": f"{player.name}正在思考投票..."})
            ai = AIPlayer(player, self.providers)
            extra_state = {
                "vote_targets": vote_targets,
                "today_speeches": self.current_round_speeches,
            }
            if player.role == RoleType.WEREWOLF:
                wolves = self._get_alive_by_role(RoleType.WEREWOLF)
                extra_state["werewolf_teammates"] = [w.name for w in wolves if w.id != player.id]
            gs = self._build_game_state(extra_state)
            action = await ai.vote_action(gs)

            if not self.is_running or self.game_over:
                break

            target = action["target"]
            reasoning = action.get("reasoning", "")
            if reasoning:
                await self.broadcast("ai_reasoning", {"player": player.name, "reasoning": reasoning})

            if target and target in vote_targets:
                votes[target] = votes.get(target, 0) + 1
                vote_details.append({"voter": player.name, "target": target})

        await self.broadcast("vote_details", {"votes": vote_details})

        vote_record = {
            "round": self.round,
            "votes": {vd["voter"]: vd["target"] for vd in vote_details},
            "eliminated": None,
        }

        if votes:
            max_votes = max(votes.values())
            top_targets = [t for t, v in votes.items() if v == max_votes]

            if len(top_targets) == 1:
                eliminated_name = top_targets[0]
                eliminated = self._get_player_by_name(eliminated_name)
                if eliminated:
                    eliminated.is_alive = False
                    self.death_log.append({
                        "name": eliminated_name,
                        "round": self.round,
                        "cause": "vote",
                        "role": eliminated.role.value,
                        "seat": eliminated.seat_number,
                    })
                    self.last_dead_seat = eliminated.seat_number
                    log_game_state("vote", self.round, f"{eliminated_name}（{eliminated.display_role}）被投票放逐")
                    self.public_log.append(f"第{self.round}天投票：{eliminated_name}（{eliminated.display_role}）被放逐")
                    vote_record["eliminated"] = eliminated_name

                    await self.broadcast("vote_result", {
                        "eliminated": eliminated_name,
                        "role": eliminated.role.value,
                        "role_name": eliminated.display_role,
                        "votes": votes,
                    })

                    await self._execute_eulogy(eliminated)

                    if eliminated.role == RoleType.HUNTER:
                        await self._hunter_phase(eliminated)
            else:
                await self.broadcast("vote_result", {
                    "eliminated": None,
                    "message": "平票，无人被放逐",
                    "votes": votes,
                })
                log_game_state("vote", self.round, "平票，无人被放逐")
                self.last_dead_seat = None
        else:
            await self.broadcast("vote_result", {
                "eliminated": None,
                "message": "无人投票",
            })
            self.last_dead_seat = None

        self.vote_log.append(vote_record)
