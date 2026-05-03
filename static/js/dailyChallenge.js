/**
 * dailyChallenge.js - 每日挑战模块
 *
 * 从后端 API 获取每日挑战数据，包括挑战列表、完成状态和积分。
 * 后端使用日期种子确定性生成每日挑战。
 *
 * @module DailyChallenge
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== API 请求封装 ====================

// apiGet 已在 achievements.js 中定义，此处不再重复声明

/**
 * 发起 POST 请求到后端 API
 * @param {string} path - API 路径（不含 /api 前缀）
 * @param {Object} body - 请求体
 * @returns {Promise<Object>} 响应数据
 */
const apiPost = async (path, body = {}) => {
    try {
        const resp = await fetch(`/api/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return await resp.json();
    } catch (e) {
        console.error(`[DailyChallenge] API POST /api/${path} failed:`, e);
        return { success: false, message: e.message };
    }
};

// ==================== 每日挑战操作 ====================

/**
 * 获取今日挑战列表
 * @returns {Promise<Object>} { challenges, todayPoints, totalPoints }
 */
const getTodayChallenges = async () => {
    const data = await apiGet('daily-challenges');
    if (!data.success) {
        console.warn('[DailyChallenge] Failed to load challenges:', data.message);
        return { challenges: [], todayPoints: 0, totalPoints: 0 };
    }
    return data;
};

/**
 * 标记挑战完成
 * @param {number} challengeIndex - 挑战索引
 * @returns {Promise<boolean>} 是否成功
 */
const markChallengeComplete = async (challengeIndex) => {
    const data = await apiPost('daily-challenges/complete', { challenge_index: challengeIndex });
    return data.success;
};

/**
 * 获取今日已完成挑战的积分
 * @returns {Promise<number>}
 */
const getTodayPoints = async () => {
    const data = await getTodayChallenges();
    return data.todayPoints || 0;
};

/**
 * 获取累计挑战积分
 * @returns {Promise<number>}
 */
const getTotalPoints = async () => {
    const data = await getTodayChallenges();
    return data.totalPoints || 0;
};

// ==================== UI 渲染 ====================

/**
 * 渲染挑战列表到容器
 * @param {HTMLElement} container - 容器元素
 */
const renderChallengeList = async (container) => {
    if (!container) return;

    const data = await getTodayChallenges();
    const challenges = data.challenges || [];
    const todayPoints = data.todayPoints || 0;
    const totalPoints = data.totalPoints || 0;

    // 更新积分显示
    const pointsEl = document.getElementById('daily-challenge-points');
    if (pointsEl) pointsEl.textContent = todayPoints;
    const totalPointsEl = document.getElementById('daily-challenge-total-points');
    if (totalPointsEl) totalPointsEl.textContent = totalPoints;

    if (!challenges.length) {
        container.innerHTML = '<p class="text-gray-500 text-sm text-center py-8">今日挑战加载中...</p>';
        return;
    }

    container.innerHTML = challenges.map((c, i) => `
        <div class="rounded-xl border p-4 transition-all ${
            c.completed
                ? 'border-gold-500/30 bg-gold-500/10'
                : 'border-gray-700/40 bg-dark-800/50 hover:border-gold-500/20'
        }">
            <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">${c.completed ? '✅' : '🎯'}</span>
                        <span class="font-cinzel text-sm ${c.completed ? 'text-gold-400' : 'text-gray-200'}">${c.challenge_title}</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1 ml-7">${c.challenge_desc}</p>
                </div>
                <div class="text-right shrink-0">
                    <span class="text-xs ${c.completed ? 'text-gold-400' : 'text-gray-500'}">+${c.points}pt</span>
                    ${!c.completed ? `
                        <button class="block mt-1 text-xs px-3 py-1 rounded-lg border border-gold-500/20 text-gold-500 hover:bg-gold-500/10 transition-colors"
                                onclick="window.App.dailyChallenge.markChallengeComplete(${i})">
                            完成
                        </button>
                    ` : '<div class="text-xs text-gold-500 mt-1">✓ 已完成</div>'}
                </div>
            </div>
        </div>
    `).join('');
};

// ==================== 兼容旧接口 ====================

const generateDailyChallenges = () => {};
const checkChallenges = () => {};
const getChallengePoints = () => 0;

// ==================== 导出到命名空间 ====================
window.App.dailyChallenge = {
    // 新异步接口
    getTodayChallenges,
    markChallengeComplete,
    getTodayPoints,
    getTotalPoints,
    renderChallengeList,
    // 兼容旧接口
    generateDailyChallenges,
    checkChallenges,
    getChallengePoints,
};
