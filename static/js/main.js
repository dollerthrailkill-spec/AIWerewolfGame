/**
 * main.js - 应用主入口
 *
 * 负责在 DOMContentLoaded 事件中初始化所有模块、绑定事件监听器。
 *初始化顺序：
 * 1. UI 管理器
 * 2. 本地存储（角色配置）
 * 3. 音频系统
 * 4. 后端配置（供应商、游戏配置）
 * 5. 事件监听器
 * 6. 角色网格渲染
 * 7. API 配置检查
 *
 * @module Main
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 当前游戏模式 ====================
/** @type {number|null} 当前选择的游戏模式（6/8/10人） */
let currentGameMode = null;

// ==================== 事件监听器初始化 ====================

/**
 * 绑定所有页面事件监听器
 * 包括：按钮点击、模式切换、弹窗操作、表单输入等
 */
const initEventListeners = () => {
    console.log('[Main] Initializing event listeners...');

    // ----- 考试按钮 -----
    bindExamButton();

    // ----- 游戏模式选择 -----
    bindGameModeButtons();

    // ----- 导航按钮 -----
    bindNavigationButtons();

    // ----- 设置弹窗按钮 -----
    bindSettingsButtons();

    // ----- 角色编辑按钮 -----
    bindRoleEditButtons();

    // ----- 头像上传 -----
    bindAvatarUpload();

    // ----- 输入计数器 -----
    bindInputCounters();

    // ----- 游戏内控制按钮 -----
    bindGameControlButtons();

    // ----- 投票和 MVP 按钮 -----
    bindVotingButtons();

    // ----- 弹窗关闭按钮 -----
    bindModalCloseButtons();

    console.log('[Main] Event listeners initialized');
};

// ----- 考试按钮 -----
const bindExamButton = () => {
    const examBtn = document.getElementById('exam-btn');
    if (examBtn) {
        // 克隆以清除旧监听器
        const newBtn = examBtn.cloneNode(true);
        examBtn.parentNode.replaceChild(newBtn, examBtn);

        newBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            setTimeout(() => { window.location.href = '/exam'; }, 100);
        });
    }
};

// ----- 游戏模式选择 -----
const bindGameModeButtons = () => {
    document.querySelectorAll('.game-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playSound({ id: 'button-click' });

            // 清除所有模式按钮的高亮
            document.querySelectorAll('.game-mode-btn').forEach(b => {
                b.classList.remove(
                    'border-gothic-gold', 'bg-gothic-red',
                    'shadow-[0_0_20px_rgba(139,0,0,0.8)]', 'text-gothic-gold'
                );
                b.classList.add('border-gothic-red', 'bg-gothic-gray', 'text-gothic-light');
            });

            // 设置选中模式的高亮
            btn.classList.remove('border-gothic-red', 'bg-gothic-gray', 'text-gothic-light');
            btn.classList.add(
                'border-gothic-gold', 'bg-gothic-red',
                'shadow-[0_0_20px_rgba(139,0,0,0.8)]', 'text-gothic-gold'
            );

            currentGameMode = parseInt(btn.dataset.mode);
            window.currentGameMode = currentGameMode;
            updateStartButtonState();
        });
    });
};

// ----- 导航按钮 -----
const bindNavigationButtons = () => {
    // 设置按钮
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            toggleSettingsModal();
        });
    }

    // 开始游戏按钮
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            playSound({ id: 'button-click' });
            await window.startGame();
        });
    }

    // 退出游戏按钮
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            if (confirm('确定要退出游戏吗？')) window.close();
        });
    }

    // 数据中心按钮
    const dataCenterBtn = document.getElementById('data-center-btn');
    if (dataCenterBtn) {
        dataCenterBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            toggleDataCenterPanel();
        });
    }

    // 成就按钮
    const achievementsBtn = document.getElementById('achievements-btn');
    if (achievementsBtn) {
        achievementsBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            toggleAchievementsPanel();
        });
    }

    // 排行榜按钮
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            toggleLeaderboardPanel();
        });
    }

    // 每日挑战按钮
    const dailyChallengeBtn = document.getElementById('daily-challenge-btn');
    if (dailyChallengeBtn) {
        dailyChallengeBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            toggleDailyChallengePanel();
        });
    }
};

