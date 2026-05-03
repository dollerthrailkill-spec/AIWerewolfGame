/**
 * uiManager.js - UI 管理模块
 *
 * 负责所有 DOM 操作、渲染、弹窗控制、文本更新等 UI 相关功能。
 * 采用集中管理 UI 引用的方式，减少重复的 DOM 查询。
 * 所有功能逻辑保持不变，架构和语法进行优化。
 *
 * @module UIManager
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== DOM 元素引用缓存 ====================
/** @type {Object<string, HTMLElement>} */
const elements = {};

/**
 * 懒加载 DOM 元素引用
 * 首次访问时查询并缓存，后续直接返回缓存值
 * @param {string} id - DOM 元素 ID
 * @returns {HTMLElement|null}
 */
const getElement = (id) => {
    if (!elements[id]) {
        elements[id] = document.getElementById(id);
    }
    return elements[id];
};

/**
 * 初始化 UI 管理器 - 缓存常用 DOM 元素引用
 */
const initUIManager = () => {
    const ids = [
        'home-page', 'game-page', 'settings-modal', 'role-edit-modal',
        'mvp-vote-modal', 'game-over-modal', 'api-error-modal',
        'seats-container', 'current-step', 'game-info', 'center-text',
        'speech-area', 'speech-text', 'speaker-avatar', 'speaker-name',
        'speaker-role', 'voting-area', 'voting-players', 'submit-vote-btn',
        'mvp-candidates', 'submit-mvp-btn', 'game-result-title',
        'mvp-avatar', 'mvp-name', 'final-roles', 'game-log', 'speech-log'
    ];

    ids.forEach(id => {
        elements[id] = document.getElementById(id);
    });

    console.log('[UIManager] Initialized with', ids.length, 'elements');
};

// ==================== 开始按钮状态管理 ====================

/**
 * 更新开始按钮的可用状态
 * 检查是否有有效的供应商配置和游戏模式选择
 */
const updateStartButtonState = () => {
    const startButton = getElement('start-game-btn');
    if (!startButton) return;

    let hasValidProvider = false;
    if (window.App.providers?.length > 0) {
        hasValidProvider = window.App.providers.some(p => {
            const hasKey = (p.encrypted_api_key?.trim()) ||
                           (p.api_key && !p.api_key.includes('*') && p.api_key.trim());
            const hasUrl = p.api_url?.trim();
            return hasKey && hasUrl;
        });
    }

    if (currentGameMode && hasValidProvider) {
        startButton.disabled = false;
        startButton.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        startButton.disabled = true;
        startButton.classList.add('opacity-50', 'cursor-not-allowed');
    }
};

// ==================== 弹窗控制 ====================

/**
 * 切换设置弹窗的显示状态
 */
const toggleSettingsModal = () => {
    const modal = getElement('settings-modal');
    if (!modal) return;

    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) {
        renderProviders();
        renderRolesGrid();
    }
};

/**
 * 切换角色编辑弹窗的显示状态
 */
const toggleRoleEditModal = () => {
    const modal = getElement('role-edit-modal');
    if (modal) modal.classList.toggle('hidden');
};

/**
 * 切换游戏结束弹窗的显示状态
 */
const toggleGameOverModal = () => {
    const modal = getElement('game-over-modal');
    if (modal) modal.classList.toggle('hidden');
};

/**
 * 切换 API 错误弹窗的显示状态
 */
const toggleApiErrorModal = () => {
    const modal = getElement('api-error-modal');
    if (modal) modal.classList.toggle('hidden');
};

// ==================== 过渡遮罩 ====================

/** BUG 9 修复：过渡动画状态锁，防止重入 */
let transitionOverlayActive = false;
let transitionOverlayTimeout = null;

/**
 * 显示过渡遮罩动画
 * BUG 9 修复：添加防重入机制，新调用取消旧调用的定时器
 * @param {Function} callback - 动画中间执行的回调
 * @param {string} [text=''] - 显示的文字
 * @param {number} [duration=1500] - 持续时间（毫秒）
 */
const showTransitionOverlay = (callback, text = '', duration = 1500) => {
    const overlay = getElement('transitionOverlay');
    if (!overlay) return;

    // BUG 9 修复：取消前一次过渡的定时器
    if (transitionOverlayTimeout) {
        clearTimeout(transitionOverlayTimeout);
        transitionOverlayTimeout = null;
    }

    const textElement = overlay.querySelector('.transition-text');
    if (textElement) textElement.textContent = text;
    overlay.classList.remove('hidden');
    transitionOverlayActive = true;

    transitionOverlayTimeout = setTimeout(() => {
        if (callback) callback();
        transitionOverlayTimeout = setTimeout(() => {
            overlay.classList.add('hidden');
            transitionOverlayActive = false;
            transitionOverlayTimeout = null;
        }, 600);
    }, duration);
};

