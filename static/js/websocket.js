/**
 * websocket.js - WebSocket 连接管理与游戏控制
 *
 * 负责建立和维护与后端的 WebSocket 连接，处理游戏启动/暂停/停止等操作。
 * 包含自动重连、连接状态管理和错误处理机制。
 * 所有功能逻辑保持不变，架构进行优化。
 *
 * @module WebSocket
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== WebSocket 连接状态 ====================
/** @type {WebSocket|null} WebSocket 实例 */
let ws = null;
/** @type {number} 重连尝试次数 */
let reconnectAttempts = 0;
/** @type {boolean} 是否为用户主动关闭 */
let isIntentionalClose = false;

// ==================== 内部辅助函数 ====================

/**
 * 从 localStorage 获取 WebSocket 认证令牌
 * @returns {string} 认证令牌
 * @private
 */
const _getWSAuthToken = () => localStorage.getItem('ws_auth_token') || '';

/**
 * 构建 WebSocket URL
 * @returns {string} 完整的 WebSocket URL
 * @private
 */
const _buildWSUrl = () => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = _getWSAuthToken();
    const baseUrl = `${protocol}//${location.host}/ws`;
    return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
};

/**
 * 关闭现有 WebSocket 连接
 * @private
 */
const _closeExistingConnection = () => {
    if (ws) {
        try {
            // 移除所有事件处理器，防止旧连接触发回调
            ws.onopen = null;
            ws.onmessage = null;
            ws.onclose = null;
            ws.onerror = null;
            ws.close();
        } catch (e) {
            console.warn('[WebSocket] Error closing existing connection:', e);
        }
        ws = null;
    }
};

/**
 * 设置 WebSocket 事件处理器
 * @param {WebSocket} socket - WebSocket 实例
 * @param {Object} handlers - 事件处理器配置
 * @private
 */
const _setupWSHandlers = (socket, handlers = {}) => {
    socket.onopen = () => {
        console.log('[WebSocket] Connected');
        reconnectAttempts = 0;
        if (handlers.onopen) handlers.onopen();
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (handlers.onmessage) {
                handlers.onmessage(data);
            } else {
                enqueueMessage(data);
            }
        } catch (e) {
            console.error('[WebSocket] Failed to parse message:', e);
        }
    };

    socket.onclose = () => {
        console.log('[WebSocket] Disconnected');
        if (handlers.onclose) handlers.onclose();

        // 非主动关闭时尝试重连
        if (!isIntentionalClose && reconnectAttempts < (window.App.config?.WS_CONFIG?.reconnectAttempts || 5)) {
            const delay = (window.App.config?.WS_CONFIG?.reconnectDelay || 1000) * Math.pow(2, reconnectAttempts);
            reconnectAttempts++;
            console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
            setTimeout(connectWS, delay);
        }
    };

    socket.onerror = (e) => {
        console.error('[WebSocket] Error:', e);
        if (handlers.onerror) handlers.onerror(e);
    };
};

// ==================== 连接管理 ====================

/**
 * 建立 WebSocket 连接
 * 关闭任何已有连接后新建
 */
const connectWS = () => {
    _closeExistingConnection();

    const wsUrl = _buildWSUrl();
    console.log('[WebSocket] Connecting to:', wsUrl.split('?')[0] + (_getWSAuthToken() ? '?token=***' : ''));

    isIntentionalClose = false;
    ws = new WebSocket(wsUrl);
    _setupWSHandlers(ws);

    // 同步到全局
    window.ws = ws;
};

/**
 * 发送消息到服务器
 * @param {Object} message - 要发送的消息对象
 * @returns {boolean} 是否发送成功
 */
const sendMessage = (message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
    }
    console.warn('[WebSocket] Cannot send message, connection not open. State:', ws?.readyState);
    return false;
};

/**
 * 检查 WebSocket 是否已连接
 * @returns {boolean}
 */
const isConnected = () => ws?.readyState === WebSocket.OPEN;

// ==================== UI 辅助函数 ====================

