import json
import re
import random
import logging
from typing import Optional

from game.roles import RoleType


class ActionParserMixin:

    def _try_parse_json(self, response: str) -> Optional[dict]:
        json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
        if not json_match:
            return None
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            return None

    def _parse_target(self, response: str, valid_targets: list) -> Optional[str]:
        if not valid_targets:
            return None

        parsed = self._try_parse_json(response)
        if parsed and parsed.get("target"):
            target_name = parsed["target"].strip()
            for t in valid_targets:
                if target_name in t or t in target_name:
                    return t

        sorted_targets = sorted(valid_targets, key=len, reverse=True)

        action_patterns = [
            r'(?:查验|击杀|保护|开枪|投票|毒杀)\s*[：:]\s*[「【《〈]?\s*(\S+?)\s*[」】》〉]?',
            r'选择\s*[了]?\s*[「【《〈]?\s*(\S+?)\s*[」】》〉]?',
            r'目标\s*[是为：:]\s*[「【《〈]?\s*(\S+?)\s*[」】》〉]?',
        ]
        for pattern in action_patterns:
            match = re.search(pattern, response)
            if match:
                name = match.group(1).strip()
                for t in sorted_targets:
                    if name in t or t in name:
                        return t

        for target in sorted_targets:
            if target in response:
                return target

        logger = logging.getLogger(__name__)
        logger.warning("AI 玩家 %s 的目标解析失败，响应内容无法匹配任何目标: %s，随机选择目标",
                       self.player.name, response[:100])
        return random.choice(valid_targets)

    def _parse_witch_action(self, response: str, killed_player: str,
                             has_antidote: bool, has_poison: bool,
                             poison_targets: list) -> dict:
        result = {"save": False, "poison": None}

        parsed = self._try_parse_json(response)
        if parsed:
            action = parsed.get("action", "").lower()
            target = parsed.get("target", "")
            if action == "save" and has_antidote and killed_player:
                result["save"] = True
                return result
            elif action == "poison" and has_poison and target:
                for t in poison_targets:
                    if target in t or t in target:
                        result["poison"] = t
                        return result
            elif action == "none":
                return result

        action_line = ""
        for line in response.split("\n"):
            line_stripped = line.strip()
            if line_stripped.startswith("行动") and ("：" in line_stripped or ":" in line_stripped):
                action_line = line_stripped
                break
        search_text = action_line if action_line else response

        save_used = False
        if has_antidote and killed_player:
            save_patterns = [
                r'行动\s*[：:]\s*救',
                r'行动\s*[：:]\s*使用解药',
                r'救\s*' + re.escape(killed_player),
                r'使用解药',
                r'救活',
                r' antidote ',
                r'救他', r'救她', r'救这个人',
                r'^救$',
            ]
            for pat in save_patterns:
                if re.search(pat, search_text):
                    save_used = True
                    break

            if save_used:
                no_save_patterns = [
                    r'不\s*救', r'不使用解药', r'不\s*用解药',
                    r'行动\s*[：:]\s*不', r'放弃.*救',
                ]
                explicitly_no_save = any(re.search(p, search_text) for p in no_save_patterns)
                if explicitly_no_save:
                    save_used = False

        poison_used = None
        if has_poison:
            poison_action_patterns = [
                r'行动\s*[：:]\s*毒杀',
                r'行动\s*[：:]\s*使用毒药',
                r'毒杀[：:]\s*\S+',
                r'使用毒药',
            ]
            has_poison_intent = False
            for pat in poison_action_patterns:
                match = re.search(pat, search_text)
                if match:
                    has_poison_intent = True
                    for target in poison_targets:
                        if target in match.group(0):
                            poison_used = target
                            break
                    if poison_used:
                        break

            if has_poison_intent and poison_used is None:
                poison_keywords = ["毒杀", "使用毒药", "poison", "毒他", "毒她", "毒这个人"]
                for kw in poison_keywords:
                    if kw in search_text:
                        idx = search_text.find(kw)
                        before_kw = search_text[max(0, idx - 3):idx]
                        if "不" not in before_kw and "没" not in before_kw:
                            ctx = search_text[max(0, idx - 10):min(len(search_text), idx + 30)]
                            for target in poison_targets:
                                if target in ctx:
                                    t_idx = ctx.find(target)
                                    before_t = ctx[max(0, t_idx - 5):t_idx]
                                    if "不" not in before_t and "没" not in before_t:
                                        poison_used = target
                                        break
                            if poison_used:
                                break

            if has_poison_intent:
                no_poison_patterns = [
                    r'不\s*毒', r'不使用毒药', r'不毒杀',
                    r'行动\s*[：:]\s*不', r'放弃.*毒',
                ]
                explicitly_no_poison = any(re.search(p, search_text) for p in no_poison_patterns)
                if explicitly_no_poison:
                    poison_used = None
                    has_poison_intent = False

        if save_used and poison_used is not None:
            result["save"] = True
            result["poison"] = None
        elif save_used:
            result["save"] = True
        elif poison_used is not None:
            result["poison"] = poison_used

        return result

    def _generate_werewolf_speech_from_thinking(self, thinking: str, game_state: dict) -> str:
        alive_players = game_state.get("alive_players", [])

        if len(alive_players) >= 2:
            other_players = [p for p in alive_players if p != self.player.name]
            if other_players:
                target = other_players[0]
                return f"我是{self.player.name}，{target}的发言逻辑有问题。现在场上局势不明朗，我们需要更仔细地分析每个人的发言。"

        return f"我是{self.player.name}，现在局势很复杂。我需要更多信息才能做出判断。建议大家都坦诚一点，把各自的信息说清楚。"

    def _generate_seer_speech_from_thinking(self, thinking: str, game_state: dict) -> str:
        seer_results = game_state.get("seer_results", [])

        if seer_results:
            latest_result = seer_results[-1]
            return f"我是预言家，{latest_result}。请大家相信我的查验结果，我们一起把狼人找出来。"
        else:
            return f"我是{self.player.name}，我拥有特殊信息，但暂时不便透露。请大家相信我，我会带领好人阵营获胜。"

    def _generate_witch_speech_from_thinking(self, thinking: str, game_state: dict) -> str:
        witch_info = ""
        if "解药" in thinking or "毒药" in thinking:
            witch_info = "根据夜晚发生的情况，我觉得我们需要更加谨慎。"

        return f"我是{self.player.name}，{witch_info}现在需要大家积极发言，一起找出真正的狼人。"

    def _generate_villager_speech_from_thinking(self, thinking: str, game_state: dict) -> str:
        alive_players = game_state.get("alive_players", [])

        if len(alive_players) <= 3:
            return f"我是{self.player.name}，现在只剩三人，情况很危急。我们需要仔细分析每个人的发言逻辑，找出真正的坏人。"
        else:
            return f"我是{self.player.name}，我会仔细分析大家的发言，找出可疑之处。请大家保持冷静，理性分析。"