// ==================== 座位渲染 ====================

/**
 * 渲染玩家座位
 * 根据当前游戏状态中的玩家列表，在圆形桌面上排列座位
 */
const renderSeats = () => {
    const seatsContainer = getElement('seats-container');
    if (!seatsContainer) {
        console.error('[UIManager] Seats container not found!');
        return;
    }

    // 清空容器
    while (seatsContainer.firstChild) {
        seatsContainer.removeChild(seatsContainer.firstChild);
    }
    
    const players = window.App.state?.players || [];
    if (players.length === 0) return;

    const seatCount = players.length;
    const angleStep = (2 * Math.PI) / seatCount;
    const containerWidth = seatsContainer.clientWidth || 400;
    const isMobile = containerWidth < 640;
    const baseRadius = isMobile ? 35 : seatCount <= 6 ? 40 : seatCount <= 8 ? 42 : 44;

    players.forEach((player, index) => {
        const angle = index * angleStep - Math.PI / 2;
        const x = 50 + baseRadius * Math.cos(angle);
        const y = 50 + baseRadius * Math.sin(angle);

        const seat = document.createElement('div');
        seat.className = 'seat absolute w-16 h-28 flex flex-col items-center cursor-pointer';
        seat.style.left = `${x}%`;
        seat.style.top = `${y}%`;
        seat.style.transform = 'translate(-50%, -50%)';
        seat.dataset.playerId = player.id;

        const roleId = player.role_id || player.role;
        const roleInfo = getRoleInfo(roleId);
        const isDead = !player.is_alive;

        if (isDead) seat.classList.add('seat-dead');

        // 使用角色图标映射 - 根据角色显示图标
        const playerIcon = getRoleIcon(roleId);
        const roleName = roleInfo?.name || '平民';

        // 使用DOM API构建，避免innerHTML
        const avatarWrapper = document.createElement('div');
        avatarWrapper.className = `avatar-wrapper w-12 h-12 rounded-lg overflow-hidden border-2 border-gothic-gold/50 ${isDead ? 'grayscale brightness-50' : ''}`;
        
        const img = document.createElement('img');
        img.src = playerIcon;
        img.alt = player.name;
        img.className = 'w-full h-full object-cover';
        avatarWrapper.appendChild(img);
        
        const playerNameDiv = document.createElement('div');
        playerNameDiv.className = 'player-name text-xs font-gothic mt-1 text-gothic-light text-center';
        playerNameDiv.textContent = player.name;
        
        const roleLabelDiv = document.createElement('div');
        roleLabelDiv.className = 'player-role-label';
        roleLabelDiv.textContent = roleName;
        
        seat.appendChild(avatarWrapper);
        seat.appendChild(playerNameDiv);
        seat.appendChild(roleLabelDiv);

        seatsContainer.appendChild(seat);
    });
};

// ==================== 发言高亮 ====================

/**
 * 高亮显示当前发言者的座位
 * BUG 8 修复：使用 seat-speaking 替代 seat-active，避免与其他功能冲突
 * @param {string|number} playerId - 玩家 ID
 */
const highlightSpeaker = (playerId) => {
    document.querySelectorAll('.seat.seat-speaking').forEach(s => s.classList.remove('seat-speaking'));
    const seat = document.querySelector(`.seat[data-player-id="${playerId}"]`);
    if (seat) seat.classList.add('seat-speaking');
};

/**
 * 取消发言者的高亮
 * @param {string|number} playerId - 玩家 ID
 */
const unhighlightSpeaker = (playerId) => {
    const seat = document.querySelector(`.seat[data-player-id="${playerId}"]`);
    if (seat) seat.classList.remove('seat-speaking');
};

// ==================== 中心文本更新 ====================

/** BUG 6 修复：可取消的中心文字定时器 */
let centerTextTimeout = null;

/**
 * 更新中心显示文本（带自动消失效果）
 * BUG 6 修复：新调用时取消前一次的定时器，防止文字被提前隐藏
 * @param {string} text - 要显示的文字
 * @param {number} [duration=3000] - 显示持续时间
 */
const updateCenterText = (text, duration = 3000) => {
    const centerText = getElement('center-text');
    if (!centerText) return;

    // BUG 6 修复：取消前一次的定时器
    if (centerTextTimeout) clearTimeout(centerTextTimeout);

    centerText.textContent = text;
    centerText.classList.add('opacity-100');

    centerTextTimeout = setTimeout(() => {
        centerText.classList.remove('opacity-100');
        centerTextTimeout = null;
    }, duration);
};

// ==================== 游戏步骤更新 ====================

