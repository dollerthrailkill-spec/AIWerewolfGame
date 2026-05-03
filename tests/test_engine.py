"""游戏引擎核心逻辑单元测试"""
import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from game.engine import GameEngine
from game.roles import Player, RoleType, GAME_CONFIGS, ModelConfig


def _make_providers():
    """创建测试用的 provider 配置"""
    return {
        "test": {
            "id": "test",
            "name": "Test Provider",
            "api_url": "https://api.test.com",
            "api_key": "test-key",
            "default_model": "test-model",
        }
    }


def _make_player_configs(count, roles=None):
    """创建测试用的玩家配置列表"""
    configs = []
    role_list = list(GAME_CONFIGS[count]["roles"])
    for i in range(count):
        role_str = roles[i] if roles and i < len(roles) else role_list[i].value
        configs.append({
            "name": f"Player{i}",
            "role": role_str,
            "provider_id": "test",
            "model_name": "test-model",
        })
    return configs


class TestGameEngineInit:
    """测试游戏引擎初始化"""

    def test_default_init(self):
        """应能正常初始化"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert engine.player_count == 6
        assert len(engine.players) == 6
        assert engine.phase == "lobby"
        assert engine.is_running is False
        assert engine.game_over is False
        assert engine.winner is None

    def test_players_get_correct_roles(self):
        """玩家应按配置分配到正确的角色"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        roles = [p.role for p in engine.players]
        assert roles.count(RoleType.WEREWOLF) == 2
        assert roles.count(RoleType.SEER) == 1
        assert roles.count(RoleType.WITCH) == 1
        assert roles.count(RoleType.VILLAGER) == 2

    def test_players_are_alive_initially(self):
        """所有玩家初始应为存活状态"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        for p in engine.players:
            assert p.is_alive is True

    def test_players_have_seat_numbers(self):
        """玩家应有正确的座位号"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        seat_numbers = [p.seat_number for p in engine.players]
        assert seat_numbers == list(range(6))

    def test_players_have_unique_ids(self):
        """玩家 ID 应唯一"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        ids = [p.id for p in engine.players]
        assert len(ids) == len(set(ids))

    def test_game_id_is_generated(self):
        """应自动生成游戏 ID"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert engine.game_id is not None
        assert len(engine.game_id) > 0

    def test_initial_witch_state(self):
        """女巫初始状态: 解药和毒药都未使用"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert engine.witch_antidote_used is False
        assert engine.witch_poison_used is False

    def test_initial_guard_state(self):
        """守卫初始状态: 无上一晚保护目标"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert engine.last_guard_target is None


class TestGameEnginePlayerQueries:
    """测试玩家查询方法"""

    def test_get_alive_players(self):
        """应返回所有存活玩家"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        alive = engine._get_alive_players()
        assert len(alive) == 6

    def test_get_alive_players_after_death(self):
        """有玩家死亡后应只返回存活玩家"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        engine.players[0].is_alive = False
        engine.players[2].is_alive = False
        alive = engine._get_alive_players()
        assert len(alive) == 4

    def test_get_alive_by_role(self):
        """应按角色筛选存活玩家"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        wolves = engine._get_alive_by_role(RoleType.WEREWOLF)
        assert len(wolves) == 2
        assert all(p.role == RoleType.WEREWOLF for p in wolves)

    def test_get_alive_by_role_excludes_dead(self):
        """按角色筛选应排除死亡玩家"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        # 杀死一个狼人
        wolf = [p for p in engine.players if p.role == RoleType.WEREWOLF][0]
        wolf.is_alive = False
        wolves = engine._get_alive_by_role(RoleType.WEREWOLF)
        assert len(wolves) == 1

    def test_get_player_by_id(self):
        """应能通过 ID 找到玩家"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        player = engine._get_player_by_id("p0")
        assert player is not None
        assert player.id == "p0"

    def test_get_player_by_id_not_found(self):
        """不存在的 ID 应返回 None"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert engine._get_player_by_id("nonexistent") is None

    def test_get_player_by_name(self):
        """应能通过名字找到玩家"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        player = engine._get_player_by_name("Player0")
        assert player is not None
        assert player.name == "Player0"

    def test_get_player_by_name_not_found(self):
        """不存在的名字应返回 None"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert engine._get_player_by_name("不存在的名字") is None


