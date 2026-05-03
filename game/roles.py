from enum import Enum
from dataclasses import dataclass, field
from typing import Optional


class RoleType(str, Enum):
    WEREWOLF = "werewolf"
    SEER = "seer"
    WITCH = "witch"
    HUNTER = "hunter"
    GUARD = "guard"
    VILLAGER = "villager"


ROLE_INFO = {
    RoleType.WEREWOLF: {
        "name": "狼人",
        "emoji": "🐺",
        "team": "wolf",
        "description": "每晚可以与同伴商议杀害一名玩家",
        "color": "#e74c3c",
        "default_personality": "你是一个善于伪装的玩家，擅长引导舆论和转移嫌疑。你需要配合队友暗中消灭威胁，在白天发言时要表现得像一个无辜的好人，绝不能让人看出你的真实立场。发言时不要说'我是狼人'或类似暴露身份的话。",
    },
    RoleType.SEER: {
        "name": "预言家",
        "emoji": "🔮",
        "team": "good",
        "description": "每晚可以查验一名玩家的身份",
        "color": "#9b59b6",
        "default_personality": "你是一个善于观察和分析的玩家，掌握着查验他人身份的特殊能力。你会在合适的时机跳预言家报出查验结果，引导好人阵营找出狼人。同时你也会注意保护自己，避免过早成为狼人的目标。",
    },
    RoleType.WITCH: {
        "name": "女巫",
        "emoji": "🧪",
        "team": "good",
        "description": "拥有一瓶解药和一瓶毒药，各只能使用一次",
        "color": "#2ecc71",
        "default_personality": "你是一个掌握着关键信息的玩家，知道一些夜晚发生的事情。你会权衡利弊，在关键时刻发表观点，帮助好人阵营识别狼人。你可以根据局势决定是否透露自己的身份和行动信息。",
    },
    RoleType.HUNTER: {
        "name": "猎人",
        "emoji": "🏹",
        "team": "good",
        "description": "死亡时可以开枪带走一名玩家",
        "color": "#e67e22",
        "default_personality": "你是一个勇敢且强势的玩家，即使出局也有能力影响游戏走向。你会积极发言寻找狼人，用强势的态度震慑对方。你可以暗示或明示自己是猎人，让狼人有所顾忌。",
    },
    RoleType.GUARD: {
        "name": "守卫",
        "emoji": "🛡️",
        "team": "good",
        "description": "每晚可以保护一名玩家免受狼人袭击",
        "color": "#3498db",
        "default_personality": "你是一个细心且忠诚的玩家，掌握着保护他人的能力。你会仔细分析局势，根据情况决定是否透露自己的身份或保护信息，帮助好人判断局势。",
    },
    RoleType.VILLAGER: {
        "name": "村民",
        "emoji": "👤",
        "team": "good",
        "description": "没有特殊能力，但投票和发言同样重要",
        "color": "#95a5a6",
        "default_personality": "你是一个普通但敏锐的玩家，虽然没有特殊能力，但你的分析和投票同样重要。你会认真听取每个人的发言，努力找出狼人的破绽，用逻辑说服其他人。",
    },
}


GAME_CONFIGS = {
    6: {
        "roles": [
            RoleType.WEREWOLF, RoleType.WEREWOLF,
            RoleType.SEER,
            RoleType.WITCH,
            RoleType.VILLAGER, RoleType.VILLAGER,
        ],
        "description": "2狼人 / 1预言家 / 1女巫 / 2村民",
    },
    8: {
        "roles": [
            RoleType.WEREWOLF, RoleType.WEREWOLF,
            RoleType.SEER,
            RoleType.WITCH,
            RoleType.HUNTER,
            RoleType.VILLAGER, RoleType.VILLAGER, RoleType.VILLAGER,
        ],
        "description": "2狼人 / 1预言家 / 1女巫 / 1猎人 / 3村民",
    },
    10: {
        "roles": [
            RoleType.WEREWOLF, RoleType.WEREWOLF, RoleType.WEREWOLF,
            RoleType.SEER,
            RoleType.WITCH,
            RoleType.HUNTER,
            RoleType.GUARD,
            RoleType.VILLAGER, RoleType.VILLAGER, RoleType.VILLAGER,
        ],
        "description": "3狼人 / 1预言家 / 1女巫 / 1猎人 / 1守卫 / 3村民",
    },
}


DEFAULT_NAMES = ["月影", "星辰", "风语", "雷鸣", "霜降", "雪落", "云深", "雾隐", "山岚", "水清"]


@dataclass
class ModelConfig:
    provider_id: str = ""
    model_name: str = ""
    personality: str = ""
    use_default_personality: bool = True


@dataclass
class Player:
    id: str = ""
    name: str = ""
    role: Optional[RoleType] = None
    role_id: str = ""  # 保存原始角色ID，比如 werewolf2、werewolf3 等
    is_alive: bool = True
    seat_number: int = 0
    model_config: ModelConfig = field(default_factory=ModelConfig)

    @property
    def role_info(self):
        if self.role is None:
            return None
        return ROLE_INFO[self.role]

    @property
    def team(self):
        if self.role is None:
            return None
        return ROLE_INFO[self.role]["team"]

    @property
    def display_role(self):
        if self.role is None:
            return "未知"
        return ROLE_INFO[self.role]["name"]

    def to_dict(self, reveal_role=False):
        d = {
            "id": self.id,
            "name": self.name,
            "is_alive": self.is_alive,
            "seat_number": self.seat_number,
        }
        if reveal_role:
            d["role"] = self.role.value if self.role else None
            d["role_id"] = self.role_id or self.role.value if self.role else None
            d["role_name"] = self.display_role
            d["team"] = self.team
        else:
            d["role"] = None
            d["role_id"] = None
            d["role_name"] = "未知"
            d["team"] = None
        return d
