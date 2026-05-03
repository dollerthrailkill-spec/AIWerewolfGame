/**
 * personality.js - AI 玩家性格系统模块
 *
 * 管理 AI 玩家的性格标签，影响其在游戏中的发言风格。
 * 每个角色可以配置多个性格标签，系统根据标签生成不同的发言风格。
 *
 * @module Personality
 */

window.App = window.App || {};

const PERSONALITY_KEY = 'aiWerewolfPersonalities';

// 预定义性格标签库
const PERSONALITY_TAGS = {
    aggressive:    { name: '激进',    icon: '🔥', desc: '发言强势，主动攻击他人' },
    calm:          { name: '冷静',    icon: '🧊', desc: '逻辑清晰，不轻易表态' },
    humorous:      { name: '幽默',    icon: '😏', desc: '喜欢开玩笑，活跃气氛' },
    suspicious:    { name: '多疑',    icon: '🔍', desc: '对所有人都持怀疑态度' },
    loyal:         { name: '忠诚',    icon: '🛡️', desc: '坚定支持认定的好人' },
    manipulative:  { name: '操控',    icon: '🎭', desc: '善于引导舆论方向' },
    quiet:         { name: '沉默',    icon: '🤐', desc: '发言简短，不轻易暴露' },
    talkative:     { name: '健谈',    icon: '💬', desc: '发言较多，善于分析' },
    bluffing:      { name: '虚张声势', icon: '🃏', desc: '喜欢诈唬和试探' },
    analytical:    { name: '分析型',  icon: '📊', desc: '注重逻辑推理和证据' },
    emotional:     { name: '感性',    icon: '❤️', desc: '容易被情绪影响发言' },
    leader:        { name: '领导型',  icon: '👑', desc: '主动带节奏，指挥团队' }
};

// 默认角色性格配置
const DEFAULT_ROLE_PERSONALITIES = {
    werewolf:  ['manipulative', 'bluffing', 'aggressive'],
    werewolf2: ['aggressive', 'quiet', 'suspicious'],
    werewolf3: ['leader', 'analytical', 'manipulative'],
    seer:      ['calm', 'analytical', 'leader'],
    witch:     ['calm', 'suspicious', 'analytical'],
    hunter:    ['aggressive', 'loyal', 'leader'],
    guard:     ['loyal', 'calm', 'quiet'],
    villager:  ['talkative', 'analytical', 'loyal'],
    villager2: ['calm', 'suspicious', 'humorous'],
    villager3: ['emotional', 'loyal', 'talkative']
};

const loadPersonalities = () => {
    try {
        const saved = localStorage.getItem(PERSONALITY_KEY);
        if (saved) return { ...DEFAULT_ROLE_PERSONALITIES, ...JSON.parse(saved) };
    } catch (e) {
        console.error('[Personality] Load error:', e);
    }
    return { ...DEFAULT_ROLE_PERSONALITIES };
};

const savePersonalities = (personalities) => {
    try {
        localStorage.setItem(PERSONALITY_KEY, JSON.stringify(personalities));
    } catch (e) {
        console.error('[Personality] Save error:', e);
    }
};

const getRolePersonalities = (roleId) => {
    const all = loadPersonalities();
    return all[roleId] || [];
};

const setRolePersonalities = (roleId, tags) => {
    const all = loadPersonalities();
    all[roleId] = tags;
    savePersonalities(all);
};

const getPersonalityPrompt = (roleId) => {
    const tags = getRolePersonalities(roleId);
    if (tags.length === 0) return '';

    const tagDescs = tags
        .map(t => PERSONALITY_TAGS[t])
        .filter(Boolean)
        .map(t => t.desc);

    return `你的发言风格应该体现以下特点：${tagDescs.join('；')}。`;
};

const renderPersonalitySelector = (container, roleId, onChange) => {
    if (!container) return;
    const currentTags = getRolePersonalities(roleId);

    container.innerHTML = '';

    Object.entries(PERSONALITY_TAGS).forEach(([key, tag]) => {
        const btn = document.createElement('button');
        const isActive = currentTags.includes(key);
        btn.className = `personality-tag px-3 py-1.5 rounded-full text-xs border transition-all ${
            isActive
                ? 'border-gold-500/40 bg-gold-500/10 text-gold-400'
                : 'border-gray-700 bg-transparent text-gray-500 hover:border-gray-500'
        }`;
        btn.innerHTML = `${tag.icon} ${tag.name}`;
        btn.title = tag.desc;

        btn.addEventListener('click', () => {
            const tags = getRolePersonalities(roleId);
            const idx = tags.indexOf(key);
            if (idx >= 0) tags.splice(idx, 1);
            else if (tags.length < 3) tags.push(key);

            setRolePersonalities(roleId, tags);
            renderPersonalitySelector(container, roleId, onChange);
            if (onChange) onChange(tags);
        });

        container.appendChild(btn);
    });
};

window.App.personality = {
    PERSONALITY_TAGS,
    DEFAULT_ROLE_PERSONALITIES,
    loadPersonalities,
    savePersonalities,
    getRolePersonalities,
    setRolePersonalities,
    getPersonalityPrompt,
    renderPersonalitySelector
};
