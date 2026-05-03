/**
 * storage.js - 本地存储管理
 *
 * 封装 localStorage 操作，提供角色配置和游戏设置的持久化存储。
 * 包含错误处理和版本兼容。
 *
 * @module Storage
 */

// 检查是否已经加载过，防止重复声明
if (typeof window.__storageLoaded === 'undefined') {
    window.__storageLoaded = true;

    // ==================== App 命名空间初始化 ====================
    window.App = window.App || {};

    // ==================== Storage Keys ====================
    var STORAGE_KEYS = {
        ROLES: 'aiWerewolfRoles',
        SETTINGS: 'aiWerewolfSettings',
        STATS: 'aiWerewolfStats',
        ACHIEVEMENTS: 'aiWerewolfAchievements',
        REPLAYS: 'aiWerewolfReplays',
        PERSONALITIES: 'aiWerewolfPersonalities',
        THEME: 'aiWerewolfTheme',
        WS_TOKEN: 'ws_auth_token',
        DAILY_CHALLENGE: 'aiWerewolfDailyChallenge'
    };

    /**
     * 安全地从 localStorage 读取数据
     * @param {string} key - 存储键名
     * @param {*} defaultValue - 读取失败时的默认值
     * @returns {*} 存储的值或默认值
     */
    var safeGetItem = (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (e) {
            console.error(`[Storage] Failed to read key "${key}":`, e);
            return defaultValue;
        }
    };

    /**
     * 安全地向 localStorage 写入数据
     * @param {string} key - 存储键名
     * @param {*} value - 要存储的值
     * @returns {boolean} 是否写入成功
     */
    var safeSetItem = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`[Storage] Failed to write key "${key}":`, e);
            return false;
        }
    };

    /**
     * 从 localStorage 加载已保存的角色配置
     * 将保存的配置合并到 window.roles 中
     */
    var loadFromLocalStorage = () => {
        const saved = localStorage.getItem(STORAGE_KEYS.ROLES);
        if (!saved) {
            console.log('[Storage] No saved roles found, using defaults');
            return;
        }

        try {
            const savedRoles = JSON.parse(saved);
            for (const [key, value] of Object.entries(savedRoles)) {
                if (value && window.roles?.[key]) {
                    window.roles[key] = { ...window.roles[key], ...value };
                }
            }
            console.log('[Storage] Loaded roles from localStorage');
        } catch (e) {
            console.error('[Storage] Failed to parse saved roles:', e);
        }
    };

    /**
     * 将当前角色配置保存到 localStorage
     * @returns {boolean} 是否保存成功
     */
    var saveToLocalStorage = () => {
        const success = safeSetItem(STORAGE_KEYS.ROLES, window.roles);
        if (success) {
            console.log('[Storage] Roles saved to localStorage');
        }
        return success;
    };

    /**
     * 加载通用设置
     * @returns {Object} 设置对象
     */
    var loadSettings = () => {
        return safeGetItem(STORAGE_KEYS.SETTINGS, {});
    };

    /**
     * 保存通用设置
     * @param {Object} settings - 设置对象
     * @returns {boolean} 是否保存成功
     */
    var saveSettings = (settings) => {
        return safeSetItem(STORAGE_KEYS.SETTINGS, settings);
    };

    /**
     * 清除所有游戏相关的本地存储数据
     */
    var clearAllStorage = () => {
        Object.values(STORAGE_KEYS).forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn(`[Storage] Failed to remove key "${key}":`, e);
            }
        });
        console.log('[Storage] All game data cleared');
    };

    // ==================== 导出到命名空间 ====================
    window.App.storage = {
        STORAGE_KEYS,
        safeGetItem,
        safeSetItem,
        loadSettings,
        saveSettings,
        clearAllStorage
    };

    // ==================== 向后兼容：保留全局引用 ====================
    window.loadFromLocalStorage = loadFromLocalStorage;
    window.saveToLocalStorage = saveToLocalStorage;
    window.STORAGE_KEYS = STORAGE_KEYS;
    window.safeGetItem = safeGetItem;
    window.safeSetItem = safeSetItem;
    window.loadSettings = loadSettings;
    window.saveSettings = saveSettings;
    window.clearAllStorage = clearAllStorage;
}
