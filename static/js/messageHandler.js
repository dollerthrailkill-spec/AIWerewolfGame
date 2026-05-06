/**
 * messageHandler.js - WebSocket 消息队列处理器
 *
 * 负责接收、排队和处理来自后端的所有 WebSocket 消息。
 * 使用异步队列确保消息按顺序处理，支持暂停/恢复机制。
 * 所有消息类型处理逻辑保持不变，架构进行优化。
 *
 * @module MessageHandler
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 消息队列持久化 ====================
const MAX_PERSISTED_MESSAGES = 50;

/**
 * 将消息队列持久化到 sessionStorage（防止断连丢失）
 */
const persistMessageQueue = () => {
    try {
        const queueToSave = window.App.queueState.messageQueue.slice(0, MAX_PERSISTED_MESSAGES);
        sessionStorage.setItem('werewolf_message_queue', JSON.stringify(queueToSave));
    } catch (e) {
        console.warn('[MessageHandler] Failed to persist queue:', e);
    }
};

/**
 * 从 sessionStorage 恢复消息队列
 */
const restoreMessageQueue = () => {
    try {
        const saved = sessionStorage.getItem('werewolf_message_queue');
        if (saved) {
            const restored = JSON.parse(saved);
            if (Array.isArray(restored) && restored.length > 0) {
                window.App.queueState.messageQueue = [...restored, ...window.App.queueState.messageQueue];
                console.log(`[MessageHandler] Restored ${restored.length} messages from session`);
            }
            sessionStorage.removeItem('werewolf_message_queue');
        }
    } catch (e) {
        console.warn('[MessageHandler] Failed to restore queue:', e);
    }
};

// ==================== 消息处理器映射表 ====================
/** @type {Object<string, Function>} 消息类型到处理函数的映射 */
const MESSAGE_HANDLERS = {};

/**
 * 注册消息处理器
 * @param {string} type - 消息类型
 * @param {Function} handler - 处理函数
 */
const registerHandler = (type, handler) => {
    MESSAGE_HANDLERS[type] = handler;
};

// ==================== 消息队列操作 ====================

/**
 * 将消息加入处理队列
 * 如果当前没有在处理消息，则自动开始处理
 * @param {Object} data - 消息数据对象
 */
const enqueueMessage = (data) => {
    console.log(`[MessageHandler] Enqueue: ${data.type}`);
    window.App.queueState.messageQueue.push(data);
    persistMessageQueue();

    if (!window.App.queueState.isProcessingMessage) {
        processNextMessage();
    }
};

/**
 * 处理队列中的下一条消息
 * 支持暂停等待用户点击"下一步"的机制
 */
const processNextMessage = async () => {
    if (window.App.queueState.messageQueue.length === 0) {
        window.App.queueState.isProcessingMessage = false;
        return;
    }

    if (window.App.messageResumeResolve) {
        const nextMsg = window.App.queueState.messageQueue[0];

        if (!nextMsg?.type) {
            console.error('[MessageHandler] Invalid message in queue:', nextMsg);
            window.App.queueState.messageQueue.shift();
            persistMessageQueue();
            setTimeout(processNextMessage, 0);
            return;
        }

        if (!window.urgentMessageTypes?.includes(nextMsg.type)) {
            console.log('[MessageHandler] Queue paused, waiting for user action');
            await new Promise(resolve => {
                window._messageWaitResolve = resolve;
            });
        } else {
            console.log(`[MessageHandler] Urgent message: ${nextMsg.type}, processing immediately`);
        }
    }

    window.App.queueState.isProcessingMessage = true;
    const data = window.App.queueState.messageQueue.shift();
    persistMessageQueue();

    if (!data?.type) {
        console.error('[MessageHandler] Invalid message data:', data);
        window.App.queueState.isProcessingMessage = false;
        setTimeout(processNextMessage, 0);
        return;
    }

    try {
        await handleGameMessage(data);
    } catch (err) {
        console.error(`[MessageHandler] Error processing ${data.type}:`, err);
    }

    setTimeout(processNextMessage, 0);
};

