/**
 * animation.js - 动画效果模块
 *
 * 提供游戏中的各种动画效果：
 * - 元素抖动（死亡效果）
 * - 遗言遮罩
 * - 夜间行动动画（粒子连线、技能特效）
 * - 动作提示框
 *
 * 修复问题：
 * - BUG 2: sub_phase 与 night_actions 音效双重播放 → 记录已播放音效，跳过重复
 * - BUG 3: 并发夜间动画无取消机制 → 全局动画ID令牌
 * - BUG 4: showActionTooltip 累积叠加 → 添加前清理
 * - BUG 7: clearSubPhaseHighlight 移除 night-mode 导致闪烁 → 不再移除 night-mode
 * - BUG 10: setTimeout 与 await delay 时序竞争 → 主动清理前一个动作
 * - BUG 11: sub_phase 重复调用不跳过 → 同角色直接返回
 * - BUG 14: 连线 DOM 泄漏 → 统一清理函数
 *
 * @module Animation
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 夜间行动配置 ====================

/** 技能类型到 CSS 类名和音效的映射 */
const SKILL_CONFIG = {
    werewolf: { nightClass: 'night-werewolf-active', soundId: 'werewolf-sound' },
    seer: { nightClass: 'night-seer-active', soundId: 'seer-sound' },
    'witch-poison': { nightClass: 'night-witch-active', soundId: 'witch-sound' },
    'witch-heal': { nightClass: 'night-witch-active', soundId: 'witch-sound' },
    guard: { nightClass: 'night-guard-active', soundId: 'guard-sound' }
};

/** 动作文本延迟 */
const ACTION_DELAY = 2800;

/** 目标名称提取正则 */
const TARGET_PATTERNS = [
    /击杀\s*(.+)/, /杀害\s*(.+)/, /选择击杀\s*(.+)/,
    /查验了\s*(.+)/, /查验\s*(.+)/,
    /对\s*(.+?)\s*使用/, /投毒\s*(.+)/, /毒杀\s*(.+)/,
    /守护了\s*(.+)/, /守护\s*(.+)/,
    /救了\s*(.+)/, /保护了\s*(.+)/
];

// ==================== 动画全局状态（BUG 3: 动画锁） ====================

/** 当前夜间动画的 ID，每次新调用递增，旧动画检测到不匹配时自动退出 */
let currentNightAnimationId = 0;

/** 上一次 sub_phase 播放过的音效 ID 集合（BUG 2: 避免与 night_actions 重复播放） */
let lastSubPhaseSoundIds = new Set();

// ==================== 元素动画 ====================

/**
 * 抖动元素效果（用于死亡动画）
 * @param {HTMLElement} element - 要抖动的 DOM 元素
 * @param {number} [duration=500] - 抖动持续时间（毫秒）
 */
const shakeElement = (element, duration = 500) => {
    if (!element) return;
    element.classList.add('kill-target');
    setTimeout(() => element.classList.remove('kill-target'), duration);
};

// ==================== 遗言遮罩 ====================

/**
 * 显示遗言遮罩
 * @param {string} playerName - 死亡玩家名称
 * @param {string} message - 遗言内容
 */
const showEulogyOverlay = (playerName, message) => {
    const overlay = document.getElementById('eulogy-overlay');
    if (!overlay) return;

    const playerNameEl = document.getElementById('eulogy-player-name');
    if (playerNameEl) {
        playerNameEl.textContent = playerName ? `${playerName} 的遗言` : '遗言时刻';
    }

    overlay.classList.remove('hidden');

    if (window.eulogyTimeout) clearTimeout(window.eulogyTimeout);
    window.eulogyTimeout = setTimeout(() => {
        console.warn('[Animation] eulogy_end not received, auto-hiding overlay');
        hideEulogyOverlay();
    }, 5000);
};

/**
 * 隐藏遗言遮罩
 */
const hideEulogyOverlay = () => {
    const overlay = document.getElementById('eulogy-overlay');
    if (overlay) overlay.classList.add('hidden');

    if (window.eulogyTimeout) {
        clearTimeout(window.eulogyTimeout);
        window.eulogyTimeout = null;
    }
};

// ==================== 子阶段动画（广播同步） ====================

/**
 * 子阶段动画映射表
 * 将 sub_phase 值映射到对应的角色 role 值和 CSS 高亮类名
 */