// 游戏步骤描述映射
const STEP_DESCRIPTIONS = {
    '过场等待': '游戏正在准备中，请稍候...',
    'AI 入座': 'AI 角色正在入座，请稍候...',
    '天黑请闭眼': '天黑了，请所有玩家闭眼...',
    '狼人行动': '狼人请睁眼，商量要杀的人...',
    '预言家验人': '预言家请睁眼，选择要验的人...',
    '女巫行动': '女巫请睁眼，是否使用药水...',
    '天亮了': '天亮了，所有人请睁眼...',
    '发言环节': '发言环节，请按顺序发言...',
    '投票放逐': '投票环节，请选择要放逐的玩家...'
};

/**
 * 更新游戏步骤显示
 * @param {string} stepText - 步骤名称
 */
const updateGameStep = (stepText) => {
    const stepEl = getElement('current-step');
    if (stepEl) stepEl.textContent = stepText;

    // 更新进度条
    const stepIndex = window.gameSteps?.indexOf(stepText) ?? -1;
    const totalSteps = window.gameSteps?.length || 1;
    const progress = ((stepIndex + 1) / totalSteps) * 100;
    const progressBar = document.querySelector('.progress-bar-fill');
    if (progressBar) progressBar.style.setProperty('--progress', `${progress}%`);

    // 更新游戏信息
    const gameInfo = getElement('game-info');
    if (gameInfo) gameInfo.textContent = STEP_DESCRIPTIONS[stepText] || stepText;
};

// ==================== 中心横幅 ====================

/**
 * 在座位区域中央显示横幅通知
 * BUG 5 修复：添加前先移除已有 banner，防止重叠
 * @param {string} title - 标题
 * @param {string} subtitle - 副标题
 * @param {string} [bannerClass=''] - 额外的 CSS 类名
 * @param {number} [duration=2500] - 显示持续时间
 */
const showCenterBanner = (title, subtitle, bannerClass = '', duration = 2500) => {
    const seatsContainer = getElement('seats-container');
    if (!seatsContainer) return;

    // BUG 5 修复：先移除已有的 banner，防止重叠
    seatsContainer.querySelectorAll('.center-banner').forEach(b => b.remove());

    const banner = document.createElement('div');
    banner.className = `center-banner ${bannerClass}`;
    
    const h3 = document.createElement('h3');
    h3.textContent = title;
    banner.appendChild(h3);
    
    const p = document.createElement('p');
    p.textContent = subtitle;
    banner.appendChild(p);
    
    seatsContainer.appendChild(banner);

    setTimeout(() => {
        if (banner.isConnected) {
            banner.style.animation = 'bannerFadeOut 0.5s ease forwards';
            setTimeout(() => {
                if (banner.isConnected) banner.remove();
            }, 500);
        }
    }, duration);
};

// ==================== 导出到命名空间 ====================
window.App.ui = {
    elements,
    getElement,
    initUIManager,
    updateStartButtonState,
    toggleSettingsModal,
    toggleRoleEditModal,
    toggleGameOverModal,
    toggleApiErrorModal,
    showTransitionOverlay,
    renderSeats,
    highlightSpeaker,
    unhighlightSpeaker,
    updateCenterText,
    updateGameStep,
    showCenterBanner,
    STEP_DESCRIPTIONS
};

// ==================== 向后兼容：保留全局引用 ====================
window.initUIManager = initUIManager;
window.updateStartButtonState = updateStartButtonState;
window.toggleSettingsModal = toggleSettingsModal;
window.toggleRoleEditModal = toggleRoleEditModal;
window.toggleGameOverModal = toggleGameOverModal;
window.toggleApiErrorModal = toggleApiErrorModal;
window.showTransitionOverlay = showTransitionOverlay;
window.renderSeats = renderSeats;
window.highlightSpeaker = highlightSpeaker;
window.unhighlightSpeaker = unhighlightSpeaker;
window.updateCenterText = updateCenterText;
window.updateGameStep = updateGameStep;
window.showCenterBanner = showCenterBanner;

// 保留 DOM 元素引用（向后兼容）
const _initRefs = () => {
    window.homePage = window.homePage || getElement('home-page');
    window.gamePage = window.gamePage || getElement('game-page');
    window.settingsModal = window.settingsModal || getElement('settings-modal');
    window.roleEditModal = window.roleEditModal || getElement('role-edit-modal');
    window.mvpVoteModal = window.mvpVoteModal || getElement('mvp-vote-modal');
    window.gameOverModal = window.gameOverModal || getElement('game-over-modal');
    window.apiErrorModal = window.apiErrorModal || getElement('api-error-modal');
};
// 延迟初始化，等 DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initRefs);
} else {
    _initRefs();
}
