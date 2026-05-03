/**
 * achievements.js - 成就系统模块
 *
 * 从后端 API 获取成就数据，管理成就的展示和解锁通知。
 * 成就的解锁检测由后端在游戏结束时自动完成。
 *
 * @module Achievements
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== API 请求封装 ====================

/**
 * 发起 GET 请求到后端 API
 * @param {string} path - API 路径（不含 /api 前缀）
 * @returns {Promise<Object>} 响应数据
 */
const apiGet = async (path) => {
    try {
        const resp = await fetch(`/api/${path}`);
        return await resp.json();
    } catch (e) {
        console.error(`[Achievements] API GET /api/${path} failed:`, e);
        return { success: false, message: e.message };
    }
};

// ==================== 成就数据获取 ====================

/**
 * 获取所有成就及其解锁状态
 * @returns {Promise<Array>} [{ id, name, description, icon, category, points, unlocked, unlocked_at, ... }]
 */
const getAllAchievements = async () => {
    const data = await apiGet('achievements');
    if (!data.success) {
        console.warn('[Achievements] Failed to load achievements:', data.message);
        return [];
    }
    return data.achievements || [];
};

/**
 * 获取成就统计
 * @returns {Promise<Object>} { total, unlocked, totalPoints }
 */
const getAchievementStats = async () => {
    const data = await apiGet('achievements');
    if (!data.success) {
        return { total: 0, unlocked: 0, totalPoints: 0 };
    }
    return {
        total: data.total || 0,
        unlocked: data.unlocked || 0,
        totalPoints: data.totalPoints || 0,
    };
};

// ==================== 通知动画 ====================

/**
 * 显示成就解锁通知
 * @param {Object} achievement - 成就对象 { name, description, icon }
 */
const showAchievementNotification = (achievement) => {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification fixed top-4 right-4 z-50';
    notification.style.cssText = `
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #d4af37;
        border-radius: 12px;
        padding: 16px 24px;
        box-shadow: 0 0 30px rgba(212, 175, 55, 0.3);
        animation: achievementSlideIn 0.5s ease-out, achievementGlow 2s ease-in-out infinite;
        max-width: 320px;
    `;

    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="achievement-icon text-3xl">${achievement.icon || '🏆'}</div>
            <div>
                <div class="text-gold-400 font-bold text-sm">🏅 成就解锁！</div>
                <div class="text-gray-100 font-cinzel font-bold mt-1">${achievement.name}</div>
                <div class="text-gray-400 text-xs mt-1">${achievement.description}</div>
                ${achievement.points ? `<div class="text-gold-500 text-xs mt-1">+${achievement.points} 积分</div>` : ''}
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // 播放解锁音效
    try {
        const ctx = window.App?.audio?.getAudioContext?.();
        if (ctx) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.6);
        }
    } catch (e) { /* 静默失败 */ }

    // 4秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'achievementSlideOut 0.5s ease-in forwards';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
};

// ==================== 注入 CSS 动画 ====================
const injectStyles = () => {
    if (document.getElementById('achievement-styles')) return;

    const style = document.createElement('style');
    style.id = 'achievement-styles';
    style.textContent = `
        @keyframes achievementSlideIn {
            from { transform: translateX(120%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes achievementSlideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(120%); opacity: 0; }
        }
        @keyframes achievementGlow {
            0%, 100% { box-shadow: 0 0 20px rgba(212, 175, 55, 0.3); }
            50% { box-shadow: 0 0 40px rgba(212, 175, 55, 0.6); }
        }
    `;
    document.head.appendChild(style);
};

// 初始化样式注入
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles);
} else {
    injectStyles();
}

// ==================== 兼容旧接口 ====================

/**
 * 检查成就（兼容旧接口，现在由后端自动检测）
 * @returns {Array} 空数组
 */
const checkAchievements = () => {
    console.warn('[Achievements] checkAchievements() is now handled by backend');
    return [];
};

/**
 * 检查成就是否已解锁（兼容旧接口）
 * @param {string} achievementId
 * @returns {boolean} false
 */
const isUnlocked = () => false;

/**
 * 获取已解锁数量（兼容旧接口）
 * @returns {number} 0
 */
const getUnlockedCount = () => 0;

// ==================== 导出到命名空间 ====================
window.App.achievements = {
    // 新异步接口
    getAllAchievements,
    getAchievementStats,
    showAchievementNotification,
    // 兼容旧接口
    checkAchievements,
    isUnlocked,
    getUnlockedCount,
};