const SUB_PHASE_CONFIG = {
    werewolf: { role: 'werewolf', nightClass: 'night-werewolf-active', soundId: 'werewolf-sound', label: '狼人请睁眼' },
    seer:     { role: 'seer',     nightClass: 'night-seer-active',     soundId: 'seer-sound',     label: '预言家请睁眼' },
    witch:    { role: 'witch',    nightClass: 'night-witch-active',    soundId: 'witch-sound',    label: '女巫请睁眼' },
    guard:    { role: 'guard',    nightClass: 'night-guard-active',    soundId: 'guard-sound',    label: '守卫请睁眼' },
    hunter:   { role: 'hunter',   nightClass: 'night-hunter-active',   soundId: 'werewolf-sound', label: '猎人请睁眼' },
};

/** 当前正在高亮的角色类型（用于跨阶段保持高亮） */
let currentHighlightRole = null;

/**
 * 清除当前所有子阶段高亮
 * BUG 7 修复：不再移除 night-mode，仅清除座位高亮类，避免闪烁
 */
const clearSubPhaseHighlight = () => {
    document.querySelectorAll('.seat[class*="night-"]').forEach(seat => {
        seat.classList.remove('night-werewolf', 'night-seer', 'night-witch', 'night-guard', 'night-hunter',
            'night-werewolf-active', 'night-seer-active', 'night-witch-active', 'night-guard-active', 'night-hunter-active');
    });
    currentHighlightRole = null;
    // BUG 2 修复补充：不在此时清空 lastSubPhaseSoundIds，
    // 因为 playNightActionAnimations 开头会调用此函数，
    // 而后续还需要用 lastSubPhaseSoundIds 做音效去重。
    // 音效集合在 playNightActionAnimations 的 finally 块中清空。
};

/**
 * 清理连线容器中的所有 DOM 元素（BUG 14 修复）
 */
const clearActionConnections = () => {
    const container = document.getElementById('action-connections');
    if (container) container.innerHTML = '';
};

/**
 * 播放子阶段动画
 * 当收到 sub_phase 消息时，高亮对应角色的所有座位，播放音效，显示提示
 * 高亮状态会保持到下一个 sub_phase 或 night_actions 时自动清理
 *
 * BUG 11 修复：同一 sub_phase 重复调用时跳过音效和提示
 * BUG 2 修复：记录已播放的音效 ID，供 night_actions 跳过
 *
 * @param {string} subPhase - 子阶段标识（werewolf/seer/witch/guard）
 * @returns {Promise<void>}
 */
const playSubPhaseAnimation = async (subPhase) => {
    const config = SUB_PHASE_CONFIG[subPhase];
    if (!config) {
        console.log(`[SubPhaseAnimation] Unknown sub_phase: ${subPhase}`);
        return;
    }

    // BUG 11 修复：同一角色已在高亮，跳过音效和提示
    if (currentHighlightRole === config.role) {
        console.log(`[SubPhaseAnimation] Same sub_phase: ${subPhase}, skipping duplicate`);
        return;
    }

    // 如果已经有其他角色在高亮，先清除（切换到新角色时）
    if (currentHighlightRole && currentHighlightRole !== config.role) {
        clearSubPhaseHighlight();
    }

    currentHighlightRole = config.role;

    const seatsContainer = document.getElementById('seats-container');
    if (seatsContainer) seatsContainer.classList.add('night-mode');

    // 找到所有对应角色的存活玩家座位
    const players = window.App.state?.players || [];
    const rolePlayers = players.filter(p => p.role === config.role && p.is_alive);

    if (rolePlayers.length === 0) {
        console.warn(`[SubPhaseAnimation] No alive players with role: ${config.role}`);
        return;
    }

    // 高亮所有对应角色的座位
    rolePlayers.forEach(player => {
        const seat = document.querySelector(`.seat[data-player-id="${player.id}"]`);
        if (seat) {
            seat.classList.add(config.nightClass);
        }
    });

    // BUG 2 修复：记录已播放音效，供 night_actions 跳过
    if (config.soundId) {
        lastSubPhaseSoundIds.add(config.soundId);
        playSound({ id: config.soundId });
    }

    // 在第一个高亮座位上方显示提示文字
    const firstPlayer = rolePlayers[0];
    if (firstPlayer) {
        const firstSeat = document.querySelector(`.seat[data-player-id="${firstPlayer.id}"]`);
        if (firstSeat) showActionTooltip(firstSeat, config.label);
    }

    console.log(`[SubPhaseAnimation] Highlighted for: ${subPhase}, ${rolePlayers.length} player(s)`);
};

