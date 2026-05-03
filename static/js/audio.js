/**
 * audio.js - 音频管理模块
 *
 * 管理游戏中的所有音频元素，包括 BGM、环境音效和 Web Audio API 音调。
 * 提供播放、停止和控制接口。
 *
 * @module Audio
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 音频元素引用（懒加载） ====================

/**
 * 获取音频元素（首次访问时从 DOM 查询）
 * @param {string} id - 音频元素 ID
 * @returns {HTMLAudioElement|null}
 */
const getAudio = (id) => {
    const el = document.getElementById(id);
    if (!el) console.warn(`[Audio] Element not found: #${id}`);
    return el;
};

// ==================== 音频元素快捷访问 ====================

// 使用 getter 实现懒加载，避免 DOM 未就绪时为 null
Object.defineProperty(window, 'bgm', { get: () => getAudio('bgm') });
Object.defineProperty(window, 'buttonClickSound', { get: () => getAudio('button-click') });
Object.defineProperty(window, 'seatSound', { get: () => getAudio('seat-sound') });
Object.defineProperty(window, 'nightSound', { get: () => getAudio('night-sound') });
Object.defineProperty(window, 'werewolfSound', { get: () => getAudio('werewolf-sound') });
Object.defineProperty(window, 'seerSound', { get: () => getAudio('seer-sound') });
Object.defineProperty(window, 'witchSound', { get: () => getAudio('witch-sound') });
Object.defineProperty(window, 'daySound', { get: () => getAudio('day-sound') });
Object.defineProperty(window, 'voteSound', { get: () => getAudio('vote-sound') });
Object.defineProperty(window, 'winSound', { get: () => getAudio('win-sound') });
Object.defineProperty(window, 'loseSound', { get: () => getAudio('lose-sound') });
Object.defineProperty(window, 'mvpSound', { get: () => getAudio('mvp-sound') });

// ==================== Web Audio API ====================

/** @type {AudioContext|null} Web Audio API 上下文 */
let audioContext = null;

/**
 * 获取或创建 AudioContext
 * @returns {AudioContext|null}
 */
const getAudioContext = () => {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error('[Audio] Failed to create AudioContext:', e);
        }
    }
    return audioContext;
};

// ==================== 初始化 ====================

/**
 * 初始化所有音频元素
 * 设置错误监听器
 */
const initAudio = () => {
    console.log('[Audio] Initializing audio elements...');

    const audioIds = [
        'bgm', 'button-click', 'seat-sound', 'night-sound',
        'werewolf-sound', 'seer-sound', 'witch-sound', 'guard-sound', 'day-sound',
        'vote-sound', 'win-sound', 'lose-sound', 'mvp-sound'
    ];

    audioIds.forEach(id => {
        const el = getAudio(id);
        if (el) {
            el.addEventListener('error', (e) => {
                console.error(`[Audio] Load error for #${id}:`, e);
            });
        }
    });

    console.log('[Audio] Audio elements initialized');
};

// ==================== BGM 控制 ====================

/**
 * 播放背景音乐
 */
const playBGM = () => {
    const audio = window.bgm;
    if (audio) {
        audio.volume = 0.3;
        audio.loop = true;
        audio.play().catch(e => console.log('[Audio] BGM play failed:', e));
    }
};

/**
 * 停止背景音乐
 */
const stopBGM = () => {
    const audio = window.bgm;
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
};

// ==================== 音效播放 ====================

/**
 * 播放指定音效
 * @param {Object|string} sound - 音频元素或 { id: string }
 */
const playSound = (sound) => {
    const soundId = sound?.id || sound;
    if (!soundId) return;

    const audioElement = getAudio(soundId);
    if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(err => {
            console.warn(`[Audio] Failed to play ${soundId}:`, err);
        });
    } else {
        console.warn(`[Audio] Element not found: ${soundId}`);
    }
};

/**
 * 停止所有循环音效（夜晚/白天环境音）
 */
const stopLoopingSounds = () => {
    const loopingSounds = [window.nightSound, window.daySound];
    loopingSounds.forEach(audio => {
        if (audio) {
            audio.loop = false;
            audio.pause();
        }
    });
};

// ==================== Web Audio API 音调 ====================

/**
 * 使用 Web Audio API 播放简单音调
 * @param {number} frequency - 频率（Hz）
 * @param {number} duration - 持续时间（秒）
 * @param {OscillatorType} [type='sine'] - 波形类型
 */
const playTone = (frequency, duration, type = 'sine') => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);

        console.log(`[Audio] Tone played: ${frequency}Hz, ${duration}s`);
    } catch (e) {
        console.error('[Audio] Web Audio API error:', e);
    }
};

// ==================== 导出到命名空间 ====================
window.App.audio = {
    initAudio,
    playBGM,
    stopBGM,
    playSound,
    playTone,
    stopLoopingSounds,
    getAudioContext,
    get audioCtx() { return audioContext; }
};

// ==================== 向后兼容：保留全局引用 ====================
window.audioContext = audioContext;
window.initAudio = initAudio;
window.playBGM = playBGM;
window.stopBGM = stopBGM;
window.playSound = playSound;
window.playTone = playTone;
window.stopLoopingSounds = stopLoopingSounds;
