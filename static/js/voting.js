/**
 * voting.js - 投票逻辑模块
 *
 * 处理投票阶段的全部逻辑，包括投票动画展示、投票结果处理和猎人技能。
 * 支持玩家手动投票和 AI 自动投票动画展示。
 * 投票详情展示每位玩家投给了谁。
 *
 * @module Voting
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 投票开始处理 ====================

/**
 * 处理投票阶段开始消息
 * @param {Object} data - 投票开始数据
 * @returns {Promise<void>}
 */
const onVoteStart = async (data) => {
    updateCenterText('投票环节开始');
    playSound({ id: 'vote-sound' });
    showCenterBanner('投票环节', '请各位玩家投票', 'vote-banner', 2500);

    // 切换到投票场景背景
    if (window.App.sceneBackground?.switchBackgroundForPhase) {
        await window.App.sceneBackground.switchBackgroundForPhase('voting');
    }

    // 播放审判之锤过场动画
    if (window.App.cinematicTransitions?.playJudgmentHammer) {
        await window.App.cinematicTransitions.playJudgmentHammer();
    }

    await delay(2800);
};

// ==================== 投票动画 ====================

/**
 * 处理投票详情消息
 * @param {Object} data - 投票详情数据 { votes: Array<{voter, target}> }
 * @returns {Promise<void>}
 */
const onVoteDetails = async (data) => {
    await playVoteAnimationWithDetails(data.votes);
};

/**
 * 播放投票动画
 * 展示每张投票的投出过程、投票者→目标关系和实时票数统计
 * @param {Array} votes - 投票数组 [{ voter: string, target: string }]
 * @returns {Promise<void>}
 */
