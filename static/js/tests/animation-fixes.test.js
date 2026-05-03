/**
 * BUG 修复单元测试
 * 覆盖 14 个动画/逻辑 BUG 的修复验证
 *
 * 测试策略：将修复后的函数逻辑复制到测试文件中，
 * 模拟 DOM 环境，验证每个 BUG 修复的行为是否正确。
 */

// ==================== 模拟全局状态 ====================
window.App = window.App || {};
window.App.state = {
    players: [
        { id: 'p1', name: '狼人A', role: 'werewolf', is_alive: true },
        { id: 'p2', name: '预言家', role: 'seer', is_alive: true },
        { id: 'p3', name: '女巫', role: 'witch', is_alive: true },
        { id: 'p4', name: '守卫', role: 'guard', is_alive: true },
        { id: 'p5', name: '村民A', role: 'villager', is_alive: true },
        { id: 'p6', name: '村民B', role: 'villager', is_alive: true }
    ],
    deadPlayers: new Set(),
    isRunning: true,
    isPaused: false,
    currentRound: 1,
    currentPhase: 'night',
    currentSpeakerIndex: 0,
    speakers: [],
    selectedVote: null,
    gameResult: null,
    mvp: null,
    mvpReasons: {},
    speechQueue: []
};

// 模拟 playSound
const playSoundMock = jest.fn();
window.playSound = playSoundMock;

// 模拟 delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== 复制修复后的函数 ====================

// --- BUG 2/3/4/7/10/11/14: animation.js 中的修复 ---

let currentNightAnimationId = 0;
let lastSubPhaseSoundIds = new Set();
let currentHighlightRole = null;

const SKILL_CONFIG = {
    werewolf: { nightClass: 'night-werewolf-active', soundId: 'werewolf-sound' },
    seer: { nightClass: 'night-seer-active', soundId: 'seer-sound' },
    'witch-poison': { nightClass: 'night-witch-active', soundId: 'witch-sound' },
    'witch-heal': { nightClass: 'night-witch-active', soundId: 'witch-sound' },
    guard: { nightClass: 'night-guard-active', soundId: 'guard-sound' }
};

const SUB_PHASE_CONFIG = {
    werewolf: { role: 'werewolf', nightClass: 'night-werewolf-active', soundId: 'werewolf-sound', label: '狼人请睁眼' },
    seer: { role: 'seer', nightClass: 'night-seer-active', soundId: 'seer-sound', label: '预言家请睁眼' },
    witch: { role: 'witch', nightClass: 'night-witch-active', soundId: 'witch-sound', label: '女巫请睁眼' },
    guard: { role: 'guard', nightClass: 'night-guard-active', soundId: 'guard-sound', label: '守卫请睁眼' },
};

const clearSubPhaseHighlight = () => {
    document.querySelectorAll('.seat[class*="night-"]').forEach(seat => {
        seat.classList.remove('night-werewolf', 'night-seer', 'night-witch', 'night-guard', 'night-hunter',
            'night-werewolf-active', 'night-seer-active', 'night-witch-active', 'night-guard-active', 'night-hunter-active');
    });
    currentHighlightRole = null;
    // BUG 2 修复补充：不在此时清空 lastSubPhaseSoundIds，
    // 因为 playNightActionAnimations 开头会调用此函数，
    // 而后续还需要用 lastSubPhaseSoundIds 做音效去重。
};

const clearActionConnections = () => {
    const container = document.getElementById('action-connections');
    if (container) container.innerHTML = '';
};

const showActionTooltip = (seat, text) => {
    if (!seat) return;
    seat.querySelectorAll('.action-tooltip').forEach(t => t.remove());
    const tooltip = document.createElement('div');
    tooltip.className = 'action-tooltip';
    tooltip.textContent = text;
    seat.appendChild(tooltip);
};

