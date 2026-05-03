import re
import logging
from typing import Optional

from game.roles import RoleType, ROLE_INFO
from game.ai_player import AIPlayer
from game.text_utils import filter_think_process
from game.prompts import get_mvp_vote_system_prompt

logger = logging.getLogger(__name__)


class MVPMixin:

    async def _evaluate_mvp(self) -> tuple:
        mvp_votes = {}
        mvp_reasons = {}

        for player in self.players:
            ai = AIPlayer(player, self.providers)
            system_prompt = get_mvp_vote_system_prompt(
                player.name, player.role, self.winner
            )

            other_players = [p.name for p in self.players if p.id != player.id]

            gs = self._build_game_state({"mvp_candidates": other_players})

            user_prompt = (
                f"{self._build_game_summary()}\n"
                f"可评选的玩家：{', '.join(other_players)}\n"
                "请评选本局MVP。"
            )

            try:
                response = await ai.call_llm(system_prompt, user_prompt)
                content = response.get("content", "")
                content = filter_think_process(content)

                target = self._parse_mvp_target(content, other_players)
                if target:
                    mvp_votes[target] = mvp_votes.get(target, 0) + 1
                    if target not in mvp_reasons:
                        mvp_reasons[target] = content[:200]
            except Exception as e:
                logger.warning("MVP评选失败，玩家 %s: %s", player.name, e)

        if not mvp_votes:
            return None, {}

        winner_team = self.winner
        max_votes = max(mvp_votes.values())
        top_candidates = [name for name, count in mvp_votes.items() if count == max_votes]

        if len(top_candidates) == 1:
            mvp_name = top_candidates[0]
        else:
            winning_team_candidates = []
            for name in top_candidates:
                p = self._get_player_by_name(name)
                if p and ((winner_team == "good" and p.role != RoleType.WEREWOLF) or
                          (winner_team == "wolf" and p.role == RoleType.WEREWOLF)):
                    winning_team_candidates.append(name)
            mvp_name = winning_team_candidates[0] if winning_team_candidates else top_candidates[0]

        return mvp_name, mvp_reasons

    def _parse_mvp_target(self, response: str, candidates: list) -> Optional[str]:
        sorted_candidates = sorted(candidates, key=len, reverse=True)

        patterns = [
            r'MVP\s*[：:]\s*[「【《〈]?\s*(\S+?)\s*[」】》〉]?',
            r'评选\s*[：:]\s*[「【《〈]?\s*(\S+?)\s*[」】》〉]?',
        ]
        for pattern in patterns:
            match = re.search(pattern, response)
            if match:
                name = match.group(1).strip()
                for t in sorted_candidates:
                    if name in t or t in name:
                        return t

        for target in sorted_candidates:
            if target in response:
                return target

        return None

    def _build_game_summary(self) -> str:
        lines = []
        lines.append(f"【游戏回顾】第{self.round}轮结束，{'好人阵营' if self.winner == 'good' else '狼人阵营'}获胜")

        lines.append("\n【角色揭晓】")
        for p in self.players:
            status = "存活" if p.is_alive else "死亡"
            role_name = ROLE_INFO[p.role]["name"]
            team = "狼人阵营" if p.role == RoleType.WEREWOLF else "好人阵营"
            lines.append(f"  {p.name}（{role_name}，{team}）-{status}")

        if self.death_log:
            lines.append("\n【死亡记录】")
            for dl in self.death_log:
                cause_map = {"werewolf": "夜间被杀", "kill": "夜间被杀", "poison": "被毒杀", "vote": "被投票放逐", "shoot": "被猎人带走"}
                cause_text = cause_map.get(dl["cause"], dl["cause"])
                lines.append(f"  第{dl['round']}轮：{dl['name']} {cause_text}")

        if self.vote_log:
            lines.append("\n【投票记录】")
            for vl in self.vote_log:
                round_num = vl.get("round", "?")
                votes = vl.get("votes", {})
                vote_lines = [f"{voter}→{target}" for voter, target in votes.items()]
                eliminated = vl.get("eliminated", "无")
                lines.append(f"  第{round_num}轮：{', '.join(vote_lines)}；放逐：{eliminated}")

        if self.seer_results:
            lines.append("\n【预言家查验记录】")
            for r in self.seer_results:
                lines.append(f"  {r}")

        if self.witch_save_history:
            lines.append("\n【女巫救人记录】")
            for r in self.witch_save_history:
                lines.append(f"  {r}")

        if self.witch_poison_history:
            lines.append("\n【女巫毒杀记录】")
            for r in self.witch_poison_history:
                lines.append(f"  {r}")

        if self.guard_history:
            lines.append("\n【守卫保护记录】")
            for r in self.guard_history:
                lines.append(f"  {r}")

        if self.speech_by_round:
            lines.append("\n【发言记录】")
            for rd in self.speech_by_round:
                round_num = rd.get("round", "?")
                lines.append(f"  第{round_num}轮：")
                for sp in rd.get("speeches", []):
                    lines.append(f"    {sp}")

        return "\n".join(lines)