const playVoteAnimationWithDetails = async (votes) => {
    if (!votes?.length) {
        console.log('[Voting] No votes to display');
        return;
    }

    // 隐藏发言区，显示投票区
    const speechArea = document.getElementById('speech-area');
    if (speechArea) speechArea.classList.add('hidden');

    const votingArea = document.getElementById('voting-area');
    const votingPlayers = document.getElementById('voting-players');
    const submitVoteBtn = document.getElementById('submit-vote-btn');

    if (!votingArea || !votingPlayers || !submitVoteBtn) {
        console.error('[Voting] Voting elements not found!');
        return;
    }

    votingArea.classList.remove('hidden');
    votingPlayers.innerHTML = '';

    const alivePlayers = window.App.state.players.filter(p => p.is_alive);
    const voteCountMap = {};

    // 渲染可供投票的玩家列表
    alivePlayers.forEach(player => {
        const playerEl = document.createElement('div');
        playerEl.className = 'voting-player flex flex-col items-center cursor-pointer hover:scale-110 transition-transform';
        playerEl.dataset.playerId = player.id;

        // 使用角色图标映射 - 根据角色显示图标
        const roleId = player.role_id || player.role;
        const playerIcon = getRoleIcon(roleId);
        playerEl.innerHTML = `
            <div class="w-12 h-12 rounded-lg overflow-hidden border-2 border-gothic-red">
                <img src="${playerIcon}" alt="${player.name}" class="w-full h-full object-cover">
            </div>
            <div class="text-xs font-gothic mt-1 text-gothic-light text-center">${player.name}</div>
            <div class="vote-count" style="display:none">0</div>
            <div class="vote-detail-list text-xs mt-1 w-full max-w-[80px]"></div>
        `;

        playerEl.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            document.querySelectorAll('.voting-player .w-12').forEach(div => {
                div.classList.remove('border-gothic-gold');
            });
            playerEl.querySelector('.w-12')?.classList.add('border-gothic-gold');
            window.App.state.selectedVote = player.id;
            submitVoteBtn.disabled = false;
        });

        votingPlayers.appendChild(playerEl);
    });

    // BUG 13 修复：更健壮的投票详情区域管理
    // 先清理已有的详情区域内容，无论是否已存在于 DOM 中
    let voteDetailArea = document.getElementById('vote-detail-area');
    if (voteDetailArea) {
        voteDetailArea.innerHTML = '';
    } else {
        voteDetailArea = document.createElement('div');
        voteDetailArea.id = 'vote-detail-area';
        voteDetailArea.className = 'vote-detail-area mt-3 px-4 pb-2';
        const sheetInner = votingArea.querySelector('.voting-sheet-inner');
        if (sheetInner) {
            const submitArea = submitVoteBtn?.parentElement;
            if (submitArea) {
                sheetInner.insertBefore(voteDetailArea, submitArea);
            } else {
                sheetInner.appendChild(voteDetailArea);
            }
        } else {
            votingArea.appendChild(voteDetailArea);
        }
    }

    // 投票由 AI 自动完成
    submitVoteBtn.disabled = true;
    submitVoteBtn.textContent = 'AI 自动投票中...';

    const delayPerVote = 800;

    for (const vote of votes) {
        const voterName = vote.voter;
        const targetName = vote.target;

        voteCountMap[targetName] = (voteCountMap[targetName] || 0) + 1;
        playSound({ id: 'vote-sound' });

        const targetPlayer = window.App.state.players.find(p => p.name === targetName);
        if (targetPlayer) {
            // BUG 8 修复：使用 seat-vote-target 替代 seat-active，避免与其他功能冲突
            const targetSeat = document.querySelector(`.seat[data-player-id="${targetPlayer.id}"]`);
            if (targetSeat) targetSeat.classList.add('seat-vote-target');

            // 更新投票区票数显示
            const targetEl = document.querySelector(`.voting-player[data-player-id="${targetPlayer.id}"]`);
            if (targetEl) {
                const countBadge = targetEl.querySelector('.vote-count');
                if (countBadge) {
                    countBadge.textContent = voteCountMap[targetName];
                    countBadge.style.display = 'flex';
                }

                // 在目标玩家下方添加投票者名字
                const detailList = targetEl.querySelector('.vote-detail-list');
                if (detailList) {
                    const voterTag = document.createElement('div');
                    voterTag.className = 'text-center text-gothic-light/60 truncate';
                    voterTag.textContent = `← ${voterName}`;
                    voterTag.style.animation = 'fadeIn 0.3s ease';
                    detailList.appendChild(voterTag);
                }
            }
        }

        // 高亮投票者的座位
        const voterPlayer = window.App.state.players.find(p => p.name === voterName);
        if (voterPlayer) {
            const voterSeat = document.querySelector(`.seat[data-player-id="${voterPlayer.id}"]`);
            if (voterSeat) {
                voterSeat.classList.add('seat-voting');
                setTimeout(() => {
                    voterSeat.classList.remove('seat-voting');
                }, delayPerVote - 100);
            }
        }

        // 添加投票详情行
        const detailLine = document.createElement('div');
        detailLine.className = 'vote-detail-line flex items-center justify-center gap-2 py-0.5 text-xs';
        detailLine.style.animation = 'fadeIn 0.3s ease';
        detailLine.innerHTML = `
            <span class="text-gray-400">${voterName}</span>
            <span class="text-gothic-red">→</span>
            <span class="text-gold-400">${targetName}</span>
        `;
        voteDetailArea.appendChild(detailLine);

        await delay(delayPerVote);

        // 移除目标座位高亮
        if (targetPlayer) {
            const targetSeat = document.querySelector(`.seat[data-player-id="${targetPlayer.id}"]`);
            if (targetSeat) targetSeat.classList.remove('seat-vote-target');
        }
    }

    await delay(500);
};

// ==================== 投票结果处理 ====================

/**
 * 处理投票结果消息
 * 包括玩家被放逐后的 UI 更新
 * @param {Object} data - 投票结果数据 { eliminated?, message?, votes? }
 * @returns {Promise<void>}
 */