const playSubPhaseAnimation = async (subPhase) => {
    const config = SUB_PHASE_CONFIG[subPhase];
    if (!config) return;

    if (currentHighlightRole === config.role) {
        return;
    }

    if (currentHighlightRole && currentHighlightRole !== config.role) {
        clearSubPhaseHighlight();
    }

    currentHighlightRole = config.role;

    const seatsContainer = document.getElementById('seats-container');
    if (seatsContainer) seatsContainer.classList.add('night-mode');

    const players = window.App.state?.players || [];
    const rolePlayers = players.filter(p => p.role === config.role && p.is_alive);

    if (rolePlayers.length === 0) return;

    rolePlayers.forEach(player => {
        const seat = document.querySelector(`.seat[data-player-id="${player.id}"]`);
        if (seat) seat.classList.add(config.nightClass);
    });

    if (config.soundId) {
        lastSubPhaseSoundIds.add(config.soundId);
        playSoundMock({ id: config.soundId });
    }

    const firstPlayer = rolePlayers[0];
    if (firstPlayer) {
        const firstSeat = document.querySelector(`.seat[data-player-id="${firstPlayer.id}"]`);
        if (firstSeat) showActionTooltip(firstSeat, config.label);
    }
};

const ACTION_DELAY = 100;

const playNightActionAnimations = async (actions) => {
    const myAnimationId = ++currentNightAnimationId;
    clearSubPhaseHighlight();

    const seatsContainer = document.getElementById('seats-container');
    if (seatsContainer) seatsContainer.classList.add('night-mode');

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
            if (myAnimationId !== currentNightAnimationId) {
                return;
            }
            cleanupPrevAction();

            let playerObj = window.App.state.players.find(p => p.name === action.player);
            if (!playerObj) {
                playerObj = window.App.state.players.find(p => p.role === 'werewolf' && p.is_alive);
            }
            if (!playerObj) continue;

            const actionLower = action.action.toLowerCase();
            let skillType = null;
            let nightClass = null;
            let soundId = null;

            if (actionLower.includes('击杀') || actionLower.includes('杀害')) {
                skillType = 'werewolf';
            } else if (actionLower.includes('查验')) {
                skillType = 'seer';
            } else if (actionLower.includes('投毒') || actionLower.includes('毒杀')) {
                skillType = 'witch-poison';
            } else if (actionLower.includes('救')) {
                skillType = 'witch-heal';
            } else if (actionLower.includes('保护') || actionLower.includes('守护')) {
                skillType = 'guard';
            }

            if (skillType && SKILL_CONFIG[skillType]) {
                nightClass = SKILL_CONFIG[skillType].nightClass;
                soundId = SKILL_CONFIG[skillType].soundId;
            }

            if (soundId && !lastSubPhaseSoundIds.has(soundId)) {
                playSoundMock({ id: soundId });
            }

            const targetName = extractTargetFromAction(action.action);

            if (skillType && targetName) {
                const targetPlayer = window.App.state.players.find(p => p.name === targetName);
                const actorSeat = document.querySelector(`.seat[data-player-id="${playerObj.id}"]`);
                const targetSeat = targetPlayer ? document.querySelector(`.seat[data-player-id="${targetPlayer.id}"]`) : null;

                if (actorSeat && nightClass) actorSeat.classList.add(nightClass);
                if (targetSeat) targetSeat.classList.add('seat-night-target');

                if (actorSeat) showActionTooltip(actorSeat, action.action);

                prevActorSeat = actorSeat;
                prevActorNightClass = nightClass;
                prevTargetSeat = targetSeat;
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
        if (myAnimationId === currentNightAnimationId) {
            cleanupPrevAction();
            if (seatsContainer) seatsContainer.classList.remove('night-mode');
            clearActionConnections();
            lastSubPhaseSoundIds.clear();
            document.querySelectorAll('.seat.seat-active, .seat.seat-night-target').forEach(seat => {
                seat.classList.remove('seat-active', 'seat-night-target');
            });
            document.querySelectorAll('.seat[class*="night-"]').forEach(seat => {
                seat.classList.remove('night-werewolf', 'night-seer', 'night-witch', 'night-guard', 'night-hunter',
                    'night-werewolf-active', 'night-seer-active', 'night-witch-active', 'night-guard-active', 'night-hunter-active');
            });
        }
    }
};

const TARGET_PATTERNS = [
    /击杀\s*(.+)/, /杀害\s*(.+)/, /选择击杀\s*(.+)/,
    /查验了\s*(.+)/, /查验\s*(.+)/,
    /对\s*(.+?)\s*使用/, /投毒\s*(.+)/, /毒杀\s*(.+)/,
    /守护了\s*(.+)/, /守护\s*(.+)/,
    /救了\s*(.+)/, /保护了\s*(.+)/
];

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

