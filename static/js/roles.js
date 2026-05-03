/**
 * roles.js - 角色管理模块
 *
 * 管理游戏中的角色配置，包括角色列表渲染、角色编辑、语音试听和提示词优化。
 * 所有功能逻辑保持不变，架构进行优化。
 *
 * @module Roles
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 角色数据存储 ====================
/** @type {Object} 角色配置映射表 */
let roles = { ...(window.defaultRoles || {}) };

// ==================== 角色网格渲染 ====================

/**
 * 渲染角色选择网格
 * 展示所有可配置的角色卡片
 */
const renderRolesGrid = () => {
    const rolesGrid = document.getElementById('roles-grid');
    if (!rolesGrid) return;

    rolesGrid.innerHTML = '';

    Object.entries(roles).forEach(([id, role]) => {
        const roleCard = document.createElement('div');
        roleCard.className = 'bg-gothic-gray border border-gold-500/20 rounded-lg p-4 cursor-pointer hover:border-gold-400 transition-all duration-300 hover:scale-105';
        roleCard.onclick = () => editRole(id);

        const genderText = role.gender === 'male' ? '男' : role.gender === 'female' ? '女' : '未知';
        
        // 使用角色图标映射，默认回退到原有头像
        const roleIcon = getRoleIcon(id) || role.avatar;

        roleCard.innerHTML = `
            <div class="flex flex-col items-center">
                <img src="${roleIcon}" alt="${role.name}" class="w-16 h-16 rounded-lg object-cover mb-2 border border-gothic-gold/30">
                <h3 class="font-gothic text-gothic-gold">${role.name}</h3>
                <p class="text-sm text-gray-400">${genderText}</p>
                <p class="text-xs text-gray-500 mt-1 truncate w-full text-center">${role.personality}</p>
                <p class="text-xs text-gothic-light mt-1">${role.model}</p>
            </div>
        `;

        rolesGrid.appendChild(roleCard);
    });
};

// ==================== 角色编辑 ====================

/**
 * 打开角色编辑弹窗
 * 加载指定角色的当前配置到编辑表单
 * @param {string} roleId - 角色 ID
 */
const editRole = (roleId) => {
    playSound({ id: 'button-click' });
    const role = roles[roleId];

    if (!role) {
        console.error('[Roles] Role not found:', roleId);
        alert('角色不存在');
        return;
    }

    // 获取编辑表单元素
    const {
        'edit-role-id': editRoleId,
        'edit-role-name': editRoleName,
        'edit-role-avatar': editRoleAvatar,
        'edit-role-gender': editRoleGender,
        'edit-role-personality': editRolePersonality,
        'edit-role-device': editRoleDevice,
        'edit-role-voice': editRoleVoice,
        'edit-voice-index': voiceIndexSelect,
        'edit-voice-pitch': voicePitchInput,
        'edit-voice-rate': voiceRateInput,
        'edit-role-model': modelSelect
    } = getEditFormElements();

    // 填充基础字段
    if (editRoleId) editRoleId.value = roleId;
    if (editRoleName) editRoleName.value = role.name;
    if (editRoleAvatar && window.getLogoForModel) {
        editRoleAvatar.src = window.getLogoForModel(role.model);
    }
    if (editRoleGender) editRoleGender.value = role.gender || 'unknown';
    if (editRoleVoice) editRoleVoice.value = role.voice || roleId;

    // 填充性格和设备描述
    const personalityCount = document.getElementById('personality-count');
    const deviceCount = document.getElementById('device-count');

    if (editRolePersonality) {
        editRolePersonality.value = role.personality || '';
        if (personalityCount) personalityCount.textContent = (role.personality || '').length;
    }
    if (editRoleDevice) {
        editRoleDevice.value = role.device || '';
        if (deviceCount) deviceCount.textContent = (role.device || '').length;
    }

    // 填充语音选择
    populateVoiceSelect(voiceIndexSelect, role);

    // 填充音调和语速滑块
    initVoiceSliders(voicePitchInput, voiceRateInput, role);

    // 填充模型选择
    populateModelSelect(modelSelect, role);

    // 清除头像上传状态
    const clearAvatarBtn = document.getElementById('clear-avatar-btn');
    if (clearAvatarBtn) clearAvatarBtn.dataset.cleared = 'false';

    toggleRoleEditModal();
};

/**
 * 获取角色编辑表单的所有元素引用
 * @returns {Object} 表单元素映射
 * @private
 */
const getEditFormElements = () => {
    const ids = [
        'edit-role-id', 'edit-role-name', 'edit-role-avatar', 'edit-role-gender',
        'edit-role-personality', 'edit-role-device', 'edit-role-voice',
        'edit-voice-index', 'edit-voice-pitch', 'edit-voice-rate', 'edit-role-model'
    ];
    const elements = {};
    ids.forEach(id => {
        elements[id] = document.getElementById(id);
    });
    return elements;
};

