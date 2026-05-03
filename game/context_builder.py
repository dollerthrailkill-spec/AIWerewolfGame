import random
from typing import Optional

from game.roles import RoleType, ROLE_INFO, GAME_CONFIGS
from game.config import MAX_SPEECH_HISTORY_LENGTH

MODE_CONFIGS = {
    6: "2 狼人 / 1 预言家 / 1 女巫 / 2 村民（无守卫、无猎人）",
    8: "2 狼人 / 1 预言家 / 1 女巫 / 1 猎人 / 3 村民（有猎人、无守卫）",
    10: "3 狼人 / 1 预言家 / 1 女巫 / 1 猎人 / 1 守卫 / 3 村民（有猎人、有守卫）",
}


def get_mode_config(player_count: int) -> str:
    if player_count in GAME_CONFIGS:
        return GAME_CONFIGS[player_count]["description"]
    return MODE_CONFIGS.get(player_count, f"{player_count}人局")


class ContextBuilderMixin:

    def _build_global_rules_context(self) -> str:
        lines = []
        lines.append("=" * 50)
        lines.append("【游戏规则与角色定义】")
        lines.append("")
        lines.append("【游戏目标】")
        lines.append("  好人阵营：找出并消灭所有狼人")
        lines.append("  狼人阵营：让狼人数量 ≥ 好人数量")
        lines.append("")
        lines.append("【角色定义与能力】")
        lines.append("  🐺 狼人：每晚可以与其他狼人商议，共同选择一名玩家击杀")
        lines.append("  🔮 预言家：每晚可以查验一名玩家的阵营（好人/狼人）")
        lines.append("  🧪 女巫：拥有一瓶解药（救活被狼人袭击者）和一瓶毒药（毒杀任意玩家），各只能用一次，同一晚只能用一种")
        lines.append("  🏹 猎人：死亡时可以开枪带走一名玩家（被毒死不能开枪）")
        lines.append("  🛡️ 守卫：每晚可以保护一名玩家免受狼人袭击，不能连续两晚保护同一人")
        lines.append("  👤 村民：没有特殊能力，通过发言和投票帮助好人阵营")
        lines.append("")
        lines.append("【游戏流程】")
        lines.append("  1. 夜晚阶段：狼人行动 → 预言家查验 → 女巫用药 → 守卫保护")
        lines.append("  2. 天亮阶段：公布死亡信息 → 遗言环节（如有）→ 白天讨论")
        lines.append("  3. 白天阶段：轮流发言 → 投票放逐一名玩家")
        lines.append("  4. 循环往复，直到某一方达成胜利条件")
        lines.append("")
        lines.append("【重要规则】")
        lines.append("  - 解药和毒药同一晚只能使用一种")
        lines.append("  - 守卫不能连续两晚保护同一人")
        lines.append("  - 猎人被毒死不能开枪")
        lines.append("  - 遗言只能发表一次，之后不能再发言")
        lines.append("=" * 50)
        return "\n".join(lines)

    def _build_public_context(self, game_state: dict) -> str:
        lines = []
        round_num = game_state.get("round", 1)
        is_eulogy = game_state.get("is_eulogy", False)
        player_count = game_state.get("initial_player_count", 6)

        lines.append(self._build_global_rules_context())
        lines.append("")

        config_desc = get_mode_config(player_count)
        lines.extend(self._build_game_overview(game_state, round_num, is_eulogy, player_count, config_desc))
        lines.append("")
        lines.extend(self._build_win_conditions(game_state))
        lines.extend(self._build_speaking_order(game_state))
        lines.extend(self._build_speech_history(game_state, round_num, is_eulogy))
        lines.extend(self._build_death_timeline(game_state))
        lines.extend(self._build_public_info(game_state))
        lines.extend(self._build_vote_history(game_state))
        lines.extend(self._build_past_speeches(game_state, round_num))
        lines.extend(self._build_public_events(game_state))
        lines.extend(self._build_situation_analysis(game_state))

        return "\n".join(lines)

    def _build_game_overview(self, game_state: dict, round_num: int, is_eulogy: bool, player_count: int, config_desc: str) -> list:
        lines = []
        lines.append("=" * 40)
        if is_eulogy:
            lines.append(f"【遗言环节】当前是第{round_num}轮 · {player_count}人局")
        else:
            lines.append(f"【游戏概况】当前是第{round_num}轮 · {player_count}人局")

        if round_num == 1:
            lines.append("📌 这是游戏的第一轮，之前没有任何白天发言和投票记录。")
        else:
            lines.append(f"📌 这是第{round_num}轮，请参考下方【历史发言】和【投票历史】了解之前轮次的情况，不要重复讨论已经确定的事情。")

        lines.append(f"游戏配置：{config_desc}")
        lines.append(f"初始玩家数：{player_count}人")

        alive = list(game_state.get("alive_players", []))
        dead = game_state.get("dead_players", [])
        alive_count = len(alive)
        dead_count = len(dead)
        random.shuffle(alive)
        lines.append(f"当前存活：{alive_count}人 ({', '.join(alive)})")
        lines.append(f"已死亡：{dead_count}人 ({', '.join(dead) if dead else '无'})")

        wolf_count = game_state.get("alive_wolf_count", "?")
        good_count = game_state.get("alive_good_count", "?")
        lines.append(f"存活狼人：约{wolf_count}人 | 存活好人：约{good_count}人")
        lines.append("=" * 40)
        return lines

    def _build_win_conditions(self, game_state: dict) -> list:
        lines = []
        lines.append("【获胜条件】")
        lines.append("  好人阵营胜利：消灭所有狼人")
        lines.append("  狼人阵营胜利：狼人数量 ≥ 好人数量")

        alive_count = len(game_state.get("alive_players", []))
        wolf_count = game_state.get("alive_wolf_count", "?")
        good_count = game_state.get("alive_good_count", "?")

        if alive_count > 0 and isinstance(good_count, int) and isinstance(wolf_count, int):
            if wolf_count >= good_count:
                lines.append(f"  ⚠️ 危险！狼人({wolf_count})≥好人({good_count})，好人阵营处于劣势！")
            elif wolf_count == 1:
                lines.append(f"  ✅ 只剩1个狼人，好人阵营接近胜利！")
            elif wolf_count == 2 and good_count >= 4:
                lines.append(f"  📊 局势均衡，需要谨慎投票。")

        lines.append("=" * 40)
        return lines

    def _build_speaking_order(self, game_state: dict) -> list:
        lines = []
        speaking_order = game_state.get("speaking_order", [])
        already_spoken = game_state.get("already_spoken", [])

        if speaking_order:
            lines.append("")
            lines.append("【本轮发言顺序】")
            for i, name in enumerate(speaking_order, 1):
                status = "✓ 已发言" if name in already_spoken else "⏳ 待发言"
                lines.append(f"  {i}. {name} - {status}")
        return lines

    def _build_speech_history(self, game_state: dict, round_num: int, is_eulogy: bool) -> list:
        lines = []
        if is_eulogy:
            return lines

        today_speeches = game_state.get("today_speeches", [])
        current_speeches = list(today_speeches) if today_speeches else []

        speech_by_round = game_state.get("speech_by_round", [])
        current_round_entries = [s for s in speech_by_round if s.get("round", 0) == round_num]
        for rd in current_round_entries:
            for sp in rd.get("speeches", []):
                if sp not in current_speeches:
                    current_speeches.append(sp)

        if current_speeches:
            lines.append("")
            lines.append("【本轮已发言】")
            speech_text = "\n".join(f"  {sp}" for sp in current_speeches)
            if len(speech_text) > MAX_SPEECH_HISTORY_LENGTH:
                speech_text = speech_text[:MAX_SPEECH_HISTORY_LENGTH] + "\n  ... (发言过长，已截断)"
            lines.append(speech_text)
        return lines

    def _build_death_timeline(self, game_state: dict) -> list:
        lines = []
        death_history = game_state.get("death_history", [])
        lines.append("")
        lines.append("【死亡时间线】")
        if death_history:
            for dh in death_history:
                lines.append(f"  {dh}")
        else:
            lines.append("目前无人死亡。")
        return lines

    def _build_public_info(self, game_state: dict) -> list:
        lines = []
        lines.append("")
        lines.append("【本轮公开信息】")

        night_result = game_state.get("last_night_result")
        if night_result:
            lines.append(f"昨晚：{night_result}")
        return lines

    def _build_vote_history(self, game_state: dict) -> list:
        lines = []
        vote_history = game_state.get("vote_history", [])
        if vote_history:
            lines.append("")
            lines.append("【投票历史】")
            for vh in vote_history:
                lines.append(f"  {vh}")
        return lines

    def _build_past_speeches(self, game_state: dict, round_num: int) -> list:
        lines = []
        speech_by_round = game_state.get("speech_by_round", [])
        past_speeches = [s for s in speech_by_round if s.get("round", 0) < round_num]

        if past_speeches:
            lines.append("")
            lines.append("【历史发言（之前轮次的白天发言）】")
            speech_text_parts = []
            for round_speech in past_speeches:
                round_num_speech = round_speech.get("round", "?")
                speeches = round_speech.get("speeches", [])
                speech_text_parts.append(f"  第{round_num_speech}轮白天：")
                for sp in speeches:
                    speech_text_parts.append(f"    {sp}")
            speech_text = "\n".join(speech_text_parts)
            if len(speech_text) > MAX_SPEECH_HISTORY_LENGTH:
                speech_text = speech_text[:MAX_SPEECH_HISTORY_LENGTH] + "\n  ... (历史发言过长，已截断)"
            lines.append(speech_text)
        else:
            lines.append("")
            lines.append("【历史发言】当前没有之前轮次的白天发言记录。")
        return lines

    def _build_public_events(self, game_state: dict) -> list:
        lines = []
        public_log = game_state.get("public_log", [])
        if public_log:
            lines.append("")
            lines.append("【公开事件时间线】")
            for entry in public_log:
                lines.append(f"  {entry}")
        return lines

    def _build_situation_analysis(self, game_state: dict) -> list:
        lines = []
        lines.append("")
        lines.append("【局势分析提示】")
        alive_count = len(game_state.get("alive_players", []))

        if alive_count <= 3:
            lines.append("⚠️ 游戏进入尾声，只剩 3 人以下，需要谨慎判断！")
        elif alive_count <= 5:
            lines.append("⚠️ 游戏中后期，局势逐渐明朗，注意观察细节。")
        return lines

    def _build_private_context(self, game_state: dict) -> str:
        lines = []

        public_ctx = self._build_public_context(game_state)
        lines.append(public_ctx)
        lines.append("")

        lines.append("=" * 40)
        lines.append("【你的私密信息】")
        lines.append("以下信息只有你知道，不要泄露给其他玩家！")
        lines.append("=" * 40)

        if self.player.role == RoleType.SEER:
            seer_results = game_state.get("seer_results", [])
            if seer_results:
                lines.append("")
                lines.append("【你的查验记录】")
                for r in seer_results:
                    lines.append(f"  {r}")

        if self.player.role == RoleType.WITCH:
            lines.append("")
            lines.append("【你的药水状态】")
            if game_state.get("witch_antidote_used") is False:
                lines.append("  解药：未使用")
            else:
                lines.append("  解药：已使用")
            if game_state.get("witch_poison_used") is False:
                lines.append("  毒药：未使用")
            else:
                lines.append("  毒药：已使用")
            save_history = game_state.get("witch_save_history", [])
            poison_history = game_state.get("witch_poison_history", [])
            if save_history:
                lines.append(f"  你曾使用解药救过：{', '.join(save_history)}")
            if poison_history:
                lines.append(f"  你曾使用毒药毒杀过：{', '.join(poison_history)}")

        if self.player.role == RoleType.GUARD:
            last_guard = game_state.get("last_guard_target")
            guard_history = game_state.get("guard_history", [])
            lines.append("")
            lines.append("【你的保护记录】")
            if guard_history:
                for gh in guard_history:
                    lines.append(f"  {gh}")
            if last_guard:
                lines.append(f"  上一晚保护的玩家：{last_guard}（今晚不能连续保护同一人）")
            else:
                lines.append("  你还没有保护过任何人。")

        return "\n".join(lines)

    def _build_game_context(self, game_state: dict, is_night: bool = False) -> str:
        if is_night:
            return self._build_private_context(game_state)
        else:
            public_ctx = self._build_public_context(game_state)
            private_ctx = self._build_role_private_info(game_state)
            if private_ctx:
                return f"{public_ctx}\n\n{private_ctx}"
            return public_ctx

    def _build_role_private_info(self, game_state: dict) -> str:
        lines = []
        lines.append("=" * 40)
        lines.append("【你的私密信息】")
        lines.append("以下信息只有你知道，你可以选择是否在发言中透露！")
        lines.append("=" * 40)

        if self.player.role == RoleType.SEER:
            seer_results = game_state.get("seer_results", [])
            if seer_results:
                lines.append("")
                lines.append("【你的查验记录】")
                for r in seer_results:
                    lines.append(f"  {r}")
            else:
                lines.append("")
                lines.append("【你的查验记录】你还没有查验过任何人。")

        elif self.player.role == RoleType.WITCH:
            lines.append("")
            lines.append("【你的药水状态】")
            if game_state.get("witch_antidote_used") is False:
                lines.append("  解药：未使用（仍可用）")
            else:
                lines.append("  解药：已使用")
            if game_state.get("witch_poison_used") is False:
                lines.append("  毒药：未使用（仍可用）")
            else:
                lines.append("  毒药：已使用")
            save_history = game_state.get("witch_save_history", [])
            poison_history = game_state.get("witch_poison_history", [])
            if save_history:
                lines.append(f"  你曾使用解药救过：{', '.join(save_history)}")
            if poison_history:
                lines.append(f"  你曾使用毒药毒杀过：{', '.join(poison_history)}")

        elif self.player.role == RoleType.GUARD:
            last_guard = game_state.get("last_guard_target")
            guard_history = game_state.get("guard_history", [])
            lines.append("")
            lines.append("【你的保护记录】")
            if guard_history:
                for gh in guard_history:
                    lines.append(f"  {gh}")
            if last_guard:
                lines.append(f"  上一晚保护的玩家：{last_guard}（今晚不能连续保护同一人）")
            else:
                lines.append("  你还没有保护过任何人。")

        elif self.player.role == RoleType.HUNTER:
            lines.append("")
            lines.append("【你的特殊能力】")
            lines.append("  你死亡时可以开枪带走一名玩家（被毒死除外）。")

        elif self.player.role == RoleType.WEREWOLF:
            wolves = game_state.get("werewolf_teammates", [])
            if wolves:
                lines.append("")
                lines.append("【你的同伴】")
                lines.append(f"  狼人同伴：{', '.join(wolves)}")

        return "\n".join(lines)

    def _build_werewolf_context(self, game_state: dict) -> str:
        lines = []
        wolves = game_state.get("werewolf_teammates", [])
        if wolves:
            lines.append(f"你的同伴：{', '.join(wolves)}")
        return "\n".join(lines)

    def _build_seer_context(self, game_state: dict) -> str:
        lines = []
        results = game_state.get("seer_results", [])
        if results:
            lines.append("你之前的查验结果：")
            for r in results:
                lines.append(f"  {r}")
        return "\n".join(lines)

    def _build_witch_context(self, game_state: dict, killed_player: str,
                              has_antidote: bool, has_poison: bool) -> str:
        lines = []
        if killed_player:
            lines.append(f"今晚被袭击的玩家：{killed_player}")
        lines.append(f"解药：{'可用' if has_antidote else '已使用'}")
        lines.append(f"毒药：{'可用' if has_poison else '已使用'}")
        save_history = game_state.get("witch_save_history", [])
        poison_history = game_state.get("witch_poison_history", [])
        if save_history:
            lines.append(f"你曾使用解药救过：{', '.join(save_history)}")
        if poison_history:
            lines.append(f"你曾使用毒药毒杀过：{', '.join(poison_history)}")
        return "\n".join(lines)

    def _build_guard_context(self, game_state: dict, last_protected: Optional[str]) -> str:
        lines = []
        if last_protected:
            lines.append(f"上一晚你保护的玩家：{last_protected}（不能连续保护同一人）")
        else:
            lines.append("这是第一晚，你可以保护任何人。")
        return "\n".join(lines)
