"""角色和玩家数据模型单元测试"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from game.roles import (
    Player,
    RoleType,
    ROLE_INFO,
    GAME_CONFIGS,
    DEFAULT_NAMES,
    ModelConfig,
)


class TestRoleType:
    """测试角色类型枚举"""

    def test_all_roles_exist(self):
        """所有预定义角色应存在"""
        roles = list(RoleType)
        assert len(roles) == 6
        assert RoleType.WEREWOLF in roles
        assert RoleType.SEER in roles
        assert RoleType.WITCH in roles
        assert RoleType.HUNTER in roles
        assert RoleType.GUARD in roles
        assert RoleType.VILLAGER in roles

    def test_role_values(self):
        """角色枚举值应为字符串"""
        assert RoleType.WEREWOLF.value == "werewolf"
        assert RoleType.SEER.value == "seer"
        assert RoleType.WITCH.value == "witch"
        assert RoleType.HUNTER.value == "hunter"
        assert RoleType.GUARD.value == "guard"
        assert RoleType.VILLAGER.value == "villager"

    def test_role_comparison_with_string(self):
        """角色枚举应能与字符串比较"""
        assert RoleType.WEREWOLF == "werewolf"
        assert RoleType.SEER == "seer"


class TestRoleInfo:
    """测试角色信息配置"""

    def test_all_roles_have_info(self):
        """所有角色都应有对应的信息配置"""
        for role in RoleType:
            assert role in ROLE_INFO

    def test_role_info_has_required_fields(self):
        """角色信息应包含所有必需字段"""
        required_fields = {"name", "emoji", "team", "description", "color", "default_personality"}
        for role, info in ROLE_INFO.items():
            missing = required_fields - set(info.keys())
            assert not missing, f"角色 {role} 缺少字段: {missing}"

    def test_werewolf_team(self):
        """狼人应属于 wolf 阵营"""
        assert ROLE_INFO[RoleType.WEREWOLF]["team"] == "wolf"

    def test_good_roles_team(self):
        """好人角色应属于 good 阵营"""
        good_roles = [RoleType.SEER, RoleType.WITCH, RoleType.HUNTER, RoleType.GUARD, RoleType.VILLAGER]
        for role in good_roles:
            assert ROLE_INFO[role]["team"] == "good", f"{role} 应该是好人阵营"

    def test_role_names(self):
        """角色名称应正确"""
        assert ROLE_INFO[RoleType.WEREWOLF]["name"] == "狼人"
        assert ROLE_INFO[RoleType.SEER]["name"] == "预言家"
        assert ROLE_INFO[RoleType.WITCH]["name"] == "女巫"
        assert ROLE_INFO[RoleType.HUNTER]["name"] == "猎人"
        assert ROLE_INFO[RoleType.GUARD]["name"] == "守卫"
        assert ROLE_INFO[RoleType.VILLAGER]["name"] == "村民"

    def test_role_emojis(self):
        """角色 emoji 应非空"""
        for role, info in ROLE_INFO.items():
            assert len(info["emoji"]) > 0, f"{role} 缺少 emoji"


class TestGameConfigs:
    """测试游戏人数配置"""

    def test_valid_player_counts(self):
        """应支持 6/8/10 人局"""
        assert 6 in GAME_CONFIGS
        assert 8 in GAME_CONFIGS
        assert 10 in GAME_CONFIGS

    def test_role_count_matches_player_count(self):
        """每个配置的角色数量应等于玩家数量"""
        for count, config in GAME_CONFIGS.items():
            assert len(config["roles"]) == count, \
                f"{count}人局应有 {count} 个角色，实际有 {len(config['roles'])}"

    def test_six_player_config(self):
        """6人局: 2狼人/1预言家/1女巫/2村民"""
        roles = GAME_CONFIGS[6]["roles"]
        assert roles.count(RoleType.WEREWOLF) == 2
        assert roles.count(RoleType.SEER) == 1
        assert roles.count(RoleType.WITCH) == 1
        assert roles.count(RoleType.VILLAGER) == 2
        assert RoleType.HUNTER not in roles
        assert RoleType.GUARD not in roles

    def test_eight_player_config(self):
        """8人局: 2狼人/1预言家/1女巫/1猎人/3村民"""
        roles = GAME_CONFIGS[8]["roles"]
        assert roles.count(RoleType.WEREWOLF) == 2
        assert roles.count(RoleType.SEER) == 1
        assert roles.count(RoleType.WITCH) == 1
        assert roles.count(RoleType.HUNTER) == 1
        assert roles.count(RoleType.VILLAGER) == 3
        assert RoleType.GUARD not in roles

    def test_ten_player_config(self):
        """10人局: 3狼人/1预言家/1女巫/1猎人/1守卫/3村民"""
        roles = GAME_CONFIGS[10]["roles"]
        assert roles.count(RoleType.WEREWOLF) == 3
        assert roles.count(RoleType.SEER) == 1
        assert roles.count(RoleType.WITCH) == 1
        assert roles.count(RoleType.HUNTER) == 1
        assert roles.count(RoleType.GUARD) == 1
        assert roles.count(RoleType.VILLAGER) == 3

    def test_config_has_description(self):
        """每个配置都应有描述"""
        for count, config in GAME_CONFIGS.items():
            assert "description" in config
            assert len(config["description"]) > 0


class TestDefaultNames:
    """测试默认名称"""

    def test_has_enough_names(self):
        """默认名称数量应不少于 10 个"""
        assert len(DEFAULT_NAMES) >= 10

    def test_names_are_unique(self):
        """默认名称应不重复"""
        assert len(DEFAULT_NAMES) == len(set(DEFAULT_NAMES))


class TestModelConfig:
    """测试模型配置数据类"""

    def test_default_values(self):
        """默认值应正确"""
        mc = ModelConfig()
        assert mc.provider_id == ""
        assert mc.model_name == ""
        assert mc.personality == ""
        assert mc.use_default_personality is True

    def test_custom_values(self):
        """应能设置自定义值"""
        mc = ModelConfig(
            provider_id="openai",
            model_name="gpt-4",
            personality="自定义人格",
            use_default_personality=False,
        )
        assert mc.provider_id == "openai"
        assert mc.model_name == "gpt-4"
        assert mc.personality == "自定义人格"
        assert mc.use_default_personality is False


class TestPlayer:
    """测试玩家数据类"""

    def test_default_player(self):
        """默认玩家属性应正确"""
        p = Player()
        assert p.id == ""
        assert p.name == ""
        assert p.role is None
        assert p.is_alive is True
        assert p.seat_number == 0

    def test_player_with_role(self):
        """玩家应有正确的角色属性"""
        p = Player(id="p1", name="测试玩家", role=RoleType.WEREWOLF)
        assert p.role == RoleType.WEREWOLF
        assert p.display_role == "狼人"
        assert p.team == "wolf"

    def test_player_without_role(self):
        """无角色玩家应返回 None/默认值"""
        p = Player(id="p1", name="测试玩家")
        assert p.role_info is None
        assert p.team is None
        assert p.display_role == "未知"

    def test_all_teams(self):
        """各角色阵营应正确"""
        assert Player(role=RoleType.WEREWOLF).team == "wolf"
        assert Player(role=RoleType.SEER).team == "good"
        assert Player(role=RoleType.WITCH).team == "good"
        assert Player(role=RoleType.HUNTER).team == "good"
        assert Player(role=RoleType.GUARD).team == "good"
        assert Player(role=RoleType.VILLAGER).team == "good"

    def test_to_dict_reveal_role(self):
        """to_dict(reveal_role=True) 应包含角色信息"""
        p = Player(id="p1", name="月影", role=RoleType.SEER, seat_number=0)
        d = p.to_dict(reveal_role=True)
        assert d["id"] == "p1"
        assert d["name"] == "月影"
        assert d["role"] == "seer"
        assert d["role_name"] == "预言家"
        assert d["team"] == "good"
        assert d["is_alive"] is True
        assert d["seat_number"] == 0

    def test_to_dict_hide_role(self):
        """to_dict(reveal_role=False) 应隐藏角色信息"""
        p = Player(id="p1", name="月影", role=RoleType.WEREWOLF, seat_number=0)
        d = p.to_dict(reveal_role=False)
        assert d["role"] is None
        assert d["role_id"] is None
        assert d["role_name"] == "未知"
        assert d["team"] is None

    def test_to_dict_dead_player(self):
        """死亡玩家应在 to_dict 中标记 is_alive=False"""
        p = Player(id="p1", name="月影", role=RoleType.VILLAGER, is_alive=False)
        d = p.to_dict(reveal_role=True)
        assert d["is_alive"] is False

    def test_player_role_info_property(self):
        """role_info 属性应返回正确的角色信息"""
        p = Player(role=RoleType.HUNTER)
        info = p.role_info
        assert info["name"] == "猎人"
        assert info["emoji"] == "🏹"