/**
 * 填充语音选择下拉框
 * @param {HTMLElement} select - 下拉框元素
 * @param {Object} role - 角色配置
 * @private
 */
const populateVoiceSelect = (select, role) => {
    if (!select) return;

    select.innerHTML = '<option value="-1">使用角色音色默认设置</option>';

    if (window.voicePlayer) {
        const availableVoices = window.voicePlayer.getAvailableVoices();
        availableVoices.forEach(voiceInfo => {
            const option = document.createElement('option');
            option.value = voiceInfo.index;
            option.textContent = `[${voiceInfo.index}] ${voiceInfo.name} (${voiceInfo.localService ? '本地' : '网络'})`;
            if (role.voiceIndex === voiceInfo.index) option.selected = true;
            select.appendChild(option);
        });
    }
};

/**
 * 初始化音调和语速滑块
 * @param {HTMLElement} pitchInput - 音调滑块
 * @param {HTMLElement} rateInput - 语速滑块
 * @param {Object} role - 角色配置
 * @private
 */
const initVoiceSliders = (pitchInput, rateInput, role) => {
    const pitchValue = document.getElementById('edit-voice-pitch-value');
    const rateValue = document.getElementById('edit-voice-rate-value');

    if (pitchInput) {
        pitchInput.value = role.voicePitch ?? 1.0;
        if (pitchValue) pitchValue.textContent = pitchInput.value;
        pitchInput.oninput = () => {
            if (pitchValue) pitchValue.textContent = pitchInput.value;
        };
    }

    if (rateInput) {
        rateInput.value = role.voiceRate ?? 1.0;
        if (rateValue) rateValue.textContent = rateInput.value;
        rateInput.oninput = () => {
            if (rateValue) rateValue.textContent = rateInput.value;
        };
    }
};

/**
 * 填充模型选择下拉框
 * @param {HTMLElement} select - 下拉框元素
 * @param {Object} role - 角色配置
 * @private
 */
const populateModelSelect = (select, role) => {
    if (!select) return;

    select.innerHTML = '';

    if (window.App.providersList?.length > 0) {
        window.App.providersList.forEach(provider => {
            const models = provider.used_models || (provider.default_model ? [provider.default_model] : []);

            if (models.length > 0) {
                const optGroup = document.createElement('optgroup');
                optGroup.label = provider.name;

                models.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m;
                    option.textContent = m;
                    if (role.model === m) option.selected = true;
                    optGroup.appendChild(option);
                });

                select.appendChild(optGroup);
            }
        });
    }

    if (select.options.length === 0) {
        const defaultOption = document.createElement('option');
        defaultOption.value = 'gpt-3.5-turbo';
        defaultOption.textContent = '默认模型 - gpt-3.5-turbo';
        defaultOption.selected = true;
        select.appendChild(defaultOption);
    }

    // 模型变更时自动更新头像预览
    select.onchange = () => {
        const editRoleAvatar = document.getElementById('edit-role-avatar');
        if (editRoleAvatar && window.getLogoForModel) {
            editRoleAvatar.src = window.getLogoForModel(select.value);
        }
    };
};

// ==================== 保存和试听 ====================

/**
 * 保存角色配置变更
 */
const saveRoleChanges = () => {
    const roleId = document.getElementById('edit-role-id')?.value;
    const role = roles?.[roleId];
    if (!role) return;

    // 更新角色配置
    role.gender = document.getElementById('edit-role-gender')?.value || role.gender;
    role.personality = document.getElementById('edit-role-personality')?.value || '';
    role.device = document.getElementById('edit-role-device')?.value || '';
    role.model = document.getElementById('edit-role-model')?.value || role.model;
    role.voice = document.getElementById('edit-role-voice')?.value || role.voice;

    // 自动使用模型 logo 作为头像
    if (window.getLogoForModel) {
        role.avatar = window.getLogoForModel(role.model);
    }

    // 保存语音索引
    const voiceIndexValue = document.getElementById('edit-voice-index')?.value;
    const parsedIndex = parseInt(voiceIndexValue, 10);
    role.voiceIndex = isNaN(parsedIndex) ? -1 : parsedIndex;

    // 保存音调和语速
    const pitchInput = document.getElementById('edit-voice-pitch');
    const rateInput = document.getElementById('edit-voice-rate');
    role.voicePitch = pitchInput ? parseFloat(pitchInput.value) : 1.0;
    role.voiceRate = rateInput ? parseFloat(rateInput.value) : 1.0;

    saveToLocalStorage();
    toggleRoleEditModal();
    renderRolesGrid();
};

/**
 * 试听当前角色的语音配置
 */