// 初始化音效设置开关状态
const initSoundSettings = () => {
    const bgmToggle = document.getElementById('toggle-bgm');
    const sfxToggle = document.getElementById('toggle-sfx');
    const voiceToggle = document.getElementById('toggle-voice');

    if (window.getAudioEnabled) {
        if (bgmToggle) bgmToggle.checked = window.getAudioEnabled('bgm');
        if (sfxToggle) sfxToggle.checked = window.getAudioEnabled('sfx');
        if (voiceToggle) voiceToggle.checked = window.getAudioEnabled('voice');
    }
};

// ----- 设置弹窗按钮 -----
const bindSettingsButtons = () => {
    // 保存 API 配置
    const saveApiBtn = document.getElementById('save-api-btn');
    if (saveApiBtn) {
        saveApiBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            saveApiConfig();
        });
    }

    // 添加供应商
    const addProviderBtn = document.getElementById('add-provider-btn');
    if (addProviderBtn) {
        addProviderBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            addNewProvider();
        });
    }

    // 音效设置开关
    const bgmToggle = document.getElementById('toggle-bgm');
    if (bgmToggle) {
        bgmToggle.addEventListener('change', () => {
            playSound({ id: 'button-click' });
            if (window.setAudioEnabled) {
                window.setAudioEnabled('bgm', bgmToggle.checked);
            }
        });
    }

    const sfxToggle = document.getElementById('toggle-sfx');
    if (sfxToggle) {
        sfxToggle.addEventListener('change', () => {
            playSound({ id: 'button-click' });
            if (window.setAudioEnabled) {
                window.setAudioEnabled('sfx', sfxToggle.checked);
            }
        });
    }

    const voiceToggle = document.getElementById('toggle-voice');
    if (voiceToggle) {
        voiceToggle.addEventListener('change', () => {
            playSound({ id: 'button-click' });
            if (window.setAudioEnabled) {
                window.setAudioEnabled('voice', voiceToggle.checked);
            }
        });
    }

    // 供应商容器的事件委托
    const providersContainer = document.getElementById('providers-container');
    if (providersContainer) {
        providersContainer.addEventListener('click', (e) => {
            // 删除供应商
            const deleteBtn = e.target.closest('.delete-provider-btn');
            if (deleteBtn) {
                playSound({ id: 'button-click' });
                deleteProvider(deleteBtn.dataset.id);
            }

            // 显示/隐藏 API Key
            const toggleBtn = e.target.closest('.toggle-password-btn');
            if (toggleBtn) {
                e.preventDefault();
                const form = toggleBtn.closest('.provider-form');
                const input = form?.querySelector('.provider-key');
                const icon = toggleBtn.querySelector('i');

                if (input && icon) {
                    const isPassword = input.type === 'password';
                    input.type = isPassword ? 'text' : 'password';
                    icon.classList.toggle('fa-eye', !isPassword);
                    icon.classList.toggle('fa-eye-slash', isPassword);
                }
            }
        });
    }

    // 设置标签页切换
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            const tabId = tab.dataset.tab;

            // 切换标签高亮
            document.querySelectorAll('.settings-tab').forEach(t => {
                t.classList.remove('border-gothic-gold', 'text-gothic-gold');
                t.classList.add('border-transparent', 'text-gothic-light');
            });
            tab.classList.remove('border-transparent', 'text-gothic-light');
            tab.classList.add('border-gothic-gold', 'text-gothic-gold');

            // 切换内容
            document.querySelectorAll('.settings-content').forEach(content => {
                content.classList.add('hidden');
            });

            if (tabId === 'api') {
                document.getElementById('api-config')?.classList.remove('hidden');
            } else if (tabId === 'models') {
                document.getElementById('models-library')?.classList.remove('hidden');
                if (window.App.providers && typeof window.App.providers.renderModelsLibrary === 'function') {
                    window.App.providers.renderModelsLibrary();
                }
            } else if (tabId === 'roles') {
                document.getElementById('roles-management')?.classList.remove('hidden');
                renderRolesGrid();
            } else if (tabId === 'sound') {
                document.getElementById('sound-settings')?.classList.remove('hidden');
            }
        });
    });
};