// ==================== 消息分发处理 ====================

/**
 * 分发并处理单条游戏消息
 * 根据消息类型调用对应的处理函数
 * @param {Object} data - 消息数据
 */
const handleGameMessage = async (data) => {
    const { type } = data;
    console.log(`[MessageHandler] Handling: ${type}`);

    // 优先使用注册的处理器
    if (MESSAGE_HANDLERS[type]) {
        await MESSAGE_HANDLERS[type](data);
        return;
    }

    // 内置消息类型处理
    switch (type) {
        // ----- 游戏生命周期 -----
        case 'game_start':
            await onGameStart(data);
            break;
        case 'phase_change':
            await onPhaseChange(data);
            return; // return 表示需要等待
        case 'game_over':
            await onGameOver(data);
            return;
        case 'game_stopped':
            console.log('[MessageHandler] Game stopped by server');
            window.App.queueState.messageQueue = [];
            window.App.queueState.isProcessingMessage = false;
            break;
        case 'game_paused':
            window.App.state.isPaused = true;
            updatePauseButtonUI(true);
            break;
        case 'game_resumed':
            window.App.state.isPaused = false;
            updatePauseButtonUI(false);
            break;

        // ----- 阶段子消息 -----
        case 'sub_phase':
            updateCenterText(data.message);
            updateGameStep(data.message);
            // 根据子阶段触发对应角色的睁眼动画
            await playSubPhaseAnimation(data.sub_phase);
            break;

        // ----- 夜间行动 -----
        case 'night_actions':
            if (data.actions?.length > 0) {
                await playNightActionAnimations(data.actions);
            }
            return;
        case 'night_action_log':
            // BUG 1 修复：night_action_log 仅做日志记录，不重复播放动画
            // night_actions 已播放过动画，此处避免双重播放
            if (data.actions?.length > 0) {
                console.log('[MessageHandler] night_action_log received (log only, animation skipped):', data.actions);
            }
            break;
        case 'witch_info':
            showCenterBanner('女巫得知', `今晚${data.killed_player}被狼人杀害`, 'kill-banner', 2000);
            break;
        case 'night_result':
            await onNightResult(data);
            return;

        // ----- 白天阶段 -----
        case 'dawn':
            updateCenterText('天亮了...');
            updateGameStep('天亮了');
            break;
        case 'current_speaker':
            await onCurrentSpeaker(data);
            return;
        case 'speech':
            await window.App.speechPlayer.onSpeech(data);
            return;

        // ----- 投票阶段 -----
        case 'vote_start':
            await onVoteStart(data);
            return;
        case 'vote_details':
            await onVoteDetails(data);
            return;
        case 'vote_result':
            await onVoteResult(data);
            return;

        // ----- 猎人技能 -----
        case 'hunter_shoot':
            showCenterBanner('猎人发动技能', data.message, 'kill-banner', 2000);
            break;
        case 'hunter_result':
            await onHunterResult(data);
            return;

        // ----- 遗言阶段 -----
        case 'eulogy_start':
            showEulogyOverlay(data.player || '', data.message || '');
            return;
        case 'eulogy_speech':
            hideEulogyOverlay();
            await window.App.speechPlayer.onSpeech({
                player: data.player,
                player_id: data.player_id,
                content: data.content,
                is_eulogy: true
            });
            return;
        case 'eulogy_end':
            hideEulogyOverlay();
            return;

        // ----- AI 推理 -----
        case 'ai_thinking':
            // 静默处理
            break;
        case 'ai_reasoning':
            addReasoningMessage(data.player, data.reasoning);
            return;

        // ----- 错误处理 -----
        case 'error':
            console.error('[MessageHandler] Server error:', data.message);
            // 使用中心横幅替代 alert，避免阻塞 UI
            showCenterBanner('⚠️ 错误', data.message, 'error-banner', 3000);
            break;

        default:
            console.warn(`[MessageHandler] Unknown message type: ${type}`);
    }
};