// ==================== 夜间行动动画 ====================

/**
 * 播放夜间行动动画序列
 * 按照动作列表依次播放每个技能的动画效果
 *
 * BUG 3 修复：使用全局动画 ID 令牌，新调用自动使旧调用退出
 * BUG 2 修复：跳过 sub_phase 已播放过的音效
 * BUG 10 修复：在添加新动作类前主动清理上一个动作的类
 * BUG 8 修复：使用 seat-night-target 替代 seat-active 标记夜间目标
 *
 * @param {Array} actions - 动作数组 [{ player, action }]
 * @returns {Promise<void>}
 */
const playNightActionAnimations = async (actions) => {
    // BUG 3 修复：递增动画 ID，使旧动画自动退出
    const myAnimationId = ++currentNightAnimationId;
    console.log(`[NightAnimation] Starting #${myAnimationId}, ${actions.length} actions:`, actions.map(a => `${a.player} -> ${a.action}`));

    // 清除子阶段的高亮（从 sub_phase 切换到 night_actions 时）
    clearSubPhaseHighlight();

    const seatsContainer = document.getElementById('seats-container');
    if (seatsContainer) seatsContainer.classList.add('night-mode');

    const usedWerewolfIds = new Set();

    // BUG 10 修复：记录上一个动作的元素引用，在下一个动作开始时主动清理
    let prevActorSeat = null;
    let prevActorNightClass = null;
    let prevTargetSeat = null;

    const cleanupPrevAction = () => {
        if (prevActorSeat && prevActorNightClass) {
            prevActorSeat.classList.remove(prevActorNightClass);
        }
        if (prevTargetSeat) {
            prevTargetSeat.classList.remove('seat-night-target');
        }
        prevActorSeat = null;
        prevActorNightClass = null;
        prevTargetSeat = null;
    };

    try {
        for (const action of actions) {
            // BUG 3 修复：检查动画是否已被新调用取代
            if (myAnimationId !== currentNightAnimationId) {
                console.log(`[NightAnimation] #${myAnimationId} cancelled by #${currentNightAnimationId}`);
                return;
            }

            // BUG 10 修复：在处理新动作前，主动清理上一个动作的高亮
            cleanupPrevAction();

            let playerObj = window.App.state.players.find(p => p.name === action.player);

            if (!playerObj && action.player === '狼人') {
                playerObj = window.App.state.players.find(
                    p => p.role === 'werewolf' && p.is_alive && !usedWerewolfIds.has(p.id)
                );
                if (!playerObj) {
                    usedWerewolfIds.clear();
                    playerObj = window.App.state.players.find(p => p.role === 'werewolf' && p.is_alive);
                }
                if (playerObj) usedWerewolfIds.add(playerObj.id);
            }

            if (!playerObj) {
                console.warn(`[NightAnimation] Player not found: ${action.player}`);
                continue;
            }

            console.log(`[NightAnimation] Processing: ${action.player} (${playerObj.id}) -> ${action.action}`);

            // 解析动作类型
            const actionLower = action.action.toLowerCase();
            let skillType = null;
            let nightClass = null;
            let soundId = null;

            if (actionLower.includes('击杀') || actionLower.includes('杀害') || actionLower.includes('选择击杀')) {
                skillType = 'werewolf';
            } else if (actionLower.includes('查验')) {
                skillType = 'seer';
            } else if (actionLower.includes('投毒') || actionLower.includes('毒杀')) {
                skillType = 'witch-poison';
            } else if (actionLower.includes('救')) {
                skillType = 'witch-heal';
            } else if (actionLower.includes('保护')) {
                skillType = 'guard';
            }

            // 获取技能配置
            if (skillType && SKILL_CONFIG[skillType]) {
                const config = SKILL_CONFIG[skillType];
                nightClass = config.nightClass;
                soundId = config.soundId;
            }

            // BUG 2 修复：跳过 sub_phase 已播放过的音效
            if (soundId && !lastSubPhaseSoundIds.has(soundId)) {
                playSound({ id: soundId });
            } else if (soundId) {
                console.log(`[NightAnimation] Skipping sound ${soundId}, already played by sub_phase`);
            }

            // 提取目标名称
            const targetName = extractTargetFromAction(action.action);

            // 播放动画
            if (skillType && targetName) {
                const targetPlayer = window.App.state.players.find(p => p.name === targetName);
                const actorSeat = document.querySelector(`.seat[data-player-id="${playerObj.id}"]`);
                const targetSeat = targetPlayer ? document.querySelector(`.seat[data-player-id="${targetPlayer.id}"]`) : null;

                console.log(`[NightAnimation] actorSeat: ${actorSeat ? 'found' : 'NOT FOUND'}, targetSeat: ${targetSeat ? 'found' : 'NOT FOUND'}`);

                if (actorSeat && nightClass) actorSeat.classList.add(nightClass);
                // BUG 8 修复：使用 seat-night-target 替代 seat-active
                if (targetSeat) targetSeat.classList.add('seat-night-target');

                if (targetPlayer) {
                    showActionLine(actorSeat, targetSeat, skillType, ACTION_DELAY);
                }
                showActionTooltip(actorSeat, action.action);

                // BUG 10 修复：记录当前动作元素，由下一次循环的 cleanupPrevAction 清理
                prevActorSeat = actorSeat;
                prevActorNightClass = nightClass;
                prevTargetSeat = targetSeat;

                // 播放重度技能特效（如果系统可用）
                if (window.App.skillEffects?.playSkillEffect && targetPlayer) {
                    const effectOptions = {};
                    if (skillType === 'seer') {
                        effectOptions.isWerewolf = targetPlayer.role === 'werewolf';
                    }
                    await window.App.skillEffects.playSkillEffect(skillType, playerObj.id, targetPlayer.id, effectOptions);
                }

                // 女巫救人时，清除目标身上的狼人击杀特效（灰色头像、裂痕覆盖层）
                if (skillType === 'witch-heal' && targetPlayer) {
                    if (typeof window.markPlayerAsAlive === 'function') {
                        window.markPlayerAsAlive(targetName);
                    }
                }

                if (!targetPlayer) {
                    console.warn(`[NightAnimation] Target not found: ${targetName}, action: ${action.action}`);
                }
            } else if (nightClass) {
                const actorSeat = document.querySelector(`.seat[data-player-id="${playerObj.id}"]`);
                if (actorSeat) {
                    actorSeat.classList.add(nightClass);
                    showActionTooltip(actorSeat, action.action);
                    prevActorSeat = actorSeat;
                    prevActorNightClass = nightClass;
                    prevTargetSeat = null;
                }
            }

            await delay(ACTION_DELAY);
        }
    } finally {
        // BUG 3 修复：只有当前动画是最新的才执行清理
        if (myAnimationId === currentNightAnimationId) {
            // 清理最后一个动作的高亮
            cleanupPrevAction();

            if (seatsContainer) seatsContainer.classList.remove('night-mode');

            // BUG 14 修复：统一清理连线容器
            clearActionConnections();

            // BUG 2 修复补充：动画结束后清空音效记录，为下一轮做准备
            lastSubPhaseSoundIds.clear();

            // 最终清理：确保所有座位的高亮状态都被移除，防止残留
            document.querySelectorAll('.seat.seat-active, .seat.seat-night-target').forEach(seat => {
                seat.classList.remove('seat-active', 'seat-night-target');
            });
            document.querySelectorAll('.seat[class*="night-"]').forEach(seat => {
                seat.classList.remove('night-werewolf', 'night-seer', 'night-witch', 'night-guard', 'night-hunter',
                    'night-werewolf-active', 'night-seer-active', 'night-witch-active', 'night-guard-active', 'night-hunter-active');
            });
            console.log(`[NightAnimation] #${myAnimationId} Cleanup complete`);
        }
    }
};