/**
 * 清空指定元素的内容
 * @param {string} id - 元素 ID
 */
const clearUI = (id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
};

/**
 * 隐藏指定元素
 * @param {string} id - 元素 ID
 */
const hideUI = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
};

/**
 * 重置游戏相关的 UI 到初始状态
 * @private
 */
const _resetGameUI = () => {
    clearUI('seats-container');
    clearUI('game-log');
    clearUI('speech-log');

    const centerText = document.getElementById('center-text');
    if (centerText) {
        centerText.textContent = '';
        centerText.classList.remove('opacity-100');
    }

    hideUI('speech-area');
    hideUI('voting-area');
};


// ==================== 游戏控制 ====================

/**
 * 开始游戏
 * 重置状态、切换到游戏页面、建立 WebSocket 连接并发送游戏配置
 */
const startGame = async () => {
    console.log('[WebSocket] Starting game...');

    if (window.App.state.isRunning) {
        await stopCurrentGame();
    }

    if (!window.App.providers?.length) {
        showCenterBanner('⚠️ 配置缺失', '请先配置至少一个模型供应商！', '', 3000);
        toggleSettingsModal();
        return;
    }

    if (window.App.messageResumeResolve) {
        window.App.messageResumeResolve();
        window.App.messageResumeResolve = null;
    }
    if (window._messageWaitResolve) {
        window._messageWaitResolve();
        window._messageWaitResolve = null;
    }
    if (window.App.state.speechQueue) {
        window.App.state.speechQueue = [];
    }
    window.App.currentSpeechResolve = null;

    clearTimeouts();

    if (window.voicePlayer) window.voicePlayer.stop();
    stopBGM();
    resetGameState();

    _resetGameUI();

    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.style.display = 'inline-block';
        pauseBtn.innerHTML = '<i class="fa fa-pause"></i> 暂停';
    }

    // 显示过渡动画并切换页面
    showTransitionOverlay(() => {
        homePage?.classList.add('hidden');
        gamePage?.classList.remove('hidden');
    }, '游戏即将开始', 1000);

    const stepEl = document.getElementById('current-step');
    if (stepEl) stepEl.textContent = '准备中';

    // 构建玩家配置
    const configs = buildPlayerConfigs();

    console.log('[WebSocket] Starting game with configs:', configs);

    // 建立 WebSocket 连接
    _closeExistingConnection();
    isIntentionalClose = false;
    ws = new WebSocket(_buildWSUrl());

    _setupWSHandlers(ws, {
        onopen: () => {
            console.log('[WebSocket] Connected, sending start_game');
            ws.send(JSON.stringify({
                type: 'start_game',
                player_count: window.currentGameMode,
                player_configs: configs
            }));
        },
        onerror: (e) => {
            console.error('[WebSocket] Connection error:', e);
            showCenterBanner('⚠️ 连接失败', '连接服务器失败，请确保服务器正在运行（http://localhost:8000）', '', 5000);
        }
    });

    window.ws = ws;
};

/**
 * 构建玩家配置数组
 * 根据当前游戏模式和角色分配生成每个玩家的配置
 * @returns {Array<Object>} 玩家配置数组
 * @private
 */
const buildPlayerConfigs = () => {
    const configs = [];
    const roleList = window.roleDistribution?.[window.currentGameMode] || window.roleDistribution?.[6] || [];

    for (let i = 0; i < window.currentGameMode; i++) {
        const roleName = roleList[i] || 'villager';
        const roleConfig = (window.roles && window.roles[roleName]) || {};

        let providerId = '';
        let modelName = '';

        if (roleConfig.model && roleConfig.model !== 'gpt-3.5-turbo') {
            modelName = roleConfig.model;
            const matchedProvider = window.App.providers.find(p => p.default_model === modelName);
            providerId = matchedProvider?.id || window.App.providers[0]?.id || '';
        } else {
            const firstProvider = window.App.providers[0];
            providerId = firstProvider?.id || '';
            modelName = firstProvider?.default_model || 'gpt-3.5-turbo';
        }

        configs.push({
            name: window.defaultPlayerNames?.[i] || `玩家${i + 1}`,
            role: roleName,
            provider_id: providerId,
            model_name: modelName,
            personality: '',
            use_default_personality: true
        });
    }

    return configs;
};