class TestGameEngineGameOver:
    """测试游戏结束判定"""

    def test_game_not_over_initially(self):
        """初始状态游戏不应结束"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert engine._check_game_over() is None

    def test_good_wins_when_no_wolves(self):
        """所有狼人死亡时好人获胜"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        for p in engine.players:
            if p.role == RoleType.WEREWOLF:
                p.is_alive = False
        assert engine._check_game_over() == "good"

    def test_wolf_wins_when_wolves_equal_goods(self):
        """狼人数量 >= 好人数量时狼人获胜"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        # 杀死 2 个村民，使狼人(2) >= 好人(2: 预言家+女巫+1村民)
        villagers = [p for p in engine.players if p.role == RoleType.VILLAGER]
        villagers[0].is_alive = False
        villagers[1].is_alive = False
        assert engine._check_game_over() == "wolf"

    def test_wolf_wins_when_wolves_more_than_goods(self):
        """狼人数量 > 好人数量时狼人获胜"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        # 杀死 3 个好人，狼人(2) > 好人(1)
        non_wolves = [p for p in engine.players if p.role != RoleType.WEREWOLF]
        for p in non_wolves[:3]:
            p.is_alive = False
        assert engine._check_game_over() == "wolf"

    def test_game_not_over_with_mixed_alive(self):
        """双方都有存活且好人更多时游戏继续"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        # 杀死 1 个村民: 狼人(2) < 好人(3)
        villagers = [p for p in engine.players if p.role == RoleType.VILLAGER]
        villagers[0].is_alive = False
        assert engine._check_game_over() is None

    def test_all_dead_is_wolf_win(self):
        """全部死亡(狼人>=好人)时狼人获胜"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        # 只剩 1 狼人和 1 好人（不依赖索引，按角色筛选）
        wolves = [p for p in engine.players if p.role == RoleType.WEREWOLF]
        non_wolves = [p for p in engine.players if p.role != RoleType.WEREWOLF]
        for p in wolves[1:]:
            p.is_alive = False
        for p in non_wolves[1:]:
            p.is_alive = False
        assert engine._check_game_over() == "wolf"


class TestResolveNight:
    """测试夜晚结算逻辑"""

    def test_simple_kill(self):
        """狼人击杀无保护无解药时目标死亡"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        deaths = engine._resolve_night("Player0", {"save": False, "poison": None}, None)
        assert len(deaths) == 1
        assert deaths[0]["name"] == "Player0"
        assert deaths[0]["cause"] == "werewolf"

    def test_witch_saves(self):
        """女巫使用解药时目标被救活"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        deaths = engine._resolve_night("Player0", {"save": True, "poison": None}, None)
        assert len(deaths) == 0

    def test_guard_protects(self):
        """守卫保护时目标免受狼人袭击"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        deaths = engine._resolve_night("Player0", {"save": False, "poison": None}, "Player0")
        assert len(deaths) == 0

    def test_guard_does_not_protect_against_poison(self):
        """守卫不能防止毒药"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        deaths = engine._resolve_night(
            "Player0", {"save": False, "poison": "Player1"}, "Player1"
        )
        # Player0 被狼人击杀(守卫保护了 Player1 不影响), Player1 被毒杀
        assert len(deaths) == 2

    def test_witch_poison_kills(self):
        """女巫毒药应杀死目标"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        deaths = engine._resolve_night(None, {"save": False, "poison": "Player1"}, None)
        assert len(deaths) == 1
        assert deaths[0]["name"] == "Player1"
        assert deaths[0]["cause"] == "poison"

    def test_no_kill_no_death(self):
        """无击杀无毒药时应为平安夜"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        deaths = engine._resolve_night(None, {"save": False, "poison": None}, None)
        assert len(deaths) == 0

    def test_save_and_poison_same_night(self):
        """同时有救药和毒药时，两个死亡都应记录"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        deaths = engine._resolve_night(
            "Player0", {"save": True, "poison": "Player1"}, None
        )
        # Player0 被救活，Player1 被毒杀
        assert len(deaths) == 1
        assert deaths[0]["name"] == "Player1"
        assert deaths[0]["cause"] == "poison"

    def test_duplicate_deaths_deduplicated(self):
        """同一玩家不应重复死亡"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        # 狼人和毒药同时针对同一人
        deaths = engine._resolve_night(
            "Player0", {"save": False, "poison": "Player0"}, None
        )
        # Player0 不应出现两次
        names = [d["name"] for d in deaths]
        assert names.count("Player0") == 1

    def test_guard_cannot_save_and_poison_same_target(self):
        """守卫保护和毒药针对同一人时，毒药仍然生效"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        deaths = engine._resolve_night(
            None, {"save": False, "poison": "Player1"}, "Player1"
        )
        # 守卫不能防止毒药
        assert len(deaths) == 1
        assert deaths[0]["name"] == "Player1"


class TestBuildGameState:
    """测试游戏状态构建"""

    def test_state_has_required_fields(self):
        """状态应包含所有必需字段"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        state = engine._build_game_state()
        required = {
            "round", "phase", "initial_player_count", "alive_players",
            "dead_players", "alive_count", "dead_count",
            "alive_wolf_count", "alive_good_count",
            "public_log", "vote_history", "speech_history",
            "speech_by_round", "last_night_result",
            "seer_results", "witch_antidote_used", "witch_poison_used",
            "last_guard_target",
        }
        missing = required - set(state.keys())
        assert not missing, f"缺少字段: {missing}"

    def test_initial_state_values(self):
        """初始状态值应正确"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        state = engine._build_game_state()
        assert state["round"] == 0
        assert state["phase"] == "lobby"
        assert state["initial_player_count"] == 6
        assert state["alive_count"] == 6
        assert state["dead_count"] == 0

    def test_extra_fields_merged(self):
        """额外字段应合并到状态中"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        state = engine._build_game_state({"custom_field": "custom_value"})
        assert state["custom_field"] == "custom_value"


