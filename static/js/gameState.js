/**
 * gameState.js - 全局游戏状态管理
 *
 * 使用 App 命名空间统一管理所有全局状态，避免污染 window 对象。
 * 所有状态通过 window.App 访问，resetGameState 使用 Object.assign 保持引用有效。
 *
 * @module GameState
 */

window.App = window.App || {};

const createInitialState = () => ({
    players: [],
    deadPlayers: new Set(),
    currentPhase: 'waiting',
    currentRound: 0,
    isRunning: false,
    isPaused: false,
    autoPlay: false,
    currentSpeakerIndex: 0,
    speakers: [],
    selectedVote: null,
    gameResult: null,
    mvp: null,
    mvpReasons: {},
    providers: {},
    playerConfigs: [],
    gameConfigs: {},
    speechQueue: []
});

const createInitialQueueState = () => ({
    messageQueue: [],
    isProcessingMessage: false,
});

const createInitialSpeechState = () => ({
    currentSpeechTimeout: null,
    currentTypeWriterTimeout: null,
});

let gameState = createInitialState();
let queueState = createInitialQueueState();
let speechState = createInitialSpeechState();
let providers = [];

const isGameRunning = () => gameState.isRunning;
const isGamePaused = () => gameState.isPaused;
const isAutoPlay = () => gameState.autoPlay;
const getAlivePlayers = () => gameState.players.filter(p => p.is_alive);
const getDeadPlayers = () => gameState.players.filter(p => !p.is_alive);
const isPlayerAlive = (playerName) => !gameState.deadPlayers.has(playerName);

const resetGameState = () => {
    const preservedProviders = gameState.providers;
    const preservedGameConfigs = gameState.gameConfigs;
    const preservedAutoPlay = gameState.autoPlay;

    const fresh = createInitialState();
    Object.assign(gameState, fresh);
    gameState.providers = preservedProviders;
    gameState.gameConfigs = preservedGameConfigs;
    gameState.autoPlay = preservedAutoPlay;

    const freshQueue = createInitialQueueState();
    Object.assign(queueState, freshQueue);

    clearTimeouts();

    console.log('[GameState] Game state reset');
};

const clearTimeouts = () => {
    if (speechState.currentTypeWriterTimeout) {
        clearTimeout(speechState.currentTypeWriterTimeout);
        speechState.currentTypeWriterTimeout = null;
    }
    if (speechState.currentSpeechTimeout) {
        clearTimeout(speechState.currentSpeechTimeout);
        speechState.currentSpeechTimeout = null;
    }
};

const stopCurrentSpeech = () => {
    clearTimeouts();
    if (window.App.currentSpeechResolve) {
        window.App.currentSpeechResolve();
        window.App.currentSpeechResolve = null;
    }
};

window.App.state = gameState;
window.App.queueState = queueState;
window.App.speechState = speechState;
window.App.providers = providers;

window.App.resetGameState = resetGameState;
window.App.clearTimeouts = clearTimeouts;
window.App.stopCurrentSpeech = stopCurrentSpeech;
window.App.isGameRunning = isGameRunning;
window.App.isGamePaused = isGamePaused;
window.App.isAutoPlay = isAutoPlay;
window.App.getAlivePlayers = getAlivePlayers;
window.App.getDeadPlayers = getDeadPlayers;
window.App.isPlayerAlive = isPlayerAlive;

window.App.messageResumeResolve = null;
window.App.currentSpeechResolve = null;
