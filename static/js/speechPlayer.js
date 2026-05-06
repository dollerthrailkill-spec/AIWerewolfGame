/**
 * speechPlayer.js - 发言管理模块
 *
 * 处理 AI 玩家的发言展示，包括打字机效果、语音播放和发言队列管理。
 * 支持手动模式（用户点击下一步）和自动播放模式。
 * 所有功能逻辑保持不变，架构进行优化。
 *
 * @module SpeechPlayer
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 内部状态 ====================
/** @type {boolean} 标记发言是否被用户跳过 */
let speechSkipped = false;

/** @type {number} 语音播放超时时间（毫秒） */
const VOICE_PLAYBACK_TIMEOUT = 30000;

/**
 * 智能去除图片浅色背景
 * 使用 Canvas 处理像素，将四角颜色相近的浅色背景设为透明
 * @param {HTMLImageElement} img - 要处理的图片元素
 */
const removeLightBackground = (img) => {
    if (!img || !img.src || img.dataset.bgProcessed === 'true') return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    if (canvas.width === 0 || canvas.height === 0) return;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 获取四角的背景色作为参考
    const corners = [
        { x: 0, y: 0 },
        { x: canvas.width - 1, y: 0 },
        { x: 0, y: canvas.height - 1 },
        { x: canvas.width - 1, y: canvas.height - 1 }
    ];

    const bgColors = corners.map(corner => {
        const idx = (corner.y * canvas.width + corner.x) * 4;
        return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
    });

    const avgBgColor = {
        r: Math.round(bgColors.reduce((sum, c) => sum + c.r, 0) / 4),
        g: Math.round(bgColors.reduce((sum, c) => sum + c.g, 0) / 4),
        b: Math.round(bgColors.reduce((sum, c) => sum + c.b, 0) / 4)
    };

    const tolerance = 30;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const brightness = (r + g + b) / 3;
        const colorDiff = Math.abs(r - avgBgColor.r) + Math.abs(g - avgBgColor.g) + Math.abs(b - avgBgColor.b);

        if (colorDiff < tolerance && brightness > 150) {
            data[i + 3] = 0;
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
    const processedUrl = canvas.toDataURL('image/png');
    img.dataset.bgProcessed = 'true';
    img.src = processedUrl;
};

// ==================== 发言处理 ====================

/**
 * 处理玩家发言消息
 * 展示打字机效果、播放语音，管理发言队列
 * @param {Object} data - 发言数据 { player, player_id, content, is_eulogy? }
 * @returns {Promise<void>}
 */
const onSpeech = (data) => new Promise((resolve) => {
    const player = window.App.state.players.find(p => p.name === data.player);
    const roleInfo = getRoleInfo(player?.role_id || player?.role);
    speechSkipped = false;

    const speechArea = document.getElementById('speech-area');
    if (!speechArea) {
        console.error('[SpeechPlayer] Speech area not found!');
        resolve();
        return;
    }

    const isCurrentlyVisible = !speechArea.classList.contains('hidden');

    if (!window.App.state.autoPlay && isCurrentlyVisible) {
        console.log('[SpeechPlayer] Queueing speech for manual mode');
        window.App.state.speechQueue = window.App.state.speechQueue || [];
        window.App.state.speechQueue.push({ data, resolve });
        return;
    }

    speechArea.classList.remove('hidden');

    const speakerSprite = document.getElementById('speaker-sprite');
    const speakerIcon = document.getElementById('speaker-icon');
    const speakerName = document.getElementById('speaker-name');
    const speakerRole = document.getElementById('speaker-role');
    const speakerModel = document.getElementById('speaker-model');
    const speechText = document.getElementById('speech-text');

    if (!speakerSprite || !speakerIcon || !speakerName || !speakerRole || !speakerModel || !speechText) {
        console.error('[SpeechPlayer] Speech elements not found!');
        resolve();
        return;
    }

    const roleId = player?.role_id || player?.role;
    const spriteSrc = getRoleSprite(roleId);
    speakerSprite.src = spriteSrc;
    speakerSprite.onload = () => {
        removeLightBackground(speakerSprite);
    };
    speakerIcon.src = getRoleIcon(roleId);
    speakerName.textContent = data.player;
    speakerRole.textContent = roleInfo?.name || '未知';
    
    // 获取并设置模型名称
    const roleType = player?.role || 'villager';
    const modelName = player?.model || '';
    speakerModel.textContent = modelName ? `[${modelName}]` : '';
    
    speechText.textContent = '';

    window.App.currentSpeechResolve = () => {
        console.log('[SpeechPlayer] Speech skipped by user');
        speechSkipped = true;
        resolve();
    };

    // 获取语音参数
    const voiceType = player && window.roles?.[roleType]?.voice || roleType;

    let voiceIndex = undefined;
    let customPitch = undefined;
    let customRate = undefined;

    if (player && window.roles?.[roleType]) {
        const roleVoice = window.roles[roleType];
        if (roleVoice.voiceIndex !== undefined && roleVoice.voiceIndex >= 0) {
            voiceIndex = roleVoice.voiceIndex;
        }
        if (roleVoice.voicePitch !== undefined) customPitch = roleVoice.voicePitch;
        if (roleVoice.voiceRate !== undefined) customRate = roleVoice.voiceRate;
    }

    // 启动语音播放（带超时保护），检查开关状态
    const voiceEnabled = window.getAudioEnabled ? window.getAudioEnabled('voice') : true;
    const voicePromise = (window.voicePlayer && voiceEnabled)
        ? window.voicePlayer.speak(data.content, voiceType, data.player, voiceIndex, customPitch, customRate)
        : Promise.resolve();
    
    const voiceTimeout = new Promise((resolve) => {
        setTimeout(() => {
            console.warn('[SpeechPlayer] Voice playback timeout');
            resolve();
        }, VOICE_PLAYBACK_TIMEOUT);
    });

    // 启动打字机效果
    let charIndex = 0;
    const text = data.content || '';

    const typeWriter = () => {
        if (charIndex < text.length) {
            speechText.textContent += text.charAt(charIndex);
            charIndex++;
            window.App.speechState.currentTypeWriterTimeout = setTimeout(typeWriter, 50);
        }
    };
    typeWriter();

    // 等待语音播放完成（带超时保护）
    Promise.race([voicePromise, voiceTimeout]).then(() => {
        if (speechSkipped) return;
        console.log('[SpeechPlayer] Voice playback completed');
        handleSpeechCompletion(data, resolve);
    }).catch((error) => {
        if (speechSkipped) return;
        console.error('[SpeechPlayer] Voice error:', error);
        handleSpeechCompletion(data, resolve);
    });
});

/**
 * 处理发言完成后的逻辑
 * 管理发言队列、消息队列恢复等
 * @param {Object} data - 发言数据
 * @param {Function} resolve - Promise resolve 函数
 * @private
 */
const handleSpeechCompletion = (data, resolve) => {
    window.App.currentSpeechResolve = null;
    unhighlightSpeaker(data.player_id);

    const { autoPlay, speechQueue } = window.App.state;

    if (autoPlay && speechQueue?.length > 0) {
        const nextData = speechQueue.shift();
        setTimeout(() => onSpeech(nextData.data).then(nextData.resolve), 500);
        resolve();
        return;
    }

    if (!autoPlay) {
        if (window.App.messageResumeResolve) {
            const oldResolve = window.App.messageResumeResolve;
            window.App.messageResumeResolve = null;
            oldResolve();
        }
        window.App.messageResumeResolve = resolve;
        return;
    }

    resolve();
};

// ==================== 用户操作 ====================

/**
 * 手动进入下一个发言
 * 跳过当前发言，处理队列中的下一条或恢复消息队列
 */
const nextSpeech = () => {
    console.log('[SpeechPlayer] nextSpeech called');

    if (window.App.speechState.currentTypeWriterTimeout) {
        clearTimeout(window.App.speechState.currentTypeWriterTimeout);
        window.App.speechState.currentTypeWriterTimeout = null;
    }
    if (window.App.speechState.currentSpeechTimeout) {
        clearTimeout(window.App.speechState.currentSpeechTimeout);
        window.App.speechState.currentSpeechTimeout = null;
    }

    if (window.voicePlayer) window.voicePlayer.stop();

    if (window.App.currentSpeechResolve) {
        const resolve = window.App.currentSpeechResolve;
        window.App.currentSpeechResolve = null;
        resolve();
    }

    const speechArea = document.getElementById('speech-area');
    if (speechArea) speechArea.classList.add('hidden');

    if (window.App.messageResumeResolve) {
        const resolve = window.App.messageResumeResolve;
        window.App.messageResumeResolve = null;
        resolve();
    }
    if (window._messageWaitResolve) {
        const waitResolve = window._messageWaitResolve;
        window._messageWaitResolve = null;
        waitResolve();
    }

    if (window.App.state.speechQueue?.length > 0) {
        const nextData = window.App.state.speechQueue.shift();
        setTimeout(() => onSpeech(nextData.data).then(nextData.resolve), 100);
        return;
    }

    if (window.App.queueState.messageQueue.length > 0) {
        if (!window.App.queueState.isProcessingMessage) processNextMessage();
        return;
    }

    if (window.speechPhases?.includes(window.App.state.currentPhase)) {
        console.log('[SpeechPlayer] All speeches completed, sending ready_for_next');

        if (isConnected()) {
            sendMessage({ type: 'ready_for_next' });
        } else {
            console.error('[WebSocket] Not connected, cannot send ready_for_next');
            if (!window.ws || window.ws.readyState >= WebSocket.CLOSING) {
                connectWS();
            }
        }
    }
};

/**
 * 切换自动播放模式
 * 开启时自动播放队列中的下一条发言
 */
const toggleAutoPlay = () => {
    window.App.state.autoPlay = !window.App.state.autoPlay;

    const autoPlayBtn = document.getElementById('auto-play-btn');
    if (autoPlayBtn) {
        autoPlayBtn.textContent = window.App.state.autoPlay ? '停止自动播放' : '自动播放';
    }

    console.log(`[SpeechPlayer] AutoPlay: ${window.App.state.autoPlay}`);

    if (window.App.state.autoPlay && window.App.state.speechQueue?.length > 0) {
        const nextData = window.App.state.speechQueue.shift();
        onSpeech(nextData.data).then(nextData.resolve);
    }
};

// ==================== 工具函数 ====================

// isConnected 已在 websocket.js 中定义，此处不再重复声明

// ==================== 导出到命名空间 ====================
window.App.speechPlayer = {
    onSpeech,
    handleSpeechCompletion,
    nextSpeech,
    toggleAutoPlay
};

// ==================== 向后兼容：保留全局引用 ====================
window.onSpeech = onSpeech;
window._handleSpeechCompletion = handleSpeechCompletion;
window.nextSpeech = nextSpeech;
window.toggleAutoPlay = toggleAutoPlay;