// ----- 角色编辑按钮 -----
const bindRoleEditButtons = () => {
    const saveRoleBtn = document.getElementById('save-role-btn');
    if (saveRoleBtn) {
        saveRoleBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            saveRoleChanges();
        });
    }

    const previewVoiceBtn = document.getElementById('preview-voice-btn');
    if (previewVoiceBtn) {
        previewVoiceBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            previewRoleVoice();
        });
    }

    const optimizePromptBtn = document.getElementById('optimize-prompt-btn');
    if (optimizePromptBtn) {
        optimizePromptBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            optimizeRolePrompt();
        });
    }
};

// ----- 头像上传 -----
const bindAvatarUpload = () => {
    const avatarUpload = document.getElementById('edit-role-avatar-upload');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const avatar = document.getElementById('edit-role-avatar');
                    if (avatar) avatar.src = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const clearAvatarBtn = document.getElementById('clear-avatar-btn');
    if (clearAvatarBtn) {
        clearAvatarBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            const roleId = document.getElementById('edit-role-id')?.value;
            const avatar = document.getElementById('edit-role-avatar');
            if (roleId && avatar) avatar.src = getDefaultAvatarForRole(roleId);

            const upload = document.getElementById('edit-role-avatar-upload');
            if (upload) upload.value = '';
            clearAvatarBtn.dataset.cleared = 'true';
        });
    }
};

// ----- 输入计数器 -----
const bindInputCounters = () => {
    const personality = document.getElementById('edit-role-personality');
    if (personality) {
        personality.addEventListener('input', function () {
            const count = document.getElementById('personality-count');
            if (count) count.textContent = this.value.length;
        });
    }

    const device = document.getElementById('edit-role-device');
    if (device) {
        device.addEventListener('input', function () {
            const count = document.getElementById('device-count');
            if (count) count.textContent = this.value.length;
        });
    }
};

// ----- 游戏内控制按钮 -----
const bindGameControlButtons = () => {
    // 重新开始
    const restartBtn = document.getElementById('restart-game-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            if (confirm('确定要重新开始游戏吗？')) window.startGame();
        });
    }

    // 返回主页
    const homeBtn = document.getElementById('return-home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            if (confirm('确定要返回主页吗？当前游戏进度将会丢失。')) {
                returnToHome();
            }
        });
    }

    // 暂停
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            togglePause();
        });
    }

    // 游戏结束弹窗按钮
    const gameOverRestart = document.getElementById('game-over-restart-btn');
    if (gameOverRestart) {
        gameOverRestart.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            toggleGameOverModal();
            window.startGame();
        });
    }

    const gameOverHome = document.getElementById('game-over-home-btn');
    if (gameOverHome) {
        gameOverHome.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            toggleGameOverModal();
            returnToHome();
        });
    }

    // 自动播放
    const autoPlayBtn = document.getElementById('auto-play-btn');
    if (autoPlayBtn) {
        autoPlayBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            toggleAutoPlay();
        });
    }

    // 下一位发言
    const nextSpeechBtn = document.getElementById('next-speech-btn');
    if (nextSpeechBtn) {
        nextSpeechBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            nextSpeech();
        });
    }
};

// ----- 投票按钮 -----
const bindVotingButtons = () => {
    const submitVoteBtn = document.getElementById('submit-vote-btn');
    if (submitVoteBtn) {
        submitVoteBtn.addEventListener('click', () => {
            playSound({ id: 'button-click' });
            submitVote();
        });
    }
};

// ----- 弹窗关闭按钮 -----
const bindModalCloseButtons = () => {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.closeModal;
            const modal = document.getElementById(modalId);
            if (modal) modal.classList.add('hidden');
        });
    });
};

// ==================== 新功能面板切换 ====================

