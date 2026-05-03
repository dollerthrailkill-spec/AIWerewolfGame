/**
 * mvp.js - MVP AI评选与游戏结束模块
 *
 * 处理游戏结束后的 AI 评选 MVP 流程和游戏结果展示。
 * MVP 由所有 AI 玩家投票评选，根据整局表现选出最佳玩家。
 *
 * @module MVP
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 游戏结束处理 ====================

/**
 * 处理游戏结束消息
 * 展示胜利/失败结果，延迟后展示 AI 评选的 MVP
 * @param {Object} data - 游戏结束数据 { winner, players, mvp, mvp_reasons }
 * @returns {Promise<void>}
 */
const onGameOver = async (data) => {
    window.App.state.isRunning = false;
    window.App.state.gameResult = data.winner;

    if (window.voicePlayer) window.voicePlayer.stop();
    stopLoopingSounds();

    await delay(1500);

    const isGoodWin = data.winner === 'good';
    updateCenterText(isGoodWin ? '好人胜利！' : '狼人胜利！');
    playSound({ id: isGoodWin ? 'win-sound' : 'lose-sound' });

    const endScene = isGoodWin ? 'game-end-human' : 'game-end-werewolf';
    if (window.App.sceneBackground?.switchToScene) {
        await window.App.sceneBackground.switchToScene(endScene);
    }

    await delay(2000);

    const mvpPlayer = data.players?.find(p => p.name === data.mvp) || null;
    window.App.state.mvp = mvpPlayer || { name: data.mvp || '', role: 'villager' };
    window.App.state.mvpReasons = data.mvp_reasons || {};

    showGameOverModal();
};

// ==================== 游戏结果展示 ====================

/**
 * 展示游戏结束结果弹窗
 * 包含胜负结果、AI 评选的 MVP 信息和所有玩家的角色揭晓
 */
const showGameOverModal = () => {
    const isGoodWin = window.App.state.gameResult === 'good';
    const titleEl = document.getElementById('game-result-title');
    if (titleEl) titleEl.textContent = isGoodWin ? '好人胜利！' : '狼人胜利！';

    const mvpAvatar = document.getElementById('mvp-avatar');
    const mvpName = document.getElementById('mvp-name');
    const mvpReasonEl = document.getElementById('mvp-reason');
    const mvp = window.App.state.mvp;

    if (mvpAvatar) {
        const roleId = mvp?.role_id || mvp?.role;
        mvpAvatar.src = getRoleIcon(roleId);
    }
    if (mvpName) mvpName.textContent = mvp?.name || '';

    if (mvpReasonEl) {
        const reasons = window.App.state.mvpReasons || {};
        const mvpReason = reasons[mvp?.name] || '';
        if (mvpReason) {
            mvpReasonEl.textContent = mvpReason.length > 100 ? mvpReason.substring(0, 100) + '...' : mvpReason;
            mvpReasonEl.classList.remove('hidden');
        } else {
            mvpReasonEl.classList.add('hidden');
        }
    }

    const finalRoles = document.getElementById('final-roles');
    if (finalRoles) {
        finalRoles.innerHTML = '';

        window.App.state.players.forEach(player => {
            const roleEl = document.createElement('div');
            roleEl.className = 'flex flex-col items-center';

            const roleInfo = getRoleInfo(player.role_id || player.role);
            const isWolf = player.role === 'werewolf';
            const borderColor = isWolf ? 'border-gothic-red' : 'border-gothic-gold';
            const textColor = isWolf ? 'text-gothic-red' : 'text-gothic-gold';
            const roleName = roleInfo?.name || '平民';
            const isMvp = mvp && player.name === mvp.name;

            // 使用角色图标映射 - 根据角色显示图标
            const roleId = player.role_id || player.role;
            const playerIcon = getRoleIcon(roleId);

            roleEl.innerHTML = `
                <div class="w-12 h-12 rounded-lg overflow-hidden border-2 ${isMvp ? 'border-gold-400 ring-2 ring-gold-400/50' : borderColor} ${player.is_alive ? '' : 'opacity-50'}">
                    <img src="${playerIcon}" alt="${player.name}" class="w-full h-full object-cover">
                </div>
                <div class="text-xs font-gothic mt-1 ${isMvp ? 'text-gold-400' : textColor} text-center">${player.name}${isMvp ? ' 👑' : ''}</div>
                <div class="text-xs ${textColor}">${roleName}</div>
            `;

            finalRoles.appendChild(roleEl);
        });
    }

    toggleGameOverModal();
};

// ==================== 导出到命名空间 ====================
window.App.mvp = {
    onGameOver,
    showGameOverModal,
};

// ==================== 向后兼容：保留全局引用 ====================
window.onGameOver = onGameOver;
window.showGameOverModal = showGameOverModal;