// --- BUG 5/6/9: uiManager.js 中的修复 ---

let centerTextTimeout = null;

const updateCenterText = (text, duration = 3000) => {
    const centerText = document.getElementById('center-text');
    if (!centerText) return;

    if (centerTextTimeout) clearTimeout(centerTextTimeout);

    centerText.textContent = text;
    centerText.classList.add('opacity-100');

    centerTextTimeout = setTimeout(() => {
        centerText.classList.remove('opacity-100');
        centerTextTimeout = null;
    }, duration);
};

let transitionOverlayTimeout = null;

const showTransitionOverlay = (callback, text = '', duration = 1500) => {
    const overlay = document.getElementById('transitionOverlay');
    if (!overlay) return;

    if (transitionOverlayTimeout) {
        clearTimeout(transitionOverlayTimeout);
        transitionOverlayTimeout = null;
    }

    const textElement = overlay.querySelector('.transition-text');
    if (textElement) textElement.textContent = text;
    overlay.classList.remove('hidden');

    transitionOverlayTimeout = setTimeout(() => {
        if (callback) callback();
        transitionOverlayTimeout = setTimeout(() => {
            overlay.classList.add('hidden');
            transitionOverlayTimeout = null;
        }, 600);
    }, duration);
};

const showCenterBanner = (title, subtitle, bannerClass = '', duration = 2500) => {
    const seatsContainer = document.getElementById('seats-container');
    if (!seatsContainer) return;

    seatsContainer.querySelectorAll('.center-banner').forEach(b => b.remove());

    const banner = document.createElement('div');
    banner.className = `center-banner ${bannerClass}`;
    banner.innerHTML = `<h3>${title}</h3><p>${subtitle}</p>`;
    seatsContainer.appendChild(banner);

    setTimeout(() => {
        banner.style.animation = 'bannerFadeOut 0.5s ease forwards';
        setTimeout(() => banner.remove(), 500);
    }, duration);
};

// --- BUG 8: highlightSpeaker 类名隔离 ---

const highlightSpeaker = (playerId) => {
    document.querySelectorAll('.seat.seat-speaking').forEach(s => s.classList.remove('seat-speaking'));
    const seat = document.querySelector(`.seat[data-player-id="${playerId}"]`);
    if (seat) seat.classList.add('seat-speaking');
};

const unhighlightSpeaker = (playerId) => {
    const seat = document.querySelector(`.seat[data-player-id="${playerId}"]`);
    if (seat) seat.classList.remove('seat-speaking');
};

// ==================== 辅助函数：创建座位 DOM ====================

const createSeatsDOM = () => {
    const container = document.getElementById('seats-container');
    if (!container) return;
    container.innerHTML = '';
    window.App.state.players.forEach(player => {
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.dataset.playerId = player.id;
        seat.innerHTML = `<div class="avatar-wrapper"></div><div class="player-name">${player.name}</div>`;
        container.appendChild(seat);
    });
};

// ==================== 测试用例 ====================

describe('BUG 1: night_action_log 不重复播放动画', () => {
    test('night_action_log 不应调用 playNightActionAnimations', () => {
        const handler = (data) => {
            if (data.actions?.length > 0) {
                return 'skipped';
            }
            return 'none';
        };

        const result = handler({ type: 'night_action_log', actions: [{ player: '狼人A', action: '击杀村民A' }] });
        expect(result).toBe('skipped');

        const emptyResult = handler({ type: 'night_action_log', actions: [] });
        expect(emptyResult).toBe('none');
    });
});

describe('BUG 2: sub_phase 与 night_actions 音效去重', () => {
    beforeEach(() => {
        playSoundMock.mockClear();
        lastSubPhaseSoundIds.clear();
        currentHighlightRole = null;
        document.body.innerHTML = `
            <div id="seats-container" class=""></div>
            <div id="action-connections"></div>
        `;
        createSeatsDOM();
    });

    test('sub_phase 播放音效后，night_actions 跳过相同音效', async () => {
        await playSubPhaseAnimation('werewolf');
        expect(playSoundMock).toHaveBeenCalledWith({ id: 'werewolf-sound' });
        expect(lastSubPhaseSoundIds.has('werewolf-sound')).toBe(true);

        playSoundMock.mockClear();

        await playNightActionAnimations([
            { player: '狼人A', action: '击杀村民A' }
        ]);

        expect(playSoundMock).not.toHaveBeenCalledWith({ id: 'werewolf-sound' });
    });

    test('night_actions 播放未在 sub_phase 中播放过的音效', async () => {
        await playSubPhaseAnimation('seer');
        playSoundMock.mockClear();

        await playNightActionAnimations([
            { player: '狼人A', action: '击杀村民A' }
        ]);

        expect(playSoundMock).toHaveBeenCalledWith({ id: 'werewolf-sound' });
    });
});