const toggleDataCenterPanel = async () => {
    const panel = document.getElementById('data-center-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        // 显示加载状态
        const setLoading = () => {
            ['stat-total-games', 'stat-good-wins', 'stat-wolf-wins', 'stat-win-rate', 'stat-current-streak', 'stat-best-streak']
                .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '...'; });
        };
        setLoading();

        if (window.App.stats) {
            // 并行获取所有数据
            const [summary, mvps, models, history] = await Promise.all([
                window.App.stats.getStatsSummary(),
                window.App.stats.getTopMVPs(5),
                window.App.stats.getTopModels(3, 5),
                window.App.stats.getGameHistory(10),
            ]);

            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val ?? '-';
            };
            setVal('stat-total-games', summary.totalGames);
            setVal('stat-good-wins', summary.goodWins);
            setVal('stat-wolf-wins', summary.wolfWins);
            setVal('stat-win-rate', summary.goodWinRate);
            setVal('stat-current-streak', summary.currentStreak);
            setVal('stat-best-streak', summary.bestStreak);

            // MVP 列表
            const mvpList = document.getElementById('stats-mvp-list');
            if (mvpList) {
                mvpList.innerHTML = mvps.length ? mvps.map((m, i) =>
                    `<div class="flex items-center justify-between py-1.5 border-b border-gold-500/5">
                        <span class="text-sm text-gray-400"><span class="text-gold-400 mr-2">#${i + 1}</span>${m.name}</span>
                        <span class="text-xs text-gold-500">${m.count}次</span>
                    </div>`
                ).join('') : '<p class="text-gray-600 text-sm">暂无数据</p>';
            }

            // 模型列表
            const modelList = document.getElementById('stats-model-list');
            if (modelList) {
                modelList.innerHTML = models.length ? models.map(m =>
                    `<div class="flex items-center justify-between py-1.5 border-b border-gold-500/5">
                        <span class="text-sm text-gray-400">${m.model}</span>
                        <span class="text-xs text-gold-500">${m.winRate} (${m.games}场)</span>
                    </div>`
                ).join('') : '<p class="text-gray-600 text-sm">暂无数据（至少3场）</p>';
            }

            // 历史记录
            const historyList = document.getElementById('stats-history-list');
            if (historyList) {
                historyList.innerHTML = history.length ? history.map(g => {
                    const d = new Date(g.ended_at || g.started_at);
                    const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                    const winner = g.winner === 'good' ? '好人胜' : '狼人胜';
                    return `<div class="flex items-center justify-between py-1.5 border-b border-gold-500/5">
                        <span class="text-sm text-gray-400">${dateStr} · ${g.playerCount}人局 · ${g.round}轮</span>
                        <span class="text-xs ${g.winner === 'good' ? 'text-gold-400' : 'text-blood-400'}">${winner}</span>
                    </div>`;
                }).join('') : '<p class="text-gray-600 text-sm">暂无记录，开始一局游戏吧！</p>';
            }
        }
    }
};

const toggleAchievementsPanel = async () => {
    const panel = document.getElementById('achievements-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden') && window.App.achievements) {
        const list = document.getElementById('achievements-list');
        if (list) list.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">加载中...</p>';

        const [all, stats] = await Promise.all([
            window.App.achievements.getAllAchievements(),
            window.App.achievements.getAchievementStats(),
        ]);

        const totalEl = document.getElementById('achievement-total');
        if (totalEl) totalEl.textContent = stats.total || all.length;
        const countEl = document.getElementById('achievement-count');
        if (countEl) countEl.textContent = stats.unlocked || 0;
        const pointsEl = document.getElementById('achievement-points');
        if (pointsEl) pointsEl.textContent = stats.totalPoints || 0;

        if (list) {
            list.innerHTML = all.map(a => `
                <div class="rounded-xl border p-4 ${a.unlocked ? 'border-gold-500/20 bg-gold-500/5' : 'border-gray-700/30 opacity-50'}">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">${a.icon || '🏆'}</span>
                        <span class="font-cinzel text-sm ${a.unlocked ? 'text-gold-400' : 'text-gray-500'}">${a.name}</span>
                        ${a.points ? `<span class="text-xs text-gold-600 ml-auto">+${a.points}pt</span>` : ''}
                    </div>
                    <p class="text-xs text-gray-500">${a.description}</p>
                    ${a.unlocked ? `<div class="text-xs text-gold-500 mt-1">✓ 已解锁 ${a.unlocked_at ? new Date(a.unlocked_at).toLocaleDateString('zh-CN') : ''}</div>` : '<div class="text-xs text-gray-600 mt-1">🔒 未解锁</div>'}
                </div>
            `).join('');
        }
    }
};