// ==================== 辅助函数 ====================

/**
 * 更新暂停按钮的显示状态
 * @param {boolean} isPaused - 是否暂停
 */
/**
 * 添加 AI 推理消息到游戏日志
 * @param {string} player - 玩家名称
 * @param {string} reasoning - 推理内容
 */
const addReasoningMessage = (player, reasoning) => {
    console.log(`[AI推理] ${player}: ${reasoning}`);

    const gameLog = document.getElementById('game-log');
    if (gameLog) {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry text-xs text-gothic-gold opacity-70 mb-1';
        
        const span = document.createElement('span');
        span.className = 'text-gothic-red';
        span.textContent = '[AI推理]';
        logEntry.appendChild(span);
        
        const text = document.createTextNode(` ${player}: ${reasoning}`);
        logEntry.appendChild(text);
        
        gameLog.appendChild(logEntry);
        gameLog.scrollTop = gameLog.scrollHeight;
    }
};

// ==================== 游戏开始处理 ====================

/**
 * 处理游戏开始消息
 * 重置所有游戏状态并渲染初始界面
 * @param {Object} data - 游戏开始数据
 */
const onGameStart = async (data) => {
    console.log('[MessageHandler] Game start');

    window.App.state.players = data.players || [];
    window.App.state.deadPlayers = new Set();
    window.App.state.isRunning = true;
    window.App.state.isPaused = false;
    window.App.state.currentRound = 0;
    window.App.state.currentPhase = 'waiting';
    window.App.state.currentSpeakerIndex = 0;
    window.App.state.speakers = [];
    window.App.state.selectedVote = null;
    window.App.state.gameResult = null;
    window.App.state.mvp = null;
    window.App.state.mvpReasons = {};
    window.App.state.speechQueue = [];

    window.App.queueState.messageQueue = [];
    window.App.queueState.isProcessingMessage = false;
    window.App.messageResumeResolve = null;
    window._messageWaitResolve = null;

    // 清空 UI
    const clearElement = (id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    };

    clearElement('seats-container');
    clearElement('game-log');
    clearElement('speech-log');

    const centerText = document.getElementById('center-text');
    if (centerText) {
        centerText.textContent = '';
        centerText.classList.remove('opacity-100');
    }

    const hideElement = (id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    };

    hideElement('speech-area');
    hideElement('voting-area');

    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.innerHTML = '<i class="fa fa-pause"></i> 暂停';
        pauseBtn.style.display = 'inline-block';
    }

    renderSeats();
    updateCenterText('游戏开始');
};

// ==================== 阶段变化处理 ====================

/**
 * 处理昼夜阶段变化
 * @param {Object} data - 阶段变化数据
 */
const onPhaseChange = async (data) => {
    const isNight = data.phase === 'night';
    window.App.state.currentPhase = data.phase;
    window.App.state.currentRound = data.round;

    // BUG 8 修复：清理所有类型的高亮类，防止残留
    document.querySelectorAll('.seat.seat-active, .seat.seat-speaking, .seat.seat-night-target, .seat.seat-vote-target').forEach(seat => {
        seat.classList.remove('seat-active', 'seat-speaking', 'seat-night-target', 'seat-vote-target');
    });

    // BUG 14 修复：阶段切换时清理连线容器
    if (window.clearActionConnections) clearActionConnections();

    stopLoopingSounds();

    const sound = isNight ? nightSound : daySound;
    if (sound) {
        sound.currentTime = 0;
        sound.loop = true;
        sound.volume = 0.3;
        sound.play().catch(e => console.log(`[Audio] ${isNight ? '夜晚' : '白天'}音效播放失败:`, e));
    }

    // 切换场景背景
    const scenePhase = isNight ? 'night-falls' : 'dawn-breaks';
    if (window.App.sceneBackground?.switchBackgroundForPhase) {
        await window.App.sceneBackground.switchBackgroundForPhase(scenePhase);
    }

    // 播放电影感过场动画（替代旧的简单文字切换）
    if (window.App.cinematicTransitions?.playCinematicTransition) {
        await window.App.cinematicTransitions.playCinematicTransition(scenePhase);
    }

    const badge = document.getElementById('current-step');
    if (badge) badge.textContent = isNight ? '夜晚' : '白天';

    const seatsContainer = document.getElementById('seats-container');
    if (seatsContainer) {
        if (isNight) {
            seatsContainer.classList.add('night-mode');
        } else {
            seatsContainer.classList.remove('night-mode');
        }
    }

    // 过场动画后切换到实际游戏阶段背景
    const gamePhase = isNight ? 'night' : 'day';
    if (window.App.sceneBackground?.switchBackgroundForPhase) {
        await window.App.sceneBackground.switchBackgroundForPhase(gamePhase);
    }

    // BUG 12 修复：减少额外延迟，避免阶段切换过于拖沓
    updateGameStep(isNight ? '天黑请闭眼' : '天亮了');
    await delay(isNight ? 2000 : 1500);
};