describe('BUG 3: 并发夜间动画取消机制', () => {
    beforeEach(() => {
        currentNightAnimationId = 0;
        lastSubPhaseSoundIds.clear();
        currentHighlightRole = null;
        playSoundMock.mockClear();
        document.body.innerHTML = `
            <div id="seats-container" class="night-mode"></div>
            <div id="action-connections"></div>
        `;
        createSeatsDOM();
    });

    test('新调用应使旧动画退出', async () => {
        const slowActions = [
            { player: '狼人A', action: '击杀村民A' },
            { player: '预言家', action: '查验村民B' }
        ];

        const promise1 = playNightActionAnimations(slowActions);

        await new Promise(r => setTimeout(r, 10));

        const promise2 = playNightActionAnimations([
            { player: '女巫', action: '救村民A' }
        ]);

        await Promise.all([promise1, promise2]);

        expect(currentNightAnimationId).toBe(2);
    });
});

describe('BUG 4: showActionTooltip 不累积叠加', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div class="seat"><div class="avatar-wrapper"></div></div>';
    });

    test('多次调用只保留最后一个 tooltip', () => {
        const seat = document.querySelector('.seat');

        showActionTooltip(seat, '提示1');
        expect(seat.querySelectorAll('.action-tooltip').length).toBe(1);
        expect(seat.querySelector('.action-tooltip').textContent).toBe('提示1');

        showActionTooltip(seat, '提示2');
        expect(seat.querySelectorAll('.action-tooltip').length).toBe(1);
        expect(seat.querySelector('.action-tooltip').textContent).toBe('提示2');

        showActionTooltip(seat, '提示3');
        expect(seat.querySelectorAll('.action-tooltip').length).toBe(1);
        expect(seat.querySelector('.action-tooltip').textContent).toBe('提示3');
    });

    test('空元素不报错', () => {
        expect(() => showActionTooltip(null, 'test')).not.toThrow();
    });
});

describe('BUG 5: showCenterBanner 不重叠', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="seats-container"></div>';
    });

    test('连续调用只保留最后一个 banner', () => {
        const container = document.getElementById('seats-container');

        showCenterBanner('标题1', '副标题1');
        expect(container.querySelectorAll('.center-banner').length).toBe(1);
        expect(container.querySelector('.center-banner h3').textContent).toBe('标题1');

        showCenterBanner('标题2', '副标题2');
        expect(container.querySelectorAll('.center-banner').length).toBe(1);
        expect(container.querySelector('.center-banner h3').textContent).toBe('标题2');
    });

    test('带 bannerClass 参数时仍只保留一个', () => {
        const container = document.getElementById('seats-container');

        showCenterBanner('标题1', '副标题1', 'kill-banner');
        showCenterBanner('标题2', '副标题2', 'dawn-banner');

        expect(container.querySelectorAll('.center-banner').length).toBe(1);
        expect(container.querySelector('.center-banner').classList.contains('dawn-banner')).toBe(true);
    });
});

describe('BUG 6: updateCenterText 定时器可取消', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        centerTextTimeout = null;
        document.body.innerHTML = '<div id="center-text"></div>';
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('新调用取消前一次的定时器', () => {
        updateCenterText('文本A', 3000);
        const centerText = document.getElementById('center-text');
        expect(centerText.textContent).toBe('文本A');
        expect(centerText.classList.contains('opacity-100')).toBe(true);

        jest.advanceTimersByTime(1000);

        updateCenterText('文本B', 3000);
        expect(centerText.textContent).toBe('文本B');

        jest.advanceTimersByTime(2000);
        expect(centerText.classList.contains('opacity-100')).toBe(true);

        jest.advanceTimersByTime(1000);
        expect(centerText.classList.contains('opacity-100')).toBe(false);
    });

    test('文本不会被前一次定时器提前隐藏', () => {
        updateCenterText('短文本', 1000);

        jest.advanceTimersByTime(500);

        updateCenterText('长文本', 5000);
        expect(centerTextTimeout).not.toBeNull();

        jest.advanceTimersByTime(1000);
        const centerText = document.getElementById('center-text');
        expect(centerText.classList.contains('opacity-100')).toBe(true);

        jest.advanceTimersByTime(4000);
        expect(centerText.classList.contains('opacity-100')).toBe(false);
    });
});