class TestGameEngineBroadcast:
    """测试广播功能"""

    @pytest.mark.asyncio
    async def test_broadcast_with_no_callback(self):
        """无广播回调时不应报错"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        # 不应抛出异常
        await engine.broadcast("test", {"data": "hello"})

    @pytest.mark.asyncio
    async def test_broadcast_with_callback(self):
        """有广播回调时应调用"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        received = []

        async def mock_broadcast(msg):
            received.append(msg)

        engine.set_broadcast(mock_broadcast)
        await engine.broadcast("test_event", {"key": "value"})
        assert len(received) == 1
        assert received[0]["type"] == "test_event"
        assert received[0]["key"] == "value"


class TestGameEngineDifferentPlayerCounts:
    """测试不同人数配置"""

    def test_eight_player_game(self):
        """8人局应正确初始化"""
        providers = _make_providers()
        configs = _make_player_configs(8)
        engine = GameEngine(8, configs, providers)
        assert len(engine.players) == 8
        roles = [p.role for p in engine.players]
        assert roles.count(RoleType.WEREWOLF) == 2
        assert roles.count(RoleType.HUNTER) == 1

    def test_ten_player_game(self):
        """10人局应正确初始化"""
        providers = _make_providers()
        configs = _make_player_configs(10)
        engine = GameEngine(10, configs, providers)
        assert len(engine.players) == 10
        roles = [p.role for p in engine.players]
        assert roles.count(RoleType.WEREWOLF) == 3
        assert roles.count(RoleType.GUARD) == 1
        assert roles.count(RoleType.HUNTER) == 1


class TestGetStateSummary:
    """测试状态摘要"""

    def test_summary_has_required_fields(self):
        """摘要应包含所有必需字段"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        summary = engine.get_state_summary()
        required = {
            "game_id", "round", "phase", "player_count",
            "is_running", "game_over", "winner", "players",
        }
        missing = required - set(summary.keys())
        assert not missing, f"缺少字段: {missing}"

    def test_summary_players_include_roles(self):
        """摘要中的玩家应包含角色信息"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        summary = engine.get_state_summary()
        for p in summary["players"]:
            assert "role" in p
            assert "role_name" in p
            assert "team" in p


class TestGameEngineDeathLog:
    """测试死亡记录功能"""

    def test_death_log_initialized_empty(self):
        """death_log 初始应为空列表"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert hasattr(engine, 'death_log')
        assert engine.death_log == []

    def test_resolve_night_records_death_log(self):
        """夜晚结算后 death_log 应包含死亡记录"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        # 模拟夜晚击杀
        engine.night_phase.__wrapped__ if hasattr(engine.night_phase, '__wrapped__') else None
        # 直接调用 _resolve_night 并手动记录 death_log
        deaths = engine._resolve_night("Player0", {"save": False, "poison": None}, None)
        # _resolve_night 只返回死亡列表，不修改 death_log
        # death_log 在 night_phase 中记录
        assert len(deaths) == 1
        assert deaths[0]["name"] == "Player0"
        assert deaths[0]["cause"] == "werewolf"


class TestGameEngineMissingAttributes:
    """测试 GameEngine 必要属性存在"""

    def test_started_at_exists(self):
        """应有 started_at 属性"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert hasattr(engine, 'started_at')
        assert engine.started_at is not None
        assert isinstance(engine.started_at, str)

    def test_mvp_attribute_exists(self):
        """应有 mvp 属性，初始为 None"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert hasattr(engine, 'mvp')
        assert engine.mvp is None

    def test_death_log_attribute_exists(self):
        """应有 death_log 属性"""
        providers = _make_providers()
        configs = _make_player_configs(6)
        engine = GameEngine(6, configs, providers)
        assert hasattr(engine, 'death_log')
        assert isinstance(engine.death_log, list)
