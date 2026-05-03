/**
 * providers.js - API 供应商管理模块
 *
 * 管理模型供应商（API Provider）的配置，包括列表渲染、模型管理、
 * 连接测试、保存和删除操作。使用事件委托处理动态元素。
 * 所有功能逻辑保持不变，架构进行优化。
 *
 * @module Providers
 */

// ==================== App 命名空间初始化 ====================================
window.App = window.App || {};

// ==================== 供应商数据加载与渲染 ====================

/**
 * 从后端加载供应商列表
 */
const loadProviders = async () => {
    try {
        const resp = await fetch('/api/config');
        const data = await resp.json();

        window.App.providers = data.providers ? Object.values(data.providers) : [];
        window.App.state.providers = data.providers || {};

        console.log(`[Providers] Loaded ${window.App.providers.length} providers from backend`);
        renderProviders();
        updateStartButtonState();
    } catch (e) {
        console.error('[Providers] Failed to load providers:', e);
        window.App.providers = [];
        window.App.state.providers = {};
        updateStartButtonState();
    }
};

/**
 * 渲染供应商配置表单列表
 */
const renderProviders = () => {
    const container = document.getElementById('providers-container');
    if (!container) {
        console.error('[Providers] providers-container not found');
        return;
    }

    container.innerHTML = '';

    window.App.providers.forEach(provider => {
        const providerDiv = document.createElement('div');
        providerDiv.className = 'provider-form mb-6 p-4 border border-gothic-red rounded-lg relative bg-gothic-gray bg-opacity-50';
        providerDiv.dataset.providerId = provider.id;

        providerDiv.innerHTML = `
            <button class="delete-provider-btn absolute top-2 right-2 text-gothic-red hover:text-gothic-gold p-1" data-id="${provider.id}" title="删除此供应商">
                <i class="fa fa-times"></i>
            </button>

            <div class="mb-4">
                <label class="block text-gothic-light mb-2 text-sm">供应商名称 <span class="text-gothic-red">*</span></label>
                <input type="text" class="provider-name w-full bg-gothic-gray border border-gothic-red rounded px-3 py-2 text-gothic-light text-sm"
                    value="${escapeHtml(provider.name || '')}" placeholder="例如: OpenAI、Azure、Claude">
            </div>

            <div class="mb-4">
                <label class="block text-gothic-light mb-2 text-sm">API Key</label>
                <div class="relative">
                    <input type="password" class="provider-key w-full bg-gothic-gray border border-gothic-red rounded px-3 py-2 text-gothic-light text-sm pr-10"
                        value="${escapeHtml(provider.encrypted_api_key || provider.api_key || '')}" placeholder="输入API密钥" data-original-key="${escapeHtml(provider.encrypted_api_key || provider.api_key || '')}">
                    <button type="button" class="toggle-password-btn absolute right-2 top-1/2 transform -translate-y-1/2 text-gothic-light hover:text-gothic-gold transition-colors" title="显示API密钥">
                        <i class="fa fa-eye"></i>
                    </button>
                </div>
            </div>

            <div class="mb-4">
                <label class="block text-gothic-light mb-2 text-sm">API Base URL</label>
                <input type="text" class="provider-url w-full bg-gothic-gray border border-gothic-red rounded px-3 py-2 text-gothic-light text-sm"
                    value="${escapeHtml(provider.api_url || 'https://api.openai.com/v1')}" placeholder="例如: https://api.openai.com/v1">
            </div>

            <div class="mb-4">
                <div class="flex justify-between items-center mb-2">
                    <label class="block text-gothic-light text-sm">获取模型列表</label>
                    <button type="button" class="fetch-models-btn text-sm bg-gothic-dark-red border border-gothic-red text-gothic-light px-3 py-1 rounded hover:border-gothic-gold transition-all" data-id="${provider.id}">
                        <i class="fa fa-refresh mr-1"></i>刷新模型
                    </button>
                </div>
                <div class="model-select-area mb-2">
                    <select class="available-models w-full bg-gothic-gray border border-gothic-red rounded px-3 py-2 text-gothic-light text-sm" data-id="${provider.id}">
                        <option value="">选择模型...</option>
                        ${(provider.used_models || []).map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
                    </select>
                </div>
                <button type="button" class="add-model-btn w-full bg-gothic-dark-red border border-gothic-red text-gothic-light px-3 py-2 rounded hover:border-gothic-gold transition-all" data-id="${provider.id}">
                    <i class="fa fa-plus mr-1"></i>添加模型到库
                </button>
            </div>

            <div class="mb-4">
                <div class="flex justify-between items-center mb-2">
                    <label class="block text-gothic-light text-sm">已配置的模型库</label>
                    <span class="text-xs text-gray-500 model-count">(${(provider.used_models || []).length} 个)</span>
                </div>
                <div class="used-models-container flex flex-wrap gap-2 mb-2" data-id="${provider.id}">
                    ${(provider.used_models || []).map(m => `
                        <div class="model-chip bg-gothic-gray border border-gothic-red rounded px-3 py-1 text-sm flex items-center gap-2">
                            <span class="model-name text-gothic-light">${escapeHtml(m)}</span>
                            <button type="button" class="remove-model-btn text-gothic-red hover:text-gothic-gold" data-provider-id="${provider.id}" data-model="${escapeHtml(m)}" title="删除此模型">
                                <i class="fa fa-times"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                <div class="models-empty-tip text-xs text-gray-500 text-center py-2 ${(provider.used_models || []).length > 0 ? 'hidden' : ''}">
                    暂无模型，请从上方添加
                </div>
            </div>

            <div class="mb-4">
                <label class="block text-gothic-light mb-2 text-sm">默认模型</label>
                <select class="default-model-select w-full bg-gothic-gray border border-gothic-red rounded px-3 py-2 text-gothic-light text-sm" data-id="${provider.id}">
                    ${(provider.used_models || []).map(m => `
                        <option value="${escapeHtml(m)}" ${provider.default_model === m ? 'selected' : ''}>${escapeHtml(m)}</option>
                    `).join('')}
                    ${!(provider.used_models?.length) ? `<option value="${escapeHtml(provider.default_model || 'gpt-3.5-turbo')}" selected>${escapeHtml(provider.default_model || 'gpt-3.5-turbo')}</option>` : ''}
                </select>
            </div>

            <div class="flex gap-2 mt-4">
                <button type="button" class="test-provider-btn bg-gothic-gray border border-gothic-red text-gothic-light px-4 py-2 rounded hover:border-gothic-gold transition-all" data-id="${provider.id}">
                    <i class="fa fa-check mr-1"></i>测试连接
                </button>
            </div>
        `;

        container.appendChild(providerDiv);
    });

    console.log(`[Providers] Rendered ${window.App.providers.length} providers`);
};

// ==================== HTML 转义工具 ====================
// 使用 security.js 中定义的 escapeHtml 避免重复声明

// ==================== 模型管理 ====================

/**
 * 获取模型列表
 * @param {string} providerId - 供应商 ID
 */
const fetchModels = async (providerId) => {
    const form = getProviderForm(providerId);
    if (!form) return;

    const name = form.querySelector('.provider-name').value;
    const url = form.querySelector('.provider-url').value;
    let key = form.querySelector('.provider-key').value;

    // 如果是脱敏的 Key，获取真实 Key
    if (key.includes('****')) {
        const originalProvider = window.App.state.providers?.[providerId];
        if (originalProvider?.encrypted_api_key) {
            key = originalProvider.encrypted_api_key;
        }
    }

    const btn = form.querySelector('.fetch-models-btn');
    const originalHtml = btn.innerHTML;
    setButtonLoading(btn, true, '<i class="fa fa-spinner fa-spin mr-1"></i>加载中...');

    try {
        const response = await fetch('/api/config/list-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: providerId, name, api_url: url, api_key: key,
                default_model: '', used_models: []
            })
        });

        const data = await response.json();

        if (data.success) {
            const select = form.querySelector('.available-models');
            select.innerHTML = '<option value="">选择模型...</option>';
            data.models.forEach(model => {
                select.innerHTML += `<option value="${model}">${model}</option>`;
            });
            alert(`成功获取 ${data.models.length} 个模型！`);
        } else {
            alert(`获取模型列表失败：${data.message}`);
        }
    } catch (error) {
        console.error('[Providers] Fetch models error:', error);
        alert(`获取模型列表出错：${error.message}`);
    } finally {
        setButtonLoading(btn, false, originalHtml);
    }
};

/**
 * 将选中的模型添加到供应商的模型库
 * @param {string} providerId - 供应商 ID
 */
const addModelToLibrary = (providerId) => {
    const form = getProviderForm(providerId);
    if (!form) return;

    const select = form.querySelector('.available-models');
    const selectedModel = select.value;

    if (!selectedModel) {
        alert('请先选择一个模型！');
        return;
    }

    const provider = window.App.providers.find(p => p.id === providerId);
    if (!provider) return;

    provider.used_models = provider.used_models || [];

    if (provider.used_models.includes(selectedModel)) {
        alert('该模型已在库中！');
        return;
    }

    provider.used_models.push(selectedModel);

    // 添加模型芯片到 UI
    const container = form.querySelector('.used-models-container');
    const modelChip = document.createElement('div');
    modelChip.className = 'model-chip bg-gothic-gray border border-gothic-red rounded px-3 py-1 text-sm flex items-center gap-2';
    modelChip.innerHTML = `
        <span class="model-name text-gothic-light">${selectedModel}</span>
        <button type="button" class="remove-model-btn text-gothic-red hover:text-gothic-gold" data-provider-id="${providerId}" data-model="${selectedModel}">
            <i class="fa fa-times"></i>
        </button>
    `;
    container.appendChild(modelChip);

    // 更新默认模型选择
    const defaultModelSelect = form.querySelector('.default-model-select');
    if (!provider.default_model) {
        provider.default_model = selectedModel;
        const option = document.createElement('option');
        option.value = selectedModel;
        option.textContent = selectedModel;
        option.selected = true;
        defaultModelSelect.appendChild(option);
    } else {
        const option = document.createElement('option');
        option.value = selectedModel;
        option.textContent = selectedModel;
        defaultModelSelect.appendChild(option);
    }

    // 更新模型计数
    const countEl = form.querySelector('.model-count');
    if (countEl) {
        countEl.textContent = `(${provider.used_models.length} 个)`;
    }

    // 隐藏空状态提示
    const emptyTip = form.querySelector('.models-empty-tip');
    if (emptyTip) emptyTip.classList.add('hidden');

    select.value = '';
};

/**
 * 从供应商的模型库中移除模型
 * @param {string} providerId - 供应商 ID
 * @param {string} modelName - 模型名称
 */
const removeModelFromLibrary = (providerId, modelName) => {
    const provider = window.App.providers.find(p => p.id === providerId);
    if (!provider) return;

    provider.used_models = provider.used_models || [];
    const index = provider.used_models.indexOf(modelName);
    if (index > -1) provider.used_models.splice(index, 1);

    // 更新受影响的角色配置
    const affectedRoles = [];
    Object.entries(window.roles || {}).forEach(([roleId, role]) => {
        if (role.model === modelName) {
            role.model = provider.used_models[0] || provider.default_model || 'gpt-3.5-turbo';
            affectedRoles.push(role.name || roleId);
        }
    });

    // 更新 UI
    const form = getProviderForm(providerId);
    if (form) {
        // 1. 移除模型芯片
        const container = form.querySelector('.used-models-container');
        container.querySelectorAll('.model-chip').forEach(chip => {
            if (chip.querySelector('.model-name').textContent === modelName) {
                chip.remove();
            }
        });

        // 2. 更新"选择模型"下拉框
        const availableSelect = form.querySelector('.available-models');
        if (availableSelect) {
            const opt = availableSelect.querySelector(`option[value="${CSS.escape(modelName)}"]`);
            if (opt) opt.remove();
        }

        // 3. 更新默认模型选择
        const defaultModelSelect = form.querySelector('.default-model-select');
        if (defaultModelSelect) {
            const opt = defaultModelSelect.querySelector(`option[value="${CSS.escape(modelName)}"]`);
            if (opt) opt.remove();

            if (provider.default_model === modelName && provider.used_models.length > 0) {
                provider.default_model = provider.used_models[0];
                defaultModelSelect.value = provider.default_model;
            }
        }

        // 4. 更新模型计数
        const countEl = form.querySelector('.model-count');
        if (countEl) {
            countEl.textContent = `(${provider.used_models.length} 个)`;
        }

        // 5. 如果模型库为空，显示空状态提示
        if (provider.used_models.length === 0) {
            const emptyTip = form.querySelector('.models-empty-tip');
            if (emptyTip) emptyTip.classList.remove('hidden');
        }
    }

    // 保存到本地存储
    saveToLocalStorage();

    if (affectedRoles.length > 0) {
        alert(`已删除模型「${modelName}」。\n以下角色的模型已自动切换：\n${affectedRoles.join('、')}`);
    }
};

// ==================== 模型库管理 ====================

/**
 * 渲染全局模型库列表
 * 展示所有供应商的所有模型，支持搜索、筛选和删除
 */
const renderModelsLibrary = () => {
    const container = document.getElementById('models-list-container');
    const emptyTip = document.getElementById('models-empty-tip');
    const searchInput = document.getElementById('model-search-input');
    const filterSelect = document.getElementById('model-filter-provider');
    if (!container) return;

    const providers = window.App.providers || [];

    // 构建所有模型的扁平列表
    let allModels = [];
    providers.forEach(provider => {
        const usedModels = provider.used_models || [];
        usedModels.forEach(model => {
            allModels.push({
                modelName: model,
                providerId: provider.id,
                providerName: provider.name || '未命名供应商',
                isDefault: provider.default_model === model
            });
        });
    });

    // 渲染供应商筛选下拉框
    if (filterSelect) {
        const currentFilter = filterSelect.value;
        filterSelect.innerHTML = '<option value="">全部供应商</option>';
        providers.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider.id;
            option.textContent = provider.name || '未命名供应商';
            filterSelect.appendChild(option);
        });
        // 恢复之前的筛选选择
        if (currentFilter) filterSelect.value = currentFilter;
    }

    // 筛选模型
    const searchKeyword = searchInput?.value?.trim().toLowerCase() || '';
    const providerFilter = filterSelect?.value || '';

    const filteredModels = allModels.filter(item => {
        const matchSearch = !searchKeyword || item.modelName.toLowerCase().includes(searchKeyword);
        const matchProvider = !providerFilter || item.providerId === providerFilter;
        return matchSearch && matchProvider;
    });

    // 渲染列表
    if (filteredModels.length === 0) {
        container.innerHTML = '';
        emptyTip?.classList.remove('hidden');
        return;
    }

    emptyTip?.classList.add('hidden');

    // 按供应商分组渲染
    const grouped = {};
    filteredModels.forEach(item => {
        if (!grouped[item.providerId]) {
            grouped[item.providerId] = {
                providerName: item.providerName,
                models: []
            };
        }
        grouped[item.providerId].models.push(item);
    });

    container.innerHTML = '';

    Object.entries(grouped).forEach(([providerId, group]) => {
        // 供应商分组标题
        const groupHeader = document.createElement('div');
        groupHeader.className = 'flex items-center gap-2 mt-4 mb-2 first:mt-0';
        groupHeader.innerHTML = `
            <i class="fa fa-server text-gold-500/60 text-xs"></i>
            <span class="text-sm font-cinzel text-gold-500/80 tracking-wider">${escapeHtml(group.providerName)}</span>
            <span class="text-xs text-gray-500">(${group.models.length} 个模型)</span>
            <div class="flex-1 h-px bg-gold-500/10 ml-2"></div>
        `;
        container.appendChild(groupHeader);

        // 模型列表
        group.models.forEach(item => {
            const modelRow = document.createElement('div');
            modelRow.className = 'flex items-center justify-between p-3 rounded-lg border border-gold-500/10 hover:border-gold-500/25 transition-all group';

            // 查询哪些角色在使用此模型
            const usedByRoles = [];
            Object.entries(window.roles || {}).forEach(([roleId, role]) => {
                if (role.model === item.modelName) {
                    usedByRoles.push(role.name || roleId);
                }
            });

            const roleTip = usedByRoles.length > 0
                ? `title="被以下角色使用: ${usedByRoles.join('、')}"`
                : '';

            modelRow.innerHTML = `
                <div class="flex items-center gap-3 min-w-0 flex-1" ${roleTip}>
                    <div class="w-8 h-8 rounded-lg bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                        <i class="fa fa-cube text-gold-500/60 text-sm"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-gray-200 truncate">${escapeHtml(item.modelName)}</span>
                            ${item.isDefault ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-gold-500/20 text-gold-400 flex-shrink-0">默认</span>' : ''}
                        </div>
                        ${usedByRoles.length > 0
                            ? `<div class="text-xs text-gray-500 mt-0.5 truncate">角色: ${escapeHtml(usedByRoles.join('、'))}</div>`
                            : '<div class="text-xs text-gray-600 mt-0.5">未被任何角色使用</div>'
                        }
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0 ml-3">
                    <button type="button" class="model-delete-btn px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 hover:border-red-500/50 transition-all opacity-60 group-hover:opacity-100"
                        data-provider-id="${escapeHtml(item.providerId)}" data-model="${escapeHtml(item.modelName)}">
                        <i class="fa fa-trash mr-1"></i>删除
                    </button>
                </div>
            `;
            container.appendChild(modelRow);
        });
    });

    // 绑定搜索和筛选事件（只绑定一次，避免重复）
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        searchInput.addEventListener('input', () => renderModelsLibrary());
    }
    if (filterSelect && !filterSelect.dataset.bound) {
        filterSelect.dataset.bound = 'true';
        filterSelect.addEventListener('change', () => renderModelsLibrary());
    }
};

/**
 * 添加新的空白供应商配置
 */
const addNewProvider = () => {
    const newProvider = {
        id: `provider_${Date.now()}`,
        name: '',
        api_key: '',
        api_url: 'https://api.openai.com/v1',
        default_model: 'gpt-3.5-turbo',
        used_models: []
    };
    window.App.providers.push(newProvider);
    renderProviders();
};

/**
 * 测试供应商连接
 * @param {string} providerId - 供应商 ID
 */
const testProvider = async (providerId) => {
    const form = getProviderForm(providerId);
    if (!form) return;

    let providerKey = form.querySelector('.provider-key').value;
    if (providerKey.includes('****')) {
        const providers = window.App.state?.providers;
        const originalProvider = providers && !Array.isArray(providers) ? providers[providerId] : null;
        if (originalProvider?.encrypted_api_key) {
            providerKey = originalProvider.encrypted_api_key;
        }
    }

    const provider = {
        id: providerId,
        name: form.querySelector('.provider-name').value,
        api_url: form.querySelector('.provider-url').value,
        api_key: providerKey,
        default_model: form.querySelector('.default-model-select').value,
        used_models: []
    };

    const btn = form.querySelector('.test-provider-btn');
    setButtonLoading(btn, true, '<i class="fa fa-spinner fa-spin mr-1"></i>测试中...');

    try {
        const response = await fetch('/api/config/test-provider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(provider)
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ 连接测试成功！');
        } else {
            alert(`❌ 连接测试失败：${data.message}`);
        }
    } catch (error) {
        console.error('[Providers] Test provider error:', error);
        alert(`❌ 连接测试出错：${error.message}`);
    } finally {
        setButtonLoading(btn, false, '<i class="fa fa-check mr-1"></i>测试连接');
    }
};

/**
 * 保存所有供应商配置到后端
 */
const saveApiConfig = async () => {
    const statusElement = document.getElementById('api-status');
    if (statusElement) statusElement.classList.add('hidden');

    const providersToSave = [];
    document.querySelectorAll('.provider-form').forEach(form => {
        const providerId = form.querySelector('.delete-provider-btn').dataset.id || '';
        let apiKey = form.querySelector('.provider-key').value;

        if (apiKey.includes('****') || !apiKey) {
            const providers = window.App.state?.providers;
            const originalProvider = providers && !Array.isArray(providers) ? providers[providerId] : null;
            if (originalProvider?.encrypted_api_key) {
                apiKey = originalProvider.encrypted_api_key;
            }
        }

        const modelsContainer = form.querySelector('.used-models-container');
        const modelNames = Array.from(
            modelsContainer.querySelectorAll('.model-name')
        ).map(el => el.textContent);

        providersToSave.push({
            id: providerId,
            name: form.querySelector('.provider-name').value,
            api_key: apiKey,
            api_url: form.querySelector('.provider-url').value,
            default_model: form.querySelector('.default-model-select').value,
            used_models: modelNames
        });
    });

    let allSaved = true;

    for (const provider of providersToSave) {
        try {
            const response = await fetch('/api/config/provider', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(provider)
            });
            if (!response.ok) allSaved = false;
        } catch (e) {
            allSaved = false;
        }
    }

    if (allSaved) {
        await loadProviders();
        if (statusElement) {
            statusElement.textContent = '所有配置保存成功！';
            statusElement.classList.remove('text-red-500');
            statusElement.classList.add('text-green-500');
        }
    } else {
        if (statusElement) {
            statusElement.textContent = '部分配置保存失败，请检查控制台';
            statusElement.classList.remove('text-green-500');
            statusElement.classList.add('text-red-500');
        }
    }

    if (statusElement) statusElement.classList.remove('hidden');
    setTimeout(() => {
        if (statusElement) statusElement.classList.add('hidden');
    }, 3000);
};

/**
 * 删除供应商
 * @param {string} providerId - 供应商 ID
 */
const deleteProvider = async (providerId) => {
    if (!providerId) {
        console.warn('[Providers] deleteProvider called without providerId');
        return;
    }
    if (!window.App.providers || !Array.isArray(window.App.providers)) {
        console.error('[Providers] window.App.providers is not initialized');
        return;
    }
    const provider = window.App.providers.find(p => p.id === providerId);
    const providerName = provider?.name || '此供应商';

    if (!confirm(`确定要删除供应商"${providerName}"吗？\n\n删除后，使用该供应商的角色配置将失效。`)) {
        return;
    }

    try {
        const response = await fetch(`/api/config/provider/${providerId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadProviders();
            alert(`供应商"${providerName}"已成功删除！`);
        } else {
            const errorData = await response.json();
            alert(`删除失败：${errorData.message || response.statusText}`);
        }
    } catch (error) {
        console.error('[Providers] Delete provider error:', error);
        alert(`删除失败：${error.message}`);
    }
};

/**
 * 加载游戏配置
 */
const loadGameConfigs = async () => {
    try {
        const resp = await fetch('/api/game-configs');
        const configs = await resp.json();
        if (window.App.state) {
            window.App.state.gameConfigs = configs;
        } else {
            console.warn('[Providers] window.App.state not initialized, skipping gameConfigs assignment');
        }
    } catch (e) {
        console.error('[Providers] Failed to load game configs:', e);
    }
};

// ==================== 工具函数 ====================

/**
 * 根据供应商 ID 查找对应的表单元素
 * @param {string} providerId - 供应商 ID
 * @returns {HTMLElement|null}
 */
const getProviderForm = (providerId) => {
    if (!providerId) return null;
    const btn = document.querySelector(`.delete-provider-btn[data-id="${providerId}"]`);
    return btn ? btn.closest('.provider-form') : null;
};

/**
 * 设置按钮的加载状态
 * @param {HTMLElement} btn - 按钮元素
 * @param {boolean} loading - 是否加载中
 * @param {string} [html=''] - 正常状态的 HTML
 */
const setButtonLoading = (btn, loading, html = '') => {
    if (btn) {
        btn.disabled = loading;
        if (loading) {
            btn.dataset.originalHtml = btn.innerHTML;
            btn.innerHTML = html;
        } else {
            btn.innerHTML = html || btn.dataset.originalHtml || btn.innerHTML;
        }
    }
};

// ==================== 事件委托 ====================

document.addEventListener('click', (e) => {
    const target = e.target;

    // 获取模型列表
    const fetchBtn = target.closest('.fetch-models-btn');
    if (fetchBtn) fetchModels(fetchBtn.dataset.id);

    // 添加模型
    const addBtn = target.closest('.add-model-btn');
    if (addBtn) addModelToLibrary(addBtn.dataset.id);

    // 删除模型（模型库中的删除按钮）
    const deleteBtn = target.closest('.model-delete-btn');
    if (deleteBtn) {
        const modelName = deleteBtn.dataset.model;
        const providerId = deleteBtn.dataset.providerId;
        // 查询哪些角色在使用此模型
        const usedByRoles = [];
        Object.entries(window.roles || {}).forEach(([roleId, role]) => {
            if (role.model === modelName) {
                usedByRoles.push(role.name || roleId);
            }
        });
        const confirmMsg = usedByRoles.length > 0
            ? `确定要删除模型「${modelName}」吗？\n\n以下角色正在使用此模型，删除后将自动切换为同供应商的第一个可用模型：\n${usedByRoles.join('、')}`
            : `确定要删除模型「${modelName}」吗？`;
        if (confirm(confirmMsg)) {
            removeModelFromLibrary(providerId, modelName);
            // 重新渲染模型库列表
            renderModelsLibrary();
        }
    }

    // 删除模型（供应商配置中已配置模型库里的删除按钮）
    const removeBtn = target.closest('.remove-model-btn');
    if (removeBtn) {
        const modelName = removeBtn.dataset.model;
        const providerId = removeBtn.dataset.providerId;
        // 查询哪些角色在使用此模型
        const usedByRoles = [];
        Object.entries(window.roles || {}).forEach(([roleId, role]) => {
            if (role.model === modelName) {
                usedByRoles.push(role.name || roleId);
            }
        });
        const confirmMsg = usedByRoles.length > 0
            ? `确定要删除模型「${modelName}」吗？\n\n以下角色正在使用此模型，删除后将自动切换为同供应商的第一个可用模型：\n${usedByRoles.join('、')}`
            : `确定要删除模型「${modelName}」吗？`;
        if (confirm(confirmMsg)) {
            removeModelFromLibrary(providerId, modelName);
        }
    }

    // 测试连接
    const testBtn = target.closest('.test-provider-btn');
    if (testBtn) testProvider(testBtn.dataset.id);
});

// ==================== 导出到命名空间 ====================
window.App.providers = {
    loadProviders,
    renderProviders,
    renderModelsLibrary,
    addNewProvider,
    saveApiConfig,
    deleteProvider,
    loadGameConfigs,
    fetchModels,
    addModelToLibrary,
    removeModelFromLibrary,
    testProvider
};

// ==================== 向后兼容：保留全局引用 ====================
window.loadProviders = loadProviders;
window.renderProviders = renderProviders;
window.addNewProvider = addNewProvider;
window.saveApiConfig = saveApiConfig;
window.deleteProvider = deleteProvider;
window.loadGameConfigs = loadGameConfigs;