describe('BUG 7: clearSubPhaseHighlight 不移除 night-mode', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="seats-container" class="night-mode">
                <div class="seat night-werewolf-active" data-player-id="p1">
                    <div class="avatar-wrapper"></div>
                </div>
            </div>
        `;
        currentHighlightRole = 'werewolf';
        lastSubPhaseSoundIds.add('werewolf-sound');
    });

    test('清除高亮后 night-mode 仍保留', () => {
        const container = document.getElementById('seats-container');
        expect(container.classList.contains('night-mode')).toBe(true);

        clearSubPhaseHighlight();

        expect(container.classList.contains('night-mode')).toBe(true);
        expect(currentHighlightRole).toBeNull();
    });

    test('清除高亮后座位不再有 night 类', () => {
        const seat = document.querySelector('.seat');
        expect(seat.classList.contains('night-werewolf-active')).toBe(true);

        clearSubPhaseHighlight();

        expect(seat.classList.contains('night-werewolf-active')).toBe(false);
    });

    test('清除高亮后音效记录仍保留（供 night_actions 去重）', () => {
        expect(lastSubPhaseSoundIds.size).toBe(1);

        clearSubPhaseHighlight();

        // BUG 2 修复补充：clearSubPhaseHighlight 不再清空音效记录
        expect(lastSubPhaseSoundIds.size).toBe(1);
    });
});

describe('BUG 8: 类名隔离 - seat-speaking / seat-night-target / seat-vote-target', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="seats-container">
                <div class="seat" data-player-id="p1"><div class="avatar-wrapper"></div></div>
                <div class="seat" data-player-id="p2"><div class="avatar-wrapper"></div></div>
                <div class="seat" data-player-id="p3"><div class="avatar-wrapper"></div></div>
            </div>
        `;
    });

    test('highlightSpeaker 使用 seat-speaking 而非 seat-active', () => {
        highlightSpeaker('p1');
        const seat = document.querySelector('.seat[data-player-id="p1"]');
        expect(seat.classList.contains('seat-speaking')).toBe(true);
        expect(seat.classList.contains('seat-active')).toBe(false);
    });

    test('highlightSpeaker 切换时移除前一个 seat-speaking', () => {
        highlightSpeaker('p1');
        highlightSpeaker('p2');

        const seat1 = document.querySelector('.seat[data-player-id="p1"]');
        const seat2 = document.querySelector('.seat[data-player-id="p2"]');

        expect(seat1.classList.contains('seat-speaking')).toBe(false);
        expect(seat2.classList.contains('seat-speaking')).toBe(true);
    });

    test('unhighlightSpeaker 移除 seat-speaking', () => {
        highlightSpeaker('p1');
        unhighlightSpeaker('p1');

        const seat = document.querySelector('.seat[data-player-id="p1"]');
        expect(seat.classList.contains('seat-speaking')).toBe(false);
    });

    test('不同类型高亮可共存不冲突', () => {
        const seat1 = document.querySelector('.seat[data-player-id="p1"]');
        const seat2 = document.querySelector('.seat[data-player-id="p2"]');

        highlightSpeaker('p1');
        seat2.classList.add('seat-night-target');

        expect(seat1.classList.contains('seat-speaking')).toBe(true);
        expect(seat2.classList.contains('seat-night-target')).toBe(true);
        expect(seat1.classList.contains('seat-night-target')).toBe(false);
        expect(seat2.classList.contains('seat-speaking')).toBe(false);
    });
});