// ==================== 粒子连线动画 ====================

/**
 * 在两个座位之间显示技能连线动画
 * @param {HTMLElement} fromSeat - 发起者座位
 * @param {HTMLElement} toSeat - 目标座位
 * @param {string} lineClass - 连线 CSS 类名
 * @param {number} [duration=2500] - 动画持续时间
 */
const showActionLine = (fromSeat, toSeat, lineClass = '', duration = 2500) => {
    if (!fromSeat || !toSeat) return;

    const container = document.getElementById('action-connections');
    if (!container) return;

    const gameArea = document.querySelector('.game-area');
    if (!gameArea) return;

    // 计算连线位置和角度
    const fromRect = fromSeat.getBoundingClientRect();
    const toRect = toSeat.getBoundingClientRect();
    const areaRect = gameArea.getBoundingClientRect();

    const x1 = fromRect.left + fromRect.width / 2 - areaRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - areaRect.top;
    const x2 = toRect.left + toRect.width / 2 - areaRect.left;
    const y2 = toRect.top + toRect.height / 2 - areaRect.top;

    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

    // 创建连线元素
    const line = document.createElement('div');
    line.className = `action-line ${lineClass}`;
    line.style.left = `${x1}px`;
    line.style.top = `${y1 - 1.5}px`;
    line.style.width = '0px';
    line.style.transform = `rotate(${angle}deg)`;

    container.appendChild(line);

    // 触发动画
    requestAnimationFrame(() => {
        line.style.transition = `width ${duration * 0.4}ms ease-out, opacity 0.3s`;
        line.style.opacity = '1';
        line.style.width = `${length}px`;
    });

    // 创建粒子元素
    const particle = document.createElement('div');
    particle.className = `action-particle ${lineClass}`;
    particle.style.left = `${x1}px`;
    particle.style.top = `${y1 - 4}px`;
    particle.style.setProperty('--tx', `${x2 - x1}px`);
    particle.style.setProperty('--ty', `${y2 - y1}px`);
    particle.style.animation = `particleMove ${duration * 0.5}ms ease-in forwards`;

    container.appendChild(particle);

    // 清理动画元素
    setTimeout(() => {
        line.style.transition = `width ${duration * 0.2}ms ease-in, opacity ${duration * 0.2}ms`;
        line.style.width = '0px';
        line.style.opacity = '0';

        setTimeout(() => {
            if (line.parentNode) line.remove();
            if (particle.parentNode) particle.remove();
        }, duration * 0.2);
    }, duration * 0.6);
};