/**
 * 停止当前游戏
 * 发送停止消息到服务器并清理状态
 */
const stopCurrentGame = async () => {
    console.log('[WebSocket] Stopping current game...');

    window.App.state.isRunning = false;
    window.App.state.isPaused = false;

    if (window.voicePlayer) window.voicePlayer.stop();

    isIntentionalClose = true;

    if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ type: 'stop_game' }));
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
                console.warn('[WebSocket] Send error during stop:', e);
            }
        }
        _closeExistingConnection();
    }

    window.App.queueState.messageQueue = [];
    window.App.queueState.isProcessingMessage = false;
    window.App.messageResumeResolve = null;

    console.log('[WebSocket] Game stopped');
};

/**
 * 切换游戏暂停状态
 * 向服务器发送暂停/恢复消息
 */
const togglePause = () => {
    console.log(`[WebSocket] Toggle pause, current: ${window.App.state.isPaused}`);

    if (!isConnected()) {
        console.warn('[WebSocket] Not connected, cannot toggle pause');
        return;
    }

    if (!window.App.state.isRunning) {
        console.warn('[WebSocket] Game not running, cannot toggle pause');
        return;
    }

    try {
        if (window.App.state.isPaused) {
            sendMessage({ type: 'resume_game' });
            updatePauseButtonUI(false);
        } else {
            sendMessage({ type: 'pause_game' });
            updatePauseButtonUI(true);
        }
    } catch (e) {
        console.error('[WebSocket] Error sending pause/resume:', e);
    }
};

/**
 * 更新暂停按钮 UI
 * @param {boolean} isPaused - 是否暂停
 */
const updatePauseButtonUI = (isPaused) => {
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.innerHTML = isPaused
            ? '<i class="fa fa-play"></i> 继续'
            : '<i class="fa fa-pause"></i> 暂停';
    }
};

/**
 * 返回主页
 * 停止游戏并切换回主页
 */
const returnToHome = () => {
    console.log('[WebSocket] Returning to home...');

    window.App.state.isRunning = false;
    window.App.state.isPaused = false;
    window.App.state.currentPhase = 'waiting';

    if (window.voicePlayer) window.voicePlayer.stop();

    isIntentionalClose = true;
    _closeExistingConnection();

    window.App.queueState.messageQueue = [];
    window.App.queueState.isProcessingMessage = false;
    if (window.App.messageResumeResolve) {
        window.App.messageResumeResolve();
        window.App.messageResumeResolve = null;
    }
    if (window._messageWaitResolve) {
        window._messageWaitResolve();
        window._messageWaitResolve = null;
    }

    gamePage?.classList.add('hidden');
    homePage?.classList.remove('hidden');

    _resetGameUI();

    stopBGM();
    stopLoopingSounds();

    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.innerHTML = '<i class="fa fa-pause"></i> 暂停';
        pauseBtn.style.display = 'none';
    }

    // 重置游戏状态（保留 providers 和 gameConfigs）
    resetGameState();

    const stepEl = document.getElementById('current-step');
    if (stepEl) stepEl.textContent = '准备中';

    setTimeout(playBGM, 500);

    console.log('[WebSocket] Returned to home');
};

// ==================== 导出到命名空间 ====================
window.App.ws = {
    connectWS,
    sendMessage,
    isConnected,
    startGame,
    stopCurrentGame,
    togglePause,
    returnToHome,
    get instance() { return ws; }
};

// ==================== 向后兼容：保留全局引用（推荐使用 window.App.ws.*） ====================
window.ws = ws;
window.connectWS = connectWS;
window.startGame = startGame;
window.stopCurrentGame = stopCurrentGame;
window.togglePause = togglePause;
window.returnToHome = returnToHome;