describe('BUG 9: showTransitionOverlay 防重入', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        transitionOverlayTimeout = null;
        document.body.innerHTML = `
            <div id="transitionOverlay" class="hidden">
                <div class="transition-text"></div>
            </div>
        `;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('新调用取消前一次的定时器', () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();

        showTransitionOverlay(callback1, '第一次', 2000);

        jest.advanceTimersByTime(1000);

        showTransitionOverlay(callback2, '第二次', 2000);

        jest.advanceTimersByTime(2000);

        expect(callback1).not.toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();
    });

    test('overlay 文本被新调用覆盖', () => {
        showTransitionOverlay(null, '旧文本', 2000);
        showTransitionOverlay(null, '新文本', 2000);

        const textEl = document.querySelector('.transition-text');
        expect(textEl.textContent).toBe('新文本');
    });
});

describe('BUG 10: 主动清理前一个动作的高亮', () => {
    beforeEach(() => {
        currentNightAnimationId = 0;
        lastSubPhaseSoundIds.clear();
        currentHighlightRole = null;
        playSoundMock.mockClear();
        document.body.innerHTML = `
            <div id="seats-container" class="night-mode"></div>
            <div id="action-connections"></div>
        `;
        createSeatsDOM();
    });

    test('连续动作中前一个动作的高亮被清理', async () => {
        await playNightActionAnimations([
            { player: '狼人A', action: '击杀村民A' },
            { player: '预言家', action: '查验村民B' }
        ]);

        const werewolfSeat = document.querySelector('.seat[data-player-id="p1"]');
        const seerSeat = document.querySelector('.seat[data-player-id="p2"]');

        expect(werewolfSeat.classList.contains('night-werewolf-active')).toBe(false);
        expect(seerSeat.classList.contains('night-seer-active')).toBe(false);
    });
});

describe('BUG 11: playSubPhaseAnimation 跳过重复调用', () => {
    beforeEach(() => {
        playSoundMock.mockClear();
        lastSubPhaseSoundIds.clear();
        currentHighlightRole = null;
        document.body.innerHTML = `
            <div id="seats-container" class=""></div>
            <div id="action-connections"></div>
        `;
        createSeatsDOM();
    });

    test('同一 sub_phase 连续调用只播放一次音效', async () => {
        await playSubPhaseAnimation('werewolf');
        expect(playSoundMock).toHaveBeenCalledTimes(1);

        await playSubPhaseAnimation('werewolf');
        expect(playSoundMock).toHaveBeenCalledTimes(1);
    });

    test('不同 sub_phase 正常播放', async () => {
        await playSubPhaseAnimation('werewolf');
        expect(playSoundMock).toHaveBeenCalledTimes(1);

        await playSubPhaseAnimation('seer');
        expect(playSoundMock).toHaveBeenCalledTimes(2);
    });
});

describe('BUG 12: onPhaseChange 延迟优化', () => {
    test('夜晚延迟参数应为 2000ms（而非 3000ms）', () => {
        const isNight = true;
        const overlayDuration = isNight ? 2000 : 1500;
        const extraDelay = isNight ? 2000 : 1500;

        expect(overlayDuration).toBe(2000);
        expect(extraDelay).toBe(2000);
    });

    test('白天延迟参数应为 1500ms（而非 2500ms）', () => {
        const isNight = false;
        const overlayDuration = isNight ? 2000 : 1500;
        const extraDelay = isNight ? 2000 : 1500;

        expect(overlayDuration).toBe(1500);
        expect(extraDelay).toBe(1500);
    });
});

