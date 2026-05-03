/**
 * utils.js - 通用工具函数
 *
 * 提供角色信息查询、Logo 匹配、延迟、洗牌等通用工具方法。
 * 使用 ES6+ 语法（箭头函数、解构、模板字符串等）。
 *
 * @module Utils
 */

// 检查是否已经加载过，防止重复声明
if (typeof window.__utilsLoaded === 'undefined') {
    window.__utilsLoaded = true;

    // ==================== App 命名空间初始化 ====================
    window.App = window.App || {};

    // ==================== 角色信息映射 ====================
    var ROLE_INFO_MAP = {
        werewolf:  { name: '狼人',   emoji: '[狼]', faction: 'werewolf' },
        seer:      { name: '预言家', emoji: '[神]', faction: 'good' },
        witch:     { name: '女巫',   emoji: '[神]', faction: 'good' },
        hunter:    { name: '猎人',   emoji: '[神]', faction: 'good' },
        guard:     { name: '守卫',   emoji: '[神]', faction: 'good' },
        villager:  { name: '平民',   emoji: '[民]', faction: 'good' }
    };

    // ==================== 角色立绘映射（按玩家名） ====================
    var PLAYER_AVATAR_MAP = {
        '月影': '/static/images/role/Werewolf-月影.webp',
        '星辰': '/static/images/role/Werewolf-星辰.webp',
        '夜影': '/static/images/role/wolf3.webp',
        '风语': '/static/images/role/Prophet-风语.webp',
        '霜降': '/static/images/role/Witch-霜降.webp',
        '雪落': '/static/images/role/Hunter-雪落.webp',
        '云深': '/static/images/role/Guard-云深.webp',
        '雾隐': '/static/images/role/Commoner-雾隐.webp',
        '山岚': '/static/images/role/Commoner-山岚.webp',
        '水清': '/static/images/role/Commoner-水清.webp'
    };

    // ==================== 角色图标映射（按玩家名） ====================
    var PLAYER_ICON_MAP = {
        '月影': '/static/images/role_icon/Werewolf-月影-UIicon.webp',
        '星辰': '/static/images/role_icon/Werewolf-星辰-UIicon.webp',
        '夜影': '/static/images/role_icon/wolf3UI.webp',
        '风语': '/static/images/role_icon/Prophet-风语-UIicon.webp',
        '霜降': '/static/images/role_icon/Witch-霜降-UIicon.webp',
        '雪落': '/static/images/role_icon/Hunter-雪落-UIicon.webp',
        '云深': '/static/images/role_icon/Guard-云深-UIicon.webp',
        '雾隐': '/static/images/role_icon/Commoner-雾隐-UIicon.webp',
        '山岚': '/static/images/role_icon/Commoner-山岚-UIicon.webp',
        '水清': '/static/images/role_icon/Commoner-水清-UIicon.webp'
    };

    // ==================== 角色图标映射（按角色ID） ====================
    var ROLE_ICON_MAP = {
        'werewolf': '/static/images/role_icon/Werewolf-月影-UIicon.webp',
        'werewolf2': '/static/images/role_icon/Werewolf-星辰-UIicon.webp',
        'werewolf3': '/static/images/role_icon/wolf3UI.webp',
        'seer': '/static/images/role_icon/Prophet-风语-UIicon.webp',
        'witch': '/static/images/role_icon/Witch-霜降-UIicon.webp',
        'hunter': '/static/images/role_icon/Hunter-雪落-UIicon.webp',
        'guard': '/static/images/role_icon/Guard-云深-UIicon.webp',
        'villager': '/static/images/role_icon/Commoner-雾隐-UIicon.webp',
        'villager2': '/static/images/role_icon/Commoner-山岚-UIicon.webp',
        'villager3': '/static/images/role_icon/Commoner-水清-UIicon.webp'
    };

    // ==================== 角色立绘映射（按角色ID） ====================
    var ROLE_SPRITE_MAP = {
        'werewolf': '/static/images/role/Werewolf-月影.webp',
        'werewolf2': '/static/images/role/Werewolf-星辰.webp',
        'werewolf3': '/static/images/role/wolf3.webp',
        'seer': '/static/images/role/Prophet-风语.webp',
        'witch': '/static/images/role/Witch-霜降.webp',
        'hunter': '/static/images/role/Hunter-雪落.webp',
        'guard': '/static/images/role/Guard-云深.webp',
        'villager': '/static/images/role/Commoner-雾隐.webp',
        'villager2': '/static/images/role/Commoner-山岚.webp',
        'villager3': '/static/images/role/Commoner-水清.webp'
    };

    // ==================== 模型 Logo 映射 ====================
    var MODEL_LOGO_MAP = {
        chatgpt: '/static/logo/ChatGPT.png',
        gpt: '/static/logo/ChatGPT.png',
        deepseek: '/static/logo/DeepSeek.png',
        gemini: '/static/logo/Gemini.png',
        gamma: '/static/logo/Gamma.png',
        gemma: '/static/logo/Gamma.png',
        kimi: '/static/logo/Kimi.png',
        minimax: '/static/logo/Minimax.png',
        abab: '/static/logo/Minimax.png',
        qwen: '/static/logo/Qwen.png',
        doubao: '/static/logo/doubao.png',
        zhipu: '/static/logo/zhipu-GLM.png',
        glm: '/static/logo/zhipu-GLM.png',
        bytedance: '/static/logo/bytedance-seed.png',
        seed: '/static/logo/bytedance-seed.png',
        llama: '/static/logo/llama.png',
        claude: '/static/logo/Claude.png',
        sonnet: '/static/logo/Claude.png',
        haiku: '/static/logo/Claude.png',
        opus: '/static/logo/Claude.png',
        nvidia: '/static/logo/Nvidia.png',
        nemotron: '/static/logo/Nvidia.png'
    };

    /**
     * 获取角色信息
     * @param {string} roleType - 角色类型标识
     * @returns {Object} 包含 name 和 emoji 的角色信息对象
     */
    var getRoleInfo = (roleType) => {
        if (ROLE_INFO_MAP[roleType]) return ROLE_INFO_MAP[roleType];
        // 处理带数字后缀的 role_id（如 werewolf2、villager3），去掉后缀后查找基础角色
        const baseRole = roleType?.replace(/\d+$/, '');
        if (baseRole && ROLE_INFO_MAP[baseRole]) return ROLE_INFO_MAP[baseRole];
        return { name: '未知', emoji: '[?]', faction: 'unknown' };
    };

    /**
     * 根据玩家名获取角色立绘
     * @param {string} playerName - 玩家名称
     * @returns {string} 立绘图片路径
     */
    var getPlayerSprite = (playerName) => {
        if (!playerName) return '/static/images/role/Commoner-雾隐.webp';
        return PLAYER_AVATAR_MAP[playerName] || '/static/images/role/Commoner-雾隐.webp';
    };

    /**
     * 根据玩家名获取角色图标
     * @param {string} playerName - 玩家名称
     * @returns {string} 图标图片路径
     */
    var getPlayerIcon = (playerName) => {
        if (!playerName) return '/static/images/role_icon/Commoner-雾隐-UIicon.webp';
        return PLAYER_ICON_MAP[playerName] || '/static/images/role_icon/Commoner-雾隐-UIicon.webp';
    };

    /**
     * 根据角色ID获取角色图标
     * @param {string} roleId - 角色ID
     * @returns {string} 图标图片路径
     */
    var getRoleIcon = (roleId) => {
        if (!roleId) return '/static/images/role_icon/Commoner-雾隐-UIicon.webp';
        return ROLE_ICON_MAP[roleId] || '/static/images/role_icon/Commoner-雾隐-UIicon.webp';
    };

    /**
     * 根据角色ID获取角色立绘
     * @param {string} roleId - 角色ID
     * @returns {string} 立绘图片路径
     */
    var getRoleSprite = (roleId) => {
        if (!roleId) return '/static/images/role/Commoner-雾隐.webp';
        return ROLE_SPRITE_MAP[roleId] || '/static/images/role/Commoner-雾隐.webp';
    };

    /**
     * 为角色类型获取头像 URL
     * 1. 优先使用用户在角色管理中上传的自定义头像
     * 2. 其次根据角色的 model 字段自动匹配对应模型的 logo
     * 3. 最后回退到 defaultAvatarUrls 中的默认头像
     * @param {string} roleType - 角色类型标识（如 werewolf、werewolf2、seer 等）
     * @returns {string} 头像 URL
     */
    var getAvatarForRole = (roleType) => {
        const roleConfig = window.roles?.[roleType];
        if (!roleConfig) {
            return window.defaultAvatarUrls?.villager || '/static/logo/ChatGPT.png';
        }
        // 1. 如果有自定义头像（非默认的 ChatGPT.png），直接返回用户设置的头像
        if (roleConfig.avatar && roleConfig.avatar !== '/static/logo/ChatGPT.png') {
            return roleConfig.avatar;
        }
        // 2. 根据角色的 model 字段自动匹配对应模型的 logo
        if (roleConfig.model) {
            return getLogoForModel(roleConfig.model);
        }
        // 3. 回退到默认头像
        const baseRole = roleType?.replace(/\d+$/, '');
        return window.defaultAvatarUrls?.[baseRole] || window.defaultAvatarUrls?.villager || '/static/logo/ChatGPT.png';
    };

    /**
     * 根据角色 ID 获取默认头像
     * @param {string} roleId - 角色 ID
     * @returns {string} 默认头像 URL
     */
    var getDefaultAvatarForRole = (roleId) => {
        return window.defaultAvatarUrls?.[roleId] || window.defaultAvatarUrls?.villager || '/static/logo/ChatGPT.png';
    };

    /**
     * 根据模型名称获取对应 Logo 路径
     * 使用前缀匹配，找到第一个匹配的关键词即返回
     * @param {string} modelName - 模型名称（如 "gpt-4-turbo"）
     * @returns {string} Logo 图片路径
     */
    var getLogoForModel = (modelName) => {
        if (!modelName) return '/static/logo/ChatGPT.png';

        const lowerModelName = modelName.toLowerCase();

        for (const [keyword, logoPath] of Object.entries(MODEL_LOGO_MAP)) {
            if (lowerModelName.includes(keyword)) {
                return logoPath;
            }
        }

        return '/static/logo/ChatGPT.png';
    };

    /**
     * 延迟函数 - 返回一个在指定毫秒后 resolve 的 Promise
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise<void>}
     */
    var delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * Fisher-Yates 洗牌算法
     * 返回洗牌后的新数组，不修改原数组
     * @param {Array} array - 原数组
     * @returns {Array} 洗牌后的新数组
     */
    var shuffleArray = (array) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    /**
     * 根据座位索引和玩家总数获取对应的角色 ID
     * @param {number} index - 座位索引（从 0 开始）
     * @param {number} playerCount - 玩家总数（6、8 或 10）
     * @returns {string} 角色 ID
     */
    var getRoleIdForSeat = (index, playerCount) => {
        const roleList = window.roleDistribution?.[playerCount] || window.roleDistribution?.[6] || [];
        return roleList[index % roleList.length] || 'villager';
    };

    /**
     * 安全的 JSON 解析函数
     * @param {string} jsonString - JSON 字符串
     * @param {*} defaultValue - 解析失败时的默认值
     * @returns {*} 解析结果或默认值
     */
    var safeJSONParse = (jsonString, defaultValue = null) => {
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.warn('[Utils] JSON parse error:', e.message);
            return defaultValue;
        }
    };

    /**
     * 格式化时间戳为可读字符串
     * @param {number} timestamp - 时间戳（毫秒）
     * @returns {string} 格式化的时间字符串
     */
    var formatTimestamp = (timestamp = Date.now()) => {
        const date = new Date(timestamp);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    /**
     * 生成唯一标识符
     * @returns {string} UUID 格式字符串
     */
    var generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} wait - 等待毫秒数
     * @returns {Function} 防抖后的函数
     */
    var debounce = (func, wait = 300) => {
        let timeoutId = null;
        return (...args) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(null, args), wait);
        };
    };

    // ==================== 导出到命名空间 ====================
    window.App.utils = {
        ROLE_INFO_MAP,
        PLAYER_AVATAR_MAP,
        PLAYER_ICON_MAP,
        ROLE_ICON_MAP,
        ROLE_SPRITE_MAP,
        getRoleInfo,
        getAvatarForRole,
        getDefaultAvatarForRole,
        getLogoForModel,
        getPlayerSprite,
        getPlayerIcon,
        getRoleIcon,
        getRoleSprite,
        delay,
        shuffleArray,
        getRoleIdForSeat,
        safeJSONParse,
        formatTimestamp,
        generateUUID,
        debounce
    };

    // ==================== 向后兼容：保留全局引用 ====================
    window.getRoleInfo = getRoleInfo;
    window.getAvatarForRole = getAvatarForRole;
    window.getDefaultAvatarForRole = getDefaultAvatarForRole;
    window.getLogoForModel = getLogoForModel;
    window.getPlayerSprite = getPlayerSprite;
    window.getPlayerIcon = getPlayerIcon;
    window.getRoleIcon = getRoleIcon;
    window.getRoleSprite = getRoleSprite;
    window.delay = delay;
    window.shuffleArray = shuffleArray;
    window.getRoleIdForSeat = getRoleIdForSeat;
    window.safeJSONParse = safeJSONParse;
    window.formatTimestamp = formatTimestamp;
    window.generateUUID = generateUUID;
    window.debounce = debounce;
    window.ROLE_INFO_MAP = ROLE_INFO_MAP;
    window.PLAYER_AVATAR_MAP = PLAYER_AVATAR_MAP;
    window.PLAYER_ICON_MAP = PLAYER_ICON_MAP;
    window.ROLE_ICON_MAP = ROLE_ICON_MAP;
    window.ROLE_SPRITE_MAP = ROLE_SPRITE_MAP;
    window.MODEL_LOGO_MAP = MODEL_LOGO_MAP;
}
