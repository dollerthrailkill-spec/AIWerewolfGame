/**
 * config.js - 游戏配置常量
 *
 * 包含角色配置、游戏配置、角色分配表等核心常量。
 * 使用 App 命名空间统一管理，同时保留向后兼容的全局引用。
 *
 * @module Config
 */

// 检查是否已经加载过，防止重复声明
if (typeof window.__configLoaded === 'undefined') {
    window.__configLoaded = true;

    // ==================== 初始化 App 命名空间 ====================
    window.App = window.App || {};

    // ==================== 角色阵营枚举 ====================
    var TEAM = {
        WEREWOLF: 'werewolf',
        GOOD: 'good',
        NEUTRAL: 'neutral'
    };

    // ==================== 角色基础配置 ====================
    var defaultRoles = {
        // ----- 狼人阵营 -----
        werewolf: {
            name: '狼人',
            avatar: '/static/logo/ChatGPT.png',
            gender: 'male',
            team: TEAM.WEREWOLF,
            personality: '狡猾、残忍，擅长伪装和欺骗，在白天会尽力混淆视听，晚上则会和狼人一起商量杀人计划。',
            device: 'PC',
            model: 'gpt-3.5-turbo',
            voice: 'werewolf'
        },
        werewolf2: {
            name: '狼人 2',
            avatar: '/static/logo/ChatGPT.png',  // 可在角色设置中自定义
            gender: 'male',
            team: TEAM.WEREWOLF,
            personality: '阴险、奸诈，喜欢煽动和嫁祸，在白天会积极引导投票方向，晚上则和狼人同伴配合行动。',
            device: 'PC',
            model: 'gpt-3.5-turbo',
            voice: 'werewolf'
        },
        werewolf3: {
            name: '狼人 3',
            avatar: '/static/logo/ChatGPT.png',
            gender: 'male',
            team: TEAM.WEREWOLF,
            personality: '凶狠、果断，是狼人团队的领导者，善于制定策略和指挥，在关键时刻能做出正确决策。',
            device: 'PC',
            model: 'gpt-3.5-turbo',
            voice: 'werewolf'
        },
        // ----- 神职阵营 -----
        seer: {
            name: '预言家',
            avatar: '/static/logo/ChatGPT.png',
            gender: 'female',
            team: TEAM.GOOD,
            personality: '睿智、冷静，拥有洞察人心的能力，每晚可以查验一名玩家的身份，是好人阵营的核心。',
            device: 'PC',
            model: 'gpt-3.5-turbo',
            voice: 'seer'
        },
        witch: {
            name: '女巫',
            avatar: '/static/logo/ChatGPT.png',
            gender: 'female',
            team: TEAM.GOOD,
            personality: '神秘、谨慎，拥有两瓶药水，一瓶可以救人，一瓶可以杀人，是决定游戏走向的关键角色。',
            device: 'PC',
            model: 'gpt-3.5-turbo',
            voice: 'witch'
        },
        hunter: {
            name: '猎人',
            avatar: '/static/logo/ChatGPT.png',
            gender: 'male',
            team: TEAM.GOOD,
            personality: '勇敢、直率，当被狼人杀害或被村民放逐时，可以开枪带走一名玩家，是好人阵营的强力守护者。',
            device: 'PC',
            model: 'gpt-3.5-turbo',
            voice: 'hunter'
        },
        guard: {
            name: '守卫',
            avatar: '/static/logo/ChatGPT.png',
            gender: 'male',
            team: TEAM.GOOD,
            personality: '忠诚、勇敢，每晚可以保护一名玩家免受狼人袭击，是好人阵营的重要守护者。',
            device: 'PC',
            model: 'gpt-3.5-turbo',
            voice: 'guard'
        },
        // ----- 平民阵营 -----
        villager: {
            name: '平民',
            avatar: '/static/logo/ChatGPT.png',
            gender: 'male',
            team: TEAM.GOOD,
            personality: '普通、善良，没有特殊能力，但可以通过发言和投票帮助好人阵营找出狼人，是游戏中最基础的角色。',
            device: 'PC',
            model: 'gpt-3.5-turbo',
            voice: 'villager'
        },
        villager2: {
            name: '平民 2',
            avatar: '/static/logo/ChatGPT.png',
            gender: 'male',
            team: TEAM.GOOD,
            personality: '谨慎、沉稳，善于观察和分析，虽然没有特殊能力，但通过细致的分析能找出狼人破绽。',
            device: 'PC',
            model: 'gpt-3.5-turbo',
            voice: 'villager'
        },
        villager3: {
            name: '平民 3',
            avatar: '/static/logo/ChatGPT.png',
            gender: 'male',
            team: TEAM.GOOD,
            personality: '正直、热情，积极参与讨论和投票，善于带动好人阵营的氛围，是团队中重要的粘合剂。',
            device: 'PC',
            model: 'gpt-3.5-turbo',
            voice: 'villager'
        }
    };

    // ==================== 默认头像 URL ====================
    // 注意：外部签名 URL 已过期，改用本地占位图。如需自定义头像，请放置图片到 static/avatars/ 目录。
    var defaultAvatarUrls = {
        werewolf: '/static/avatars/werewolf.png',
        seer: '/static/avatars/seer.png',
        witch: '/static/avatars/witch.png',
        hunter: '/static/avatars/hunter.png',
        guard: '/static/avatars/guard.png',
        villager: '/static/avatars/villager.png'
    };

    // ==================== 游戏阶段定义 ====================
    var gameSteps = [
        '过场等待',
        'AI 入座',
        '天黑请闭眼',
        '狼人行动',
        '预言家验人',
        '女巫行动',
        '天亮了',
        '发言环节',
        '投票放逐'
    ];

    // ==================== 角色分配表（按玩家数量） ====================
    var roleDistribution = {
        6:  ['werewolf', 'werewolf2', 'seer', 'witch', 'villager', 'villager2'],
        8:  ['werewolf', 'werewolf2', 'seer', 'witch', 'hunter', 'villager', 'villager2', 'villager3'],
        10: ['werewolf', 'werewolf2', 'werewolf3', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager2', 'villager3']
    };

    // ==================== 发言阶段类型 ====================
    var speechPhases = ['day', 'dawn', 'day_discussion', 'speech'];

    // ==================== 紧急消息类型（不需要用户点击下一步） ====================
    var urgentMessageTypes = [
        'vote_start', 'vote_result', 'night_result', 'phase_change',
        'game_over', 'eulogy_start', 'eulogy_end', 'night_actions'
    ];

    // ==================== 默认玩家名 ====================
    var defaultPlayerNames = [
        '月影', '星辰', '夜影', '风语', '霜降',
        '雪落', '云深', '雾隐', '山岚', '水清'
    ];

    // ==================== 游戏模式配置 ====================
    var gameModeDescriptions = {
        6:  { name: '六人局', description: '2狼 1预 1女 2民 - 快速入门' },
        8:  { name: '八人局', description: '2狼 1预 1女 1猎 3民 - 经典对抗' },
        10: { name: '十人局', description: '3狼 1预 1女 1猎 1守 4民 - 策略深度' }
    };

    // ==================== WebSocket 配置 ====================
    var WS_CONFIG = {
        reconnectAttempts: 5,
        reconnectDelay: 1000,
        heartbeatInterval: 30000
    };

    // ==================== 打字机效果配置 ====================
    var TYPEWRITER_CONFIG = {
        charDelay: 50,
        voiceEnabled: true
    };

    // ==================== 导出到命名空间 ====================
    window.App.config = {
        TEAM,
        defaultRoles,
        defaultAvatarUrls,
        gameSteps,
        roleDistribution,
        speechPhases,
        urgentMessageTypes,
        defaultPlayerNames,
        gameModeDescriptions,
        WS_CONFIG,
        TYPEWRITER_CONFIG
    };

    // ==================== 向后兼容：保留全局引用 ====================
    window.TEAM = TEAM;
    window.defaultRoles = defaultRoles;
    window.defaultAvatarUrls = defaultAvatarUrls;
    window.gameSteps = gameSteps;
    window.roleDistribution = roleDistribution;
    window.speechPhases = speechPhases;
    window.urgentMessageTypes = urgentMessageTypes;
    window.defaultPlayerNames = defaultPlayerNames;
    window.gameModeDescriptions = gameModeDescriptions;
    window.WS_CONFIG = WS_CONFIG;
    window.TYPEWRITER_CONFIG = TYPEWRITER_CONFIG;
}
