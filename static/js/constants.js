/**
 * constants.js - 常量定义模块
 *
 * 集中管理所有常量配置，避免魔法数字和魔法字符串。
 *
 * @module Constants
 */

// 检查是否已经加载过，防止重复声明
if (typeof window.__constantsLoaded === 'undefined') {
    window.__constantsLoaded = true;

    window.App = window.App || {};

    // ==================== WebSocket 配置 ====================
    var WS_CONFIG = {
        RECONNECT_BASE_DELAY: 1000,
        MAX_RECONNECT_DELAY: 30000,
        MAX_RECONNECT_ATTEMPTS: 10,
        QUEUE_PROCESS_DELAY: 0,
        PING_INTERVAL: 30000,
        CONNECTION_TIMEOUT: 10000
    };

    // ==================== UI 动画配置 ====================
    var ANIMATION_CONFIG = {
        BANNER_FADE_IN: 500,
        BANNER_FADE_OUT: 500,
        BANNER_DEFAULT_DURATION: 2500,
        SPEECH_FADE_IN: 300,
        SPEECH_TYPEWRITER_DELAY: 30,
        TRANSITION_DEFAULT: 300,
        PHASE_TRANSITION: 1000
    };

    // ==================== 游戏配置 ====================
    var GAME_CONFIG = {
        DEFAULT_PLAYER_COUNT: 6,
        MAX_PLAYER_COUNT: 12,
        MIN_PLAYER_COUNT: 4,
        VOTE_TIMEOUT: 60000,
        SPEECH_TIMEOUT: 120000,
        NIGHT_PHASE_DURATION: 5000
    };

    // ==================== 响应式断点 ====================
    var BREAKPOINTS = {
        SM: 640,
        MD: 768,
        LG: 1024,
        XL: 1280,
        XXL: 1536
    };

    // ==================== 座位布局配置 ====================
    var SEAT_CONFIG = {
        MOBILE_RADIUS: 35,
        SMALL_GROUP_RADIUS: 40,
        MEDIUM_GROUP_RADIUS: 42,
        LARGE_GROUP_RADIUS: 44,
        SMALL_GROUP_THRESHOLD: 6,
        MEDIUM_GROUP_THRESHOLD: 8
    };

    // ==================== 日志配置 ====================
    var LOG_CONFIG = {
        MAX_MEMORY_ENTRIES: 1000,
        MAX_DISPLAY_ENTRIES: 100,
        AUTO_SCROLL: true
    };

    // ==================== 输入验证配置 ====================
    var VALIDATION_CONFIG = {
        MAX_NAME_LENGTH: 20,
        MAX_MESSAGE_LENGTH: 1000,
        MAX_REASONING_LENGTH: 2000
    };

    // ==================== 存储键名 ====================
    var STORAGE_KEYS = {
        PROVIDERS: 'wolfgame_providers',
        GAME_HISTORY: 'wolfgame_history',
        USER_PREFERENCES: 'wolfgame_preferences',
        THEME: 'wolfgame_theme',
        AUDIO_SETTINGS: 'wolfgame_audio'
    };

    // ==================== CSS 类名 ====================
    var CSS_CLASSES = {
        SEAT_BASE: 'seat',
        SEAT_ACTIVE: 'seat-active',
        SEAT_SPEAKING: 'seat-speaking',
        SEAT_DEAD: 'seat-dead',
        SEAT_VOTE_TARGET: 'seat-vote-target',
        SEAT_NIGHT_TARGET: 'seat-night-target',
        CENTER_BANNER: 'center-banner',
        HIDDEN: 'hidden'
    };

    // ==================== 事件名称 ====================
    var EVENT_NAMES = {
        GAME_START: 'game_start',
        PHASE_CHANGE: 'phase_change',
        PLAYER_SPEECH: 'player_speech',
        VOTING_START: 'voting_start',
        VOTING_END: 'voting_end',
        GAME_END: 'game_end',
        PLAYER_DEATH: 'player_death',
        AI_REASONING: 'ai_reasoning',
        RECONNECT: 'reconnect',
        DISCONNECT: 'disconnect'
    };

    // ==================== 阶段名称 ====================
    var PHASES = {
        WAITING: 'waiting',
        NIGHT: 'night',
        DAY: 'day',
        DISCUSSION: 'discussion',
        VOTING: 'voting',
        DEFENSE: 'defense',
        FINAL_VOTE: 'final_vote',
        GAME_OVER: 'game_over'
    };

    // ==================== 导出 ====================
    window.App.constants = {
        WS_CONFIG,
        ANIMATION_CONFIG,
        GAME_CONFIG,
        BREAKPOINTS,
        SEAT_CONFIG,
        LOG_CONFIG,
        VALIDATION_CONFIG,
        STORAGE_KEYS,
        CSS_CLASSES,
        EVENT_NAMES,
        PHASES
    };

    // ==================== 向后兼容：保留全局引用 ====================
    window.WS_CONFIG = WS_CONFIG;
    window.ANIMATION_CONFIG = ANIMATION_CONFIG;
    window.GAME_CONFIG = GAME_CONFIG;
    window.BREAKPOINTS = BREAKPOINTS;
    window.SEAT_CONFIG = SEAT_CONFIG;
    window.LOG_CONFIG = LOG_CONFIG;
    window.VALIDATION_CONFIG = VALIDATION_CONFIG;
    window.CSS_CLASSES = CSS_CLASSES;
    window.EVENT_NAMES = EVENT_NAMES;
    window.PHASES = PHASES;
}
