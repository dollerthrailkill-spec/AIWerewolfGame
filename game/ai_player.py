from typing import Optional

from game.roles import Player, RoleType, ROLE_INFO
from game.prompts import (
    get_werewolf_system_prompt,
    get_seer_system_prompt,
    get_witch_system_prompt,
    get_guard_system_prompt,
    get_hunter_system_prompt,
    get_day_speech_system_prompt,
    get_vote_system_prompt,
    get_eulogy_system_prompt,
)
from game.utils import smart_truncate as _smart_truncate
from game.text_utils import filter_think_process
from game.context_builder import ContextBuilderMixin, get_mode_config
from game.llm_client import LLMClientMixin
from game.action_parser import ActionParserMixin


class AIPlayer(ContextBuilderMixin, LLMClientMixin, ActionParserMixin):
    def __init__(self, player: Player, providers: dict):
        self.player = player
        self.providers = providers

    def _get_personality(self):
        cfg = self.player.model_config
        if cfg.use_default_personality or not cfg.personality:
            return ROLE_INFO[self.player.role]["default_personality"]
        return cfg.personality

    def _get_role_name_for_ctx(self) -> str:
        return ROLE_INFO.get(self.player.role, {}).get("name", "未知")

    async def werewolf_action(self, game_state: dict) -> dict:
        personality = self._get_personality()
        context = self._build_game_context(game_state, is_night=True)
        wolf_ctx = self._build_werewolf_context(game_state)
        targets = game_state.get("kill_targets", [])

        player_count = game_state.get("initial_player_count", 6)
        config_desc = get_mode_config(player_count)

        system_prompt = get_werewolf_system_prompt(
            self.player.name, personality, player_count, config_desc
        )
        user_prompt = f"{context}\n{wolf_ctx}\n可选目标：{', '.join(targets)}\n请选择击杀目标。"

        response = await self.call_llm(system_prompt, user_prompt)
        content = response["content"]
        reasoning = response.get("reasoning", "")
        parsed = self._try_parse_json(content)
        reason = parsed.get("reason", _smart_truncate(content)) if parsed else _smart_truncate(content)
        target = self._parse_target(content, targets)
        return {"target": target, "reason": reason, "reasoning": reasoning}

    async def eulogy_action(self, game_state: dict) -> dict:
        personality = self._get_personality()
        context = self._build_game_context(game_state, is_night=False)

        system_prompt = get_eulogy_system_prompt(
            self.player.name, personality, self.player.role
        )
        user_prompt = f"{context}\n请发表你的遗言。"

        response = await self.call_llm(system_prompt, user_prompt)
        content = response["content"]
        reasoning = response.get("reasoning", "")

        parsed = self._try_parse_json(content)
        if parsed and parsed.get("speech"):
            content = parsed["speech"]

        content = filter_think_process(content)

        if not content:
            content = f"我是{self.player.name}，很遗憾要离开了。希望大家能找出真正的坏人。"

        return {"speech": _smart_truncate(content), "reasoning": reasoning}

    async def seer_action(self, game_state: dict) -> dict:
        personality = self._get_personality()
        context = self._build_game_context(game_state, is_night=True)
        seer_ctx = self._build_seer_context(game_state)
        targets = game_state.get("check_targets", [])

        player_count = game_state.get("initial_player_count", 6)
        config_desc = get_mode_config(player_count)

        system_prompt = get_seer_system_prompt(
            self.player.name, personality, player_count, config_desc
        )
        user_prompt = f"{context}\n{seer_ctx}\n可查验对象：{', '.join(targets)}\n请选择查验对象。"

        response = await self.call_llm(system_prompt, user_prompt)
        content = response["content"]
        reasoning = response.get("reasoning", "")
        parsed = self._try_parse_json(content)
        reason = parsed.get("reason", _smart_truncate(content)) if parsed else _smart_truncate(content)
        target = self._parse_target(content, targets)
        return {"target": target, "reason": reason, "reasoning": reasoning}

    async def witch_action(self, game_state: dict, killed_player: str,
                            has_antidote: bool, has_poison: bool) -> dict:
        personality = self._get_personality()
        context = self._build_game_context(game_state, is_night=True)
        witch_ctx = self._build_witch_context(game_state, killed_player, has_antidote, has_poison)
        poison_targets = game_state.get("poison_targets", [])

        player_count = game_state.get("initial_player_count", 6)
        config_desc = get_mode_config(player_count)

        system_prompt = get_witch_system_prompt(
            self.player.name, personality, player_count, config_desc
        )
        user_prompt = f"{context}\n{witch_ctx}\n可毒杀对象：{', '.join(poison_targets)}\n请决定你的行动。"

        response = await self.call_llm(system_prompt, user_prompt)
        content = response["content"]
        reasoning = response.get("reasoning", "")
        parsed = self._try_parse_json(content)
        reason = parsed.get("reason", _smart_truncate(content)) if parsed else _smart_truncate(content)
        action = self._parse_witch_action(content, killed_player, has_antidote, has_poison, poison_targets)
        return {**action, "reason": reason, "reasoning": reasoning}

    async def guard_action(self, game_state: dict, last_protected: Optional[str]) -> dict:
        personality = self._get_personality()
        context = self._build_game_context(game_state, is_night=True)
        guard_ctx = self._build_guard_context(game_state, last_protected)
        targets = game_state.get("protect_targets", [])

        player_count = game_state.get("initial_player_count", 6)
        config_desc = get_mode_config(player_count)

        system_prompt = get_guard_system_prompt(
            self.player.name, personality, player_count, config_desc
        )
        user_prompt = f"{context}\n{guard_ctx}\n可保护对象：{', '.join(targets)}\n请选择保护对象。"

        response = await self.call_llm(system_prompt, user_prompt)
        content = response["content"]
        reasoning = response.get("reasoning", "")
        parsed = self._try_parse_json(content)
        reason = parsed.get("reason", _smart_truncate(content)) if parsed else _smart_truncate(content)
        target = self._parse_target(content, targets)
        return {"target": target, "reason": reason, "reasoning": reasoning}

    async def hunter_action(self, game_state: dict) -> dict:
        personality = self._get_personality()
        context = self._build_game_context(game_state, is_night=True)
        targets = game_state.get("shoot_targets", [])

        player_count = game_state.get("initial_player_count", 6)
        config_desc = get_mode_config(player_count)

        system_prompt = get_hunter_system_prompt(
            self.player.name, personality, player_count, config_desc
        )
        user_prompt = f"{context}\n可开枪对象：{', '.join(targets)}\n请选择开枪目标。"

        response = await self.call_llm(system_prompt, user_prompt)
        content = response["content"]
        reasoning = response.get("reasoning", "")
        parsed = self._try_parse_json(content)
        reason = parsed.get("reason", _smart_truncate(content)) if parsed else _smart_truncate(content)
        target = self._parse_target(content, targets)
        return {"target": target, "reason": reason, "reasoning": reasoning}

    async def day_speech(self, game_state: dict) -> dict:
        personality = self._get_personality()
        context = self._build_game_context(game_state, is_night=False)
        speeches = game_state.get("today_speeches", [])
        speech_ctx = ""
        if speeches:
            speech_ctx = "今天已有的发言：\n" + "\n".join(speeches)

        role_name = ROLE_INFO[self.player.role]["name"]
        speaking_order = game_state.get("speaking_order", [])
        already_spoken = game_state.get("already_spoken", [])

        player_count = game_state.get("initial_player_count", 6)
        config_desc = get_mode_config(player_count)

        order_tip = ""
        if speaking_order:
            order_tip = "\n【本轮发言顺序】\n"
            for i, name in enumerate(speaking_order, 1):
                if name == self.player.name:
                    order_tip += f"  {i}. {name} ← 当前轮到你发言\n"
                elif name in already_spoken:
                    order_tip += f"  {i}. {name} ✓ 已发言\n"
                else:
                    order_tip += f"  {i}. {name} ⏳ 待发言\n"
            order_tip += "\n注意：你只能看到已发言玩家的内容，不能看到未发言玩家的发言。\n"

        system_prompt = get_day_speech_system_prompt(
            self.player.name, personality, player_count, config_desc,
            self.player.role, order_tip
        )
        user_prompt = f"{context}\n{speech_ctx}\n轮到你发言了。"

        response = await self.call_llm(system_prompt, user_prompt)
        content = response["content"]
        reasoning = response.get("reasoning", "")

        parsed = self._try_parse_json(content)
        if parsed and parsed.get("speech"):
            content = parsed["speech"]

        content = filter_think_process(content)

        third_person_patterns = [
            (f"{self.player.name}认为", "我认为"),
            (f"{self.player.name}说", "我说"),
            (f"{self.player.name}觉得", "我觉得"),
            (f"{self.player.name}分析", "我分析"),
            (f"{self.player.name}判断", "我判断"),
            (f"{self.player.name}看", "我看"),
        ]
        for pattern, replacement in third_person_patterns:
            content = content.replace(pattern, replacement)

        if content and ("首先" in content[:50] or "当前是" in content[:50] or "我的身份" in content[:50]):
            speech_markers = ["我认为：", "我说：", "发言：", "我的观点：", "总结：", "因此，", "我的策略：", "我的建议："]
            for marker in speech_markers:
                idx = content.rfind(marker)
                if idx >= 0:
                    potential_speech = content[idx:]
                    if len(potential_speech) < 500:
                        content = potential_speech
                        break

            if content == reasoning:
                if self.player.role == RoleType.WEREWOLF:
                    content = self._generate_werewolf_speech_from_thinking(content, game_state)
                elif self.player.role == RoleType.SEER:
                    content = self._generate_seer_speech_from_thinking(content, game_state)
                elif self.player.role == RoleType.WITCH:
                    content = self._generate_witch_speech_from_thinking(content, game_state)
                else:
                    content = self._generate_villager_speech_from_thinking(content, game_state)

        if not content:
            content = f"我是{self.player.name}，根据目前的局势，我会继续观察各位的发言和投票行为，找出真正的坏人。"

        return {"speech": _smart_truncate(content), "reasoning": reasoning}

    async def vote_action(self, game_state: dict) -> dict:
        personality = self._get_personality()
        context = self._build_game_context(game_state, is_night=False)
        speeches = game_state.get("today_speeches", [])
        targets = game_state.get("vote_targets", [])

        speech_ctx = ""
        if speeches:
            speech_ctx = "【本轮白天发言记录】\n" + "\n".join(speeches)

        system_prompt = get_vote_system_prompt(
            self.player.name, personality, self.player.role
        )
        user_prompt = f"{context}\n{speech_ctx}\n可投票对象：{', '.join(targets)}\n请根据发言内容和你的立场投票。"

        response = await self.call_llm(system_prompt, user_prompt)
        content = response["content"]
        reasoning = response.get("reasoning", "")
        parsed = self._try_parse_json(content)
        reason = parsed.get("reason", _smart_truncate(content)) if parsed else _smart_truncate(content)
        target = self._parse_target(content, targets)
        return {"target": target, "reason": reason, "reasoning": reasoning}
