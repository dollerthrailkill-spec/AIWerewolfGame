/**
 * stats.js - 数据统计模块
 *
 * 从后端 API 获取游戏统计数据，包括：
 * - 总对局数和胜负统计
 * - 按阵营/角色的胜率
 * - 游戏历史记录（时间线）
 * - MVP 次数统计
 * - 模型使用统计
 * - 发言/击杀统计数据
 *
 * @module Stats
 */

// 检查是否已经加载过，防止重复声明
if (typeof window.__statsLoaded === 'undefined') {
    window.__statsLoaded = true;

    // ==================== App 命名空间初始化 ====================
    window.App = window.App || {};

    // ==================== API 请求封装 ====================

    // apiGet 已在 achievements.js 中定义，此处不再重复声明

    // ==================== 统计摘要 ====================

    /**
     * 获取统计摘要
     * @returns {Promise<Object>} 统计摘要
     */
    var getStatsSummary = async () => {
        const data = await apiGet('stats/summary');
        if (!data.success) {
            console.warn('[Stats] Failed to load summary:', data.message);
            return {};
        }
        return data;
    };

    /**
     * 获取游戏历史记录
     * @param {number} limit - 返回数量
     * @param {number} offset - 偏移量
     * @returns {Promise<Array>} 历史记录列表
     */
    var getGameHistory = async (limit = 50, offset = 0) => {
        const data = await apiGet(`stats/history?limit=${limit}&offset=${offset}`);
        return data.success ? (data.history || []) : [];
    };

    /**
     * 获取各角色胜场统计
     * @returns {Promise<Object>} { role: count }
     */
    var getWinsByRole = async () => {
        const data = await apiGet('stats/wins-by-role');
        return data.success ? (data.wins || {}) : {};
    };

    /**
     * 获取各模式胜场统计
     * @returns {Promise<Object>} { playerCount: count }
     */
    var getWinsByMode = async () => {
        const data = await apiGet('stats/wins-by-mode');
        return data.success ? (data.wins || {}) : {};
    };

    // ==================== MVP / 模型排行榜 ====================

    /**
     * 获取 MVP 排行榜
     * @param {number} limit - 返回数量
     * @returns {Array} [{ name, count }]
     */
    var getTopMVPs = async (limit = 10) => {
        const data = await apiGet(`leaderboard/mvp?limit=${limit}`);
        return data.success ? (data.rankings || []) : [];
    };

    /**
     * 获取模型胜率排行榜
     * @param {number} minGames - 最少游戏场数
     * @param {number} limit - 返回数量
     * @returns {Array} [{ model, winRate, games, wins }]
     */
    var getTopModels = async (minGames = 3, limit = 10) => {
        const data = await apiGet(`leaderboard/models?min_games=${minGames}&limit=${limit}`);
        return data.success ? (data.rankings || []) : [];
    };

    // ==================== 兼容旧接口（同步版本，返回空/默认值） ====================
    // 这些函数保留以兼容可能存在的同步调用方，但数据来自后端

    /**
     * 加载统计数据（兼容旧接口，现在返回空对象，使用 getStatsSummary 代替）
     * @returns {Object} 空对象
     */
    var loadStats = () => {
        console.warn('[Stats] loadStats() is deprecated, use getStatsSummary() instead');
        return {};
    };

    /**
     * 保存统计数据（兼容旧接口，现在无操作）
     * @returns {boolean} true
     */
    var saveStats = () => true;

    /**
     * 记录一局游戏（兼容旧接口，数据由后端自动记录）
     * @returns {Object} 空对象
     */
    var recordGame = () => {
        console.warn('[Stats] recordGame() is deprecated, data is saved by backend automatically');
        return {};
    };

    /**
     * 重置所有统计数据（兼容旧接口）
     */
    var resetStats = () => {
        console.warn('[Stats] resetStats() is deprecated');
    };

    // ==================== 导出到命名空间 ====================
    window.App.stats = {
        // 新异步接口
        getStatsSummary,
        getGameHistory,
        getWinsByRole,
        getWinsByMode,
        getTopMVPs,
        getTopModels,
        // 兼容旧接口
        loadStats,
        saveStats,
        recordGame,
        resetStats,
    };

    // ==================== 向后兼容：保留全局引用 ====================
    window.getStatsSummary = getStatsSummary;
    window.getGameHistory = getGameHistory;
    window.getWinsByRole = getWinsByRole;
    window.getWinsByMode = getWinsByMode;
    window.getTopMVPs = getTopMVPs;
    window.getTopModels = getTopModels;
    window.loadStats = loadStats;
    window.saveStats = saveStats;
    window.recordGame = recordGame;
    window.resetStats = resetStats;
}