const toggleLeaderboardPanel = async () => {
    const panel = document.getElementById('leaderboard-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');

    // 绑定标签页切换
    panel.querySelectorAll('.leaderboard-tab').forEach(tab => {
        tab.onclick = () => {
            panel.querySelectorAll('.leaderboard-tab').forEach(t => {
                t.classList.remove('border-gold-500/30', 'text-gold-400', 'bg-gold-500/10');
                t.classList.add('border-gray-700', 'text-gray-500');
            });
            tab.classList.remove('border-gray-700', 'text-gray-500');
            tab.classList.add('border-gold-500/30', 'text-gold-400', 'bg-gold-500/10');
            renderLeaderboardTab(tab.dataset.tab);
        };
    });

    await renderLeaderboardTab('mvp');
};

const renderLeaderboardTab = async (tab) => {
    const content = document.getElementById('leaderboard-content');
    if (!content) return;

    content.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">加载中...</p>';

    if (tab === 'mvp') {
        const mvps = await window.App.stats.getTopMVPs(10);
        content.innerHTML = mvps.length ? `
            <div class="space-y-2">
                ${mvps.map((m, i) => `
                    <div class="flex items-center gap-3 p-3 rounded-lg border border-gold-500/10">
                        <span class="font-cinzel text-lg ${i < 3 ? 'text-gold-400' : 'text-gray-500'}">${i + 1}</span>
                        <span class="flex-1 text-gray-300">${m.name}</span>
                        <span class="text-sm text-gold-500">${m.count} 次 MVP</span>
                    </div>
                `).join('')}
            </div>` : '<p class="text-gray-600 text-sm text-center py-8">暂无 MVP 数据，开始一局游戏吧！</p>';
    } else if (tab === 'model') {
        const models = await window.App.stats.getTopModels(3, 10);
        content.innerHTML = models.length ? `
            <div class="space-y-2">
                ${models.map((m, i) => `
                    <div class="flex items-center gap-3 p-3 rounded-lg border border-gold-500/10">
                        <span class="font-cinzel text-lg ${i < 3 ? 'text-gold-400' : 'text-gray-500'}">${i + 1}</span>
                        <span class="flex-1 text-gray-300 text-sm">${m.model}</span>
                        <span class="text-sm text-gold-500">${m.winRate}</span>
                        <span class="text-xs text-gray-500">(${m.games}场)</span>
                    </div>
                `).join('')}
            </div>` : '<p class="text-gray-600 text-sm text-center py-8">暂无模型数据（至少3场）</p>';
    } else if (tab === 'replay') {
        if (window.App.replay) {
            window.App.replay.renderReplayList(content);
        }
    }
};

const toggleDailyChallengePanel = async () => {
    const panel = document.getElementById('daily-challenge-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden') && window.App.dailyChallenge) {
        const list = document.getElementById('daily-challenge-list');
        if (list) {
            list.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">加载中...</p>';
            await window.App.dailyChallenge.renderChallengeList(list);
        }
    }
};

// ==================== API 配置检查 ====================

/**
 * 检查是否有有效的 API 配置
 * 如果没有则弹出配置提示
 */
const checkApiConfig = () => {
    setTimeout(() => {
        try {
            console.log('[Main] 开始检查 API 配置');
            const providers = window.App.providersList || [];
            console.log('[Main] providers 数量:', providers.length);
            
            if (providers.length > 0) {
                const hasValidProvider = providers.some(p => {
                    const hasKey = (p.encrypted_api_key?.trim()) ||
                                   (p.api_key && !p.api_key.includes('*') && p.api_key.trim());
                    const hasUrl = p.api_url?.trim();
                    return hasKey && hasUrl;
                });
                
                if (hasValidProvider) {
                    console.log('[Main] Valid API config found, skipping modal');
                    return;
                }
            }
            
            console.log('[Main] No valid API config, showing setup modal');
            if (typeof toggleApiErrorModal === 'function') {
                toggleApiErrorModal();
            } else {
                console.warn('[Main] toggleApiErrorModal 函数不存在');
            }
        } catch (e) {
            console.error('[Main] checkApiConfig 出错:', e);
        }
    }, 500);
};