const onVoteResult = async (data) => {
    if (data.eliminated && typeof data.eliminated === 'string' && data.eliminated.trim()) {
        updateCenterText(`${data.eliminated} 被投票放逐`);
        window.App.state.deadPlayers.add(data.eliminated);

        markPlayerAsDead(data.eliminated);
        showCenterBanner('放逐', `${data.eliminated} 被投票放逐`, 'kill-banner', 2500);
        await delay(3000);
    } else {
        const resultMsg = data.message || '平票，无人被放逐';
        updateCenterText(resultMsg);
        showCenterBanner('平票', '无人被放逐', '', 2000);
        await delay(2300);
    }

    // 清理投票详情区域
    const voteDetailArea = document.getElementById('vote-detail-area');
    if (voteDetailArea) voteDetailArea.innerHTML = '';

    // 隐藏投票区
    const votingArea = document.getElementById('voting-area');
    if (votingArea) votingArea.classList.add('hidden');
};

// ==================== 猎人技能处理 ====================

/**
 * 处理猎人开枪结果
 * @param {Object} data - 猎人结果数据 { hunter, target }
 * @returns {Promise<void>}
 */
const onHunterResult = async (data) => {
    window.App.state.deadPlayers.add(data.target);
    markPlayerAsDead(data.target);
    showCenterBanner('猎人开枪', `${data.hunter} → ${data.target}`, 'kill-banner', 2500);
    await delay(2800);
};

// ==================== 辅助函数 ====================

/**
 * 将玩家标记为死亡（更新座位 UI）
 * @param {string} playerName - 玩家名称
 * @private
 */
const markPlayerAsDead = (playerName, animate = false) => {
    const player = window.App.state.players.find(p => p.name === playerName);
    if (!player) return;

    player.is_alive = false;
    const seat = document.querySelector(`.seat[data-player-id="${player.id}"]`);
    if (!seat) return;

    seat.classList.add('seat-dead');
    seat.querySelector('.avatar-wrapper')?.classList.add('grayscale', 'brightness-50');

    const nameEl = seat.querySelector('.player-name');
    if (nameEl) {
        nameEl.style.textDecoration = 'line-through';
        nameEl.style.color = '#666';
    }

    if (animate && typeof shakeElement === 'function') {
        shakeElement(seat, 600);
    }
};

/**
 * 将玩家恢复为存活状态（清除死亡标记和狼人击杀特效）
 * 用于女巫救人、守卫守护等场景
 * @param {string} playerName - 玩家名称
 */
const markPlayerAsAlive = (playerName) => {
    const player = window.App.state.players.find(p => p.name === playerName);
    if (!player) return;

    player.is_alive = true;
    window.App.state.deadPlayers.delete(playerName);

    const seat = document.querySelector(`.seat[data-player-id="${player.id}"]`);
    if (!seat) return;

    seat.classList.remove('seat-dead');

    const avatarWrapper = seat.querySelector('.avatar-wrapper');
    if (avatarWrapper) {
        avatarWrapper.classList.remove('grayscale', 'brightness-50');
        avatarWrapper.style.filter = '';
        avatarWrapper.style.position = '';
        avatarWrapper.querySelectorAll('.crack-overlay').forEach(el => el.remove());
    }

    const nameEl = seat.querySelector('.player-name');
    if (nameEl) {
        nameEl.style.textDecoration = '';
        nameEl.style.color = '';
    }
};

/**
 * 提交玩家的投票选择到服务器
 * 注意：当前版本投票由 AI 自动完成，此函数保留用于未来扩展
 */
const submitVote = () => {
    console.log('[Voting] 当前版本投票由 AI 自动完成，不支持手动投票');
};

// ==================== 导出到命名空间 ====================
window.App.voting = {
    onVoteStart,
    onVoteDetails,
    playVoteAnimationWithDetails,
    onVoteResult,
    onHunterResult,
    submitVote,
    markPlayerAsDead,
    markPlayerAsAlive
};

// ==================== 向后兼容：保留全局引用 ====================
window.onVoteStart = onVoteStart;
window.onVoteDetails = onVoteDetails;
window.playVoteAnimationWithDetails = playVoteAnimationWithDetails;
window.onVoteResult = onVoteResult;
window.onHunterResult = onHunterResult;
window.submitVote = submitVote;
window.markPlayerAsDead = markPlayerAsDead;
window.markPlayerAsAlive = markPlayerAsAlive;
