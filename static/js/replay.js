/**
 * replay.js - 对局回放模块
 *
 * 记录每局游戏的完整消息流，支持回放和分享。
 * 数据存储在 localStorage 中，最多保留 20 局回放。
 *
 * @module Replay
 */

window.App = window.App || {};

const REPLAYS_KEY = 'aiWerewolfReplays';
const MAX_REPLAYS = 20;

let isRecording = false;
let currentReplay = null;

const startRecording = () => {
    isRecording = true;
    currentReplay = {
        id: `replay_${Date.now()}`,
        timestamp: Date.now(),
        playerCount: window.currentGameMode || 8,
        players: [],
        events: [],
        winner: null,
        mvp: null,
        duration: 0,
        startTime: Date.now()
    };
    console.log('[Replay] Recording started');
};

const recordEvent = (type, data) => {
    if (!isRecording || !currentReplay) return;
    currentReplay.events.push({
        type,
        data: JSON.parse(JSON.stringify(data)),
        timestamp: Date.now() - currentReplay.startTime
    });
};

const stopRecording = (gameResult) => {
    if (!isRecording || !currentReplay) return;
    isRecording = false;
    currentReplay.duration = Date.now() - currentReplay.startTime;

    if (gameResult) {
        currentReplay.winner = gameResult.winner;
        currentReplay.mvp = gameResult.mvp;
        currentReplay.players = gameResult.players || window.App.state.players;
    }

    const replays = loadReplays();
    replays.unshift(currentReplay);
    if (replays.length > MAX_REPLAYS) replays.splice(MAX_REPLAYS);

    try {
        localStorage.setItem(REPLAYS_KEY, JSON.stringify(replays));
        console.log(`[Replay] Saved: ${currentReplay.id}, events: ${currentReplay.events.length}`);
    } catch (e) {
        console.error('[Replay] Failed to save:', e);
    }

    const replayId = currentReplay.id;
    currentReplay = null;
    return replayId;
};

const loadReplays = () => {
    try {
        const saved = localStorage.getItem(REPLAYS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
};

const getReplay = (replayId) => {
    return loadReplays().find(r => r.id === replayId) || null;
};

const deleteReplay = (replayId) => {
    const replays = loadReplays().filter(r => r.id !== replayId);
    localStorage.setItem(REPLAYS_KEY, JSON.stringify(replays));
};

const clearAllReplays = () => {
    localStorage.removeItem(REPLAYS_KEY);
};

const renderReplayList = (container) => {
    if (!container) return;
    const replays = loadReplays();

    if (replays.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-4xl mb-4 opacity-30"></div>
                <p class="text-gray-500 text-sm">暂无对局回放</p>
                <p class="text-gray-600 text-xs mt-1">完成一局游戏后，回放将自动保存</p>
            </div>`;
        return;
    }

    container.innerHTML = '';
    replays.forEach((replay, index) => {
        const date = new Date(replay.timestamp);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        const durMin = Math.floor(replay.duration / 60000);
        const durSec = Math.floor((replay.duration % 60000) / 1000);
        const winnerText = replay.winner === 'good' ? '好人胜利' : '狼人胜利';
        const winnerColor = replay.winner === 'good' ? 'text-gold-400' : 'text-blood-400';

        const item = document.createElement('div');
        item.className = 'replay-item rounded-xl border border-gold-500/10 p-4 mb-3 hover:border-gold-500/25 transition-all cursor-pointer';
        item.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">#${replays.length - index}</span>
                    <span class="text-xs text-gray-400">${replay.playerCount}人局</span>
                </div>
                <span class="text-xs ${winnerColor}">${winnerText}</span>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500">
                <span>${dateStr}</span>
                <span>${durMin}分${durSec}秒 · ${replay.events.length} 事件</span>
            </div>`;
        item.addEventListener('click', () => {
            if (window.App.replayViewer) window.App.replayViewer.openReplay(replay.id);
        });
        container.appendChild(item);
    });
};

window.App.replay = {
    startRecording, recordEvent, stopRecording,
    loadReplays, getReplay, deleteReplay, clearAllReplays,
    renderReplayList,
    get isRecording() { return isRecording; }
};