// ==================== 应用初始化 ====================

/**
 * 应用初始化入口
 * 按照依赖顺序初始化所有模块
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Main] DOMContentLoaded, starting initialization...');
    
    try {
        console.log('[Main] Step 1: 初始化 UI 管理器');
        // 1. 初始化 UI 管理器
        initUIManager();
        console.log('[Main] Step 1 完成');
        
        console.log('[Main] Step 2: 初始化场景背景系统');
        // 2. 初始化场景背景系统
        if (window.App.sceneBackground?.init) {
            window.App.sceneBackground.init();
            console.log('[Main] Scene background initialized');
        }
        console.log('[Main] Step 2 完成');
        
        console.log('[Main] Step 3: 初始化电影感过场动画系统');
        // 3. 初始化电影感过场动画系统
        if (window.App.cinematicTransitions?.init) {
            window.App.cinematicTransitions.init();
            console.log('[Main] Cinematic transitions initialized');
        }
        console.log('[Main] Step 3 完成');
        
        console.log('[Main] Step 4: 初始化技能特效系统');
        // 4. 初始化技能特效系统
        if (window.App.skillEffects?.init) {
            window.App.skillEffects.init();
            console.log('[Main] Skill effects initialized');
        }
        console.log('[Main] Step 4 完成');
        
        console.log('[Main] Step 5: 加载本地存储的角色配置');
        // 5. 加载本地存储的角色配置
        loadFromLocalStorage();
        console.log('[Main] Step 5 完成');
        
        console.log('[Main] Step 6: 初始化音频系统');
        // 6. 初始化音频系统
        try {
            await initAudio();
            console.log('[Main] Audio initialized');
        } catch (e) {
            console.warn('[Main] Audio init failed:', e);
        }
        console.log('[Main] Step 6 完成');
        
        console.log('[Main] Step 7: 加载后端配置');
        // 7. 加载后端配置
        try {
            await loadProviders();
            await loadGameConfigs();
            console.log('[Main] Providers loaded');
        } catch (e) {
            console.error('[Main] Failed to load providers:', e);
            window.App.providersList = window.App.providersList || [];
        }
        console.log('[Main] Step 7 完成');
        
        console.log('[Main] Step 8: 绑定事件监听器');
        // 8. 绑定事件监听器
        initEventListeners();
        console.log('[Main] Step 8 完成');
        
        console.log('[Main] Step 9: 渲染角色网格');
        // 9. 渲染角色网格
        renderRolesGrid();
        console.log('[Main] Step 9 完成');
        
        console.log('[Main] Step 10: 检查 API 配置');
        // 10. 检查 API 配置
        checkApiConfig();
        console.log('[Main] Step 10 完成');
        
        // 12. 启动回放录制（为当前会话准备）
        if (window.App.replay) {
            // 回放录制将在游戏开始时启动
            console.log('[Main] Replay module available');
        }
        
        console.log('[Main] Initialization complete');
    } catch (err) {
        console.error('[Main] Initialization error:', err);
        console.error('[Main] 错误堆栈:', err.stack);
    }
});

// ==================== 向后兼容：全局导出（推荐使用 window.App.*） ====================
window.currentGameMode = currentGameMode;
window.initEventListeners = initEventListeners;
window.initSoundSettings = initSoundSettings;
window.toggleDataCenterPanel = toggleDataCenterPanel;
window.toggleAchievementsPanel = toggleAchievementsPanel;
window.toggleLeaderboardPanel = toggleLeaderboardPanel;
window.toggleDailyChallengePanel = toggleDailyChallengePanel;

// 向后兼容别名：推荐使用 window.App.ws.*
window.startGame = window.App.ws.startGame;
window.stopCurrentGame = window.App.ws.stopCurrentGame;
window.togglePause = window.App.ws.togglePause;
window.returnToHome = window.App.ws.returnToHome;
window.connectWS = window.App.ws.connectWS;