// ==================== 动作提示框 ====================

/**
 * 在座位上方显示动作提示框
 * BUG 4 修复：添加前先清理同一座位上已有的 tooltip，防止累积叠加
 * @param {HTMLElement} seat - 座位元素
 * @param {string} text - 提示文字
 */
const showActionTooltip = (seat, text) => {
    if (!seat) return;

    // BUG 4 修复：先移除已有的 tooltip，防止累积
    seat.querySelectorAll('.action-tooltip').forEach(t => t.remove());

    const tooltip = document.createElement('div');
    tooltip.className = 'action-tooltip absolute px-2 py-1 rounded text-xs font-gothic whitespace-nowrap z-30';
    tooltip.style.cssText = `
        background: rgba(0,0,0,0.85);
        color: #d4af37;
        border: 1px solid #8b0000;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(-4px);
    `;
    tooltip.textContent = text;

    seat.appendChild(tooltip);
    setTimeout(() => {
        if (tooltip.parentNode) tooltip.remove();
    }, 2500);
};

// ==================== 工具函数 ====================

/**
 * 从动作文本中提取目标玩家名称
 * @param {string} actionText - 动作描述文本
 * @returns {string|null} 目标玩家名称或 null
 */
const extractTargetFromAction = (actionText) => {
    for (const pattern of TARGET_PATTERNS) {
        const match = actionText.match(pattern);
        if (match) {
            let name = match[1].trim();
            name = name.replace(/[：:，。！？、；:]/g, '');
            name = name.replace(/\s*(是狼人|是好人|狼人|好人).*$/g, '');
            return name.trim();
        }
    }
    return null;
};

// ==================== 导出到命名空间 ====================
window.App.animation = {
    SKILL_CONFIG,
    SUB_PHASE_CONFIG,
    ACTION_DELAY,
    shakeElement,
    showEulogyOverlay,
    hideEulogyOverlay,
    playNightActionAnimations,
    playSubPhaseAnimation,
    clearSubPhaseHighlight,
    clearActionConnections,
    showActionLine,
    showActionTooltip,
    extractTargetFromAction
};

// ==================== 向后兼容：保留全局引用 ====================
window.shakeElement = shakeElement;
window.showEulogyOverlay = showEulogyOverlay;
window.hideEulogyOverlay = hideEulogyOverlay;
window.playNightActionAnimations = playNightActionAnimations;
window.playSubPhaseAnimation = playSubPhaseAnimation;
window.extractTargetFromAction = extractTargetFromAction;
window.showActionLine = showActionLine;
window.showActionTooltip = showActionTooltip;
window.clearActionConnections = clearActionConnections;