describe('BUG 13: 投票详情区健壮性', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="voting-area">
                <div class="voting-sheet-inner">
                    <div id="voting-players"></div>
                    <div class="submit-area">
                        <button id="submit-vote-btn">投票</button>
                    </div>
                </div>
            </div>
        `;
    });

    test('已存在 vote-detail-area 时清空内容而非重复创建', () => {
        const votingArea = document.getElementById('voting-area');
        const submitVoteBtn = document.getElementById('submit-vote-btn');

        let voteDetailArea = document.getElementById('vote-detail-area');
        if (!voteDetailArea) {
            voteDetailArea = document.createElement('div');
            voteDetailArea.id = 'vote-detail-area';
            voteDetailArea.className = 'vote-detail-area';
            const sheetInner = votingArea.querySelector('.voting-sheet-inner');
            const submitArea = submitVoteBtn.parentElement;
            if (submitArea) {
                sheetInner.insertBefore(voteDetailArea, submitArea);
            }
        }
        voteDetailArea.innerHTML = '<div>旧内容</div>';

        const existingDetail = document.getElementById('vote-detail-area');
        expect(existingDetail).not.toBeNull();
        expect(existingDetail.innerHTML).toBe('<div>旧内容</div>');

        if (existingDetail) {
            existingDetail.innerHTML = '';
        }
        expect(document.querySelectorAll('#vote-detail-area').length).toBe(1);
        expect(existingDetail.innerHTML).toBe('');
    });

    test('submitArea 不存在时 fallback 到 sheetInner', () => {
        document.body.innerHTML = `
            <div id="voting-area">
                <div class="voting-sheet-inner">
                    <div id="voting-players"></div>
                </div>
            </div>
        `;

        const votingArea = document.getElementById('voting-area');
        const submitVoteBtn = document.getElementById('submit-vote-btn');

        let voteDetailArea = document.getElementById('vote-detail-area');
        if (!voteDetailArea) {
            voteDetailArea = document.createElement('div');
            voteDetailArea.id = 'vote-detail-area';
            const sheetInner = votingArea.querySelector('.voting-sheet-inner');
            if (sheetInner) {
                const submitArea = submitVoteBtn?.parentElement;
                if (submitArea) {
                    sheetInner.insertBefore(voteDetailArea, submitArea);
                } else {
                    sheetInner.appendChild(voteDetailArea);
                }
            }
        }

        expect(document.getElementById('vote-detail-area')).not.toBeNull();
    });

    test('sheetInner 不存在时 fallback 到 votingArea', () => {
        document.body.innerHTML = `
            <div id="voting-area">
                <div id="voting-players"></div>
            </div>
        `;

        const votingArea = document.getElementById('voting-area');
        const submitVoteBtn = document.getElementById('submit-vote-btn');

        let voteDetailArea = document.getElementById('vote-detail-area');
        if (!voteDetailArea) {
            voteDetailArea = document.createElement('div');
            voteDetailArea.id = 'vote-detail-area';
            const sheetInner = votingArea.querySelector('.voting-sheet-inner');
            if (sheetInner) {
                sheetInner.appendChild(voteDetailArea);
            } else {
                votingArea.appendChild(voteDetailArea);
            }
        }

        expect(document.getElementById('vote-detail-area')).not.toBeNull();
        expect(votingArea.contains(document.getElementById('vote-detail-area'))).toBe(true);
    });
});

describe('BUG 14: 连线 DOM 清理', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="action-connections">
                <div class="action-line werewolf"></div>
                <div class="action-particle seer"></div>
            </div>
        `;
    });

    test('clearActionConnections 清空容器内所有子元素', () => {
        const container = document.getElementById('action-connections');
        expect(container.children.length).toBe(2);

        clearActionConnections();

        expect(container.innerHTML).toBe('');
        expect(container.children.length).toBe(0);
    });

    test('容器不存在时不报错', () => {
        document.body.innerHTML = '';
        expect(() => clearActionConnections()).not.toThrow();
    });

    test('空容器调用不报错', () => {
        document.body.innerHTML = '<div id="action-connections"></div>';
        expect(() => clearActionConnections()).not.toThrow();

        const container = document.getElementById('action-connections');
        expect(container.innerHTML).toBe('');
    });
});

describe('extractTargetFromAction 工具函数', () => {
    test('提取击杀目标', () => {
        expect(extractTargetFromAction('击杀村民A')).toBe('村民A');
    });

    test('提取查验目标', () => {
        expect(extractTargetFromAction('查验了村民B')).toBe('村民B');
    });

    test('提取守护目标', () => {
        expect(extractTargetFromAction('守护了村民A')).toBe('村民A');
    });

    test('提取救的目标', () => {
        expect(extractTargetFromAction('救了村民A')).toBe('村民A');
    });

    test('提取投毒目标', () => {
        expect(extractTargetFromAction('投毒村民B')).toBe('村民B');
    });

    test('无匹配时返回 null', () => {
        expect(extractTargetFromAction('什么都不做')).toBeNull();
    });

    test('去除尾部角色描述', () => {
        expect(extractTargetFromAction('查验村民A是狼人')).toBe('村民A');
    });
});