// ==================== 夜间结果处理 ====================

/**
 * 处理夜间死亡结果
 * @param {Object} data - 夜间结果数据
 */
const onNightResult = async (data) => {
    // BUG 8 修复：清理所有类型的高亮类
    document.querySelectorAll('.seat.seat-active, .seat.seat-speaking, .seat.seat-night-target, .seat.seat-vote-target').forEach(seat => {
        seat.classList.remove('seat-active', 'seat-speaking', 'seat-night-target', 'seat-vote-target');
    });

    // 清除狼人击杀特效：不在 deaths 列表中的玩家应恢复头像
    // （被女巫救了或被守卫守护的玩家，虽然狼人击杀特效已播放，但实际未死亡）
    const deathSet = new Set(data.deaths || []);
    document.querySelectorAll('.seat .avatar-wrapper').forEach(wrapper => {
        const seat = wrapper.closest('.seat');
        if (!seat) return;
        const playerId = seat.dataset.playerId;
        const player = window.App.state.players.find(p => p.id == playerId);
        if (!player) return;

        if (!deathSet.has(player.name)) {
            if (wrapper.style.filter || wrapper.querySelector('.crack-overlay')) {
                wrapper.style.filter = '';
                wrapper.style.position = '';
                wrapper.querySelectorAll('.crack-overlay').forEach(el => el.remove());
            }
        }
    });

    if (data.deaths?.length > 0) {
        updateCenterText(`昨晚 ${data.deaths.join('、')} 死亡`);
        showCenterBanner('昨夜惨案', `${data.deaths.join('、')} 死亡`, 'kill-banner', 3000);

        for (const name of data.deaths) {
            window.App.state.deadPlayers.add(name);
            markPlayerAsDead(name, true);
            await delay(500);
        }
        await delay(1500);
    } else {
        updateCenterText('昨晚是平安夜');
        showCenterBanner('平安夜', '昨晚无人死亡', 'dawn-banner', 2000);
        await delay(2300);
    }
};

// ==================== 当前发言者处理 ====================

/**
 * 处理当前发言者变更
 * @param {Object} data - 发言者数据
 */
const onCurrentSpeaker = async (data) => {
    updateCenterText(data.message);
    highlightSpeaker(data.player_id);
    await delay(800);
};

// ==================== 导出到命名空间 ====================
window.App.messageHandler = {
    registerHandler,
    enqueueMessage,
    processNextMessage,
    handleGameMessage,
    addReasoningMessage
};

// ==================== 向后兼容：保留全局引用（推荐使用 window.App.messageHandler.*） ====================
window.enqueueMessage = enqueueMessage;
window.processNextMessage = processNextMessage;
window.handleGameMessage = handleGameMessage;
window.addReasoningMessage = addReasoningMessage;
window.onGameStart = onGameStart;
window.onPhaseChange = onPhaseChange;
window.onNightResult = onNightResult;
window.onCurrentSpeaker = onCurrentSpeaker;