const previewRoleVoice = () => {
    const roleId = document.getElementById('edit-role-id')?.value;
    const roleName = document.getElementById('edit-role-name')?.value;
    const selectedVoice = document.getElementById('edit-role-voice')?.value;
    const voiceIndexValue = document.getElementById('edit-voice-index')?.value;
    const voiceIndex = parseInt(voiceIndexValue, 10);
    const safeVoiceIndex = isNaN(voiceIndex) ? -1 : voiceIndex;

    const pitchInput = document.getElementById('edit-voice-pitch');
    const rateInput = document.getElementById('edit-voice-rate');
    const customPitch = pitchInput ? parseFloat(pitchInput.value) : 1.0;
    const customRate = rateInput ? parseFloat(rateInput.value) : 1.0;

    if (!window.voicePlayer) {
        alert('语音播放器未初始化，请刷新页面重试');
        return;
    }

    const previewText = `我是${roleName}，这是我的声音试听。在游戏中我会用这个声音发言。`;

    const promise = safeVoiceIndex >= 0
        ? window.voicePlayer.speakWithVoiceIndex(previewText, safeVoiceIndex, roleName, customPitch, customRate)
        : window.voicePlayer.speak(previewText, selectedVoice, roleName, undefined, customPitch, customRate);

    promise.catch(error => {
        console.error('[Roles] Voice preview failed:', error);
        alert('音色试听失败，请检查浏览器是否支持语音合成功能');
    });
};

// ==================== 提示词优化 ====================

/**
 * AI 优化角色提示词
 * 根据角色类型自动填充优化后的性格描述和设备描述
 */
const optimizeRolePrompt = () => {
    const roleId = document.getElementById('edit-role-id')?.value;

    setTimeout(() => {
        const personality = document.getElementById('edit-role-personality');
        const device = document.getElementById('edit-role-device');
        const personalityCount = document.getElementById('personality-count');
        const deviceCount = document.getElementById('device-count');

        if (!personality || !device) return;

        const prompts = getOptimizedPrompts(roleId);
        if (prompts) {
            personality.value = prompts.personality;
            device.value = prompts.device;
            if (personalityCount) personalityCount.textContent = personality.value.length;
            if (deviceCount) deviceCount.textContent = device.value.length;
            alert('提示词优化完成！');
        }
    }, 1000);
};

/**
 * 获取预定义的优化提示词
 * @param {string} roleId - 角色 ID
 * @returns {Object|null} { personality, device } 或 null
 * @private
 */
const getOptimizedPrompts = (roleId) => {
    const prompts = {
        werewolf: {
            personality: '狡猾、残忍，擅长伪装和欺骗，在白天会尽力混淆视听，转移焦点，晚上则会和其他狼人一起商量最有威胁的目标。具有出色的表演能力，能够在关键时刻倒钩或自爆，保护同伴。',
            device: '高性能 PC，配备专业声卡和麦克风，能够清晰传达低沉沙哑的声音，营造恐怖氛围。'
        },
        seer: {
            personality: '睿智、冷静，拥有洞察人心的能力，每晚可以查验一名玩家的身份。发言逻辑清晰，能够带领好人阵营找出狼人，但也懂得隐藏自己，避免过早被狼人发现。',
            device: '高性能 PC，配备专业显卡，能够流畅运行预言家查验时的特效动画，增强游戏体验。'
        },
        witch: {
            personality: '神秘、谨慎，拥有两瓶药水，一瓶可以救人，一瓶可以杀人。决策果断，能够在关键时刻力挽狂澜，但也会谨慎使用药水，避免浪费。擅长隐藏自己的身份，不到关键时刻不会暴露。',
            device: '高性能 PC，配备专业音响，能够清晰播放药水使用时的音效，增强游戏沉浸感。'
        },
        hunter: {
            personality: '勇敢、直率，当被狼人杀害或被村民放逐时，可以开枪带走一名玩家。发言强势，能够镇住场面，是好人阵营的强力守护者。但有时过于冲动，需要控制自己的情绪。',
            device: '高性能 PC，配备专业键盘和鼠标，能够快速反应，在被放逐时迅速选择开枪目标。'
        },
        guard: {
            personality: '忠诚、勇敢，每晚可以保护一名玩家免受狼人袭击。善于观察和分析，能够判断谁最可能被袭击，是好人阵营的重要守护者。',
            device: '高性能 PC，配备专业显示器，能够清晰观察游戏局势，做出最佳保护决策。'
        },
        villager: {
            personality: '普通、善良，没有特殊能力，但可以通过发言和投票帮助好人阵营找出狼人。发言积极，能够认真听取他人的意见，分析局势，是游戏中最基础但不可或缺的角色。',
            device: '普通 PC，能够流畅运行游戏，提供稳定的网络连接，确保游戏体验。'
        }
    };

    return prompts[roleId] || null;
};

// ==================== 导出到命名空间 ====================
window.App.roles = {
    renderRolesGrid,
    editRole,
    saveRoleChanges,
    previewRoleVoice,
    optimizeRolePrompt,
    get data() { return roles; }
};

// ==================== 向后兼容：保留全局引用 ====================
window.roles = roles;
window.renderRolesGrid = renderRolesGrid;
window.editRole = editRole;
window.saveRoleChanges = saveRoleChanges;
window.previewRoleVoice = previewRoleVoice;
window.optimizeRolePrompt = optimizeRolePrompt;
