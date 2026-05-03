/**
 * theme.js - 主题切换模块
 *
 * 支持多种暗黑风格主题切换，所有主题基于深色调。
 *
 * @module Theme
 */

window.App = window.App || {};

const THEME_KEY = 'aiWerewolfTheme';

// 主题定义
const THEMES = {
    default: {
        name: '暗黑奇幻',
        icon: '🐺',
        cssVars: {
            '--bg-primary': '#07080e',
            '--bg-secondary': '#0c0e18',
            '--bg-tertiary': '#0f1120',
            '--accent': '#d4a830',
            '--accent-dim': 'rgba(212, 168, 48, 0.15)',
            '--blood': '#8b1a1a',
            '--text-primary': '#e8e8e8',
            '--text-secondary': '#999',
            '--border': 'rgba(212, 168, 48, 0.1)',
        }
    },
    crimson: {
        name: '猩红之夜',
        icon: '🌑',
        cssVars: {
            '--bg-primary': '#0a0000',
            '--bg-secondary': '#120000',
            '--bg-tertiary': '#1a0505',
            '--accent': '#ff4444',
            '--accent-dim': 'rgba(255, 68, 68, 0.15)',
            '--blood': '#cc0000',
            '--text-primary': '#f0d0d0',
            '--text-secondary': '#a08080',
            '--border': 'rgba(255, 68, 68, 0.1)',
        }
    },
    emerald: {
        name: '翡翠森林',
        icon: '🌿',
        cssVars: {
            '--bg-primary': '#020a06',
            '--bg-secondary': '#041208',
            '--bg-tertiary': '#061a0c',
            '--accent': '#4caf50',
            '--accent-dim': 'rgba(76, 175, 80, 0.15)',
            '--blood': '#8b1a1a',
            '--text-primary': '#d0e8d8',
            '--text-secondary': '#80a890',
            '--border': 'rgba(76, 175, 80, 0.1)',
        }
    },
    frost: {
        name: '冰霜王座',
        icon: '❄️',
        cssVars: {
            '--bg-primary': '#060a10',
            '--bg-secondary': '#0a1420',
            '--bg-tertiary': '#0e1c2c',
            '--accent': '#64b5f6',
            '--accent-dim': 'rgba(100, 181, 246, 0.15)',
            '--blood': '#8b1a1a',
            '--text-primary': '#d0e0f0',
            '--text-secondary': '#8098b0',
            '--border': 'rgba(100, 181, 246, 0.1)',
        }
    },
    void_theme: {
        name: '虚空深渊',
        icon: '🕳️',
        cssVars: {
            '--bg-primary': '#030308',
            '--bg-secondary': '#060610',
            '--bg-tertiary': '#0a0a18',
            '--accent': '#9c27b0',
            '--accent-dim': 'rgba(156, 39, 176, 0.15)',
            '--blood': '#6a1b9a',
            '--text-primary': '#e0d0f0',
            '--text-secondary': '#9080a0',
            '--border': 'rgba(156, 39, 176, 0.1)',
        }
    }
};

const applyTheme = (themeId) => {
    const theme = THEMES[themeId] || THEMES.default;
    const root = document.documentElement;

    Object.entries(theme.cssVars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });

    localStorage.setItem(THEME_KEY, themeId);
    console.log(`[Theme] Applied: ${theme.name}`);
};

const getCurrentTheme = () => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved && THEMES[saved] ? saved : 'default';
};

const initTheme = () => {
    const themeId = getCurrentTheme();
    applyTheme(themeId);
};

const renderThemeSelector = (container) => {
    if (!container) return;
    const current = getCurrentTheme();

    container.innerHTML = '';

    Object.entries(THEMES).forEach(([id, theme]) => {
        const btn = document.createElement('button');
        const isActive = id === current;
        btn.className = `theme-option rounded-xl border p-4 transition-all ${
            isActive
                ? 'border-gold-500/40 bg-gold-500/10'
                : 'border-gray-700/50 hover:border-gray-500'
        }`;
        btn.innerHTML = `
            <div class="text-2xl mb-2">${theme.icon}</div>
            <div class="text-sm font-cinzel ${isActive ? 'text-gold-400' : 'text-gray-400'}">${theme.name}</div>
            ${isActive ? '<div class="text-xs text-gold-500 mt-1">当前使用</div>' : ''}
        `;

        btn.addEventListener('click', () => {
            applyTheme(id);
            renderThemeSelector(container);
        });

        container.appendChild(btn);
    });
};

window.App.theme = {
    THEMES,
    applyTheme,
    getCurrentTheme,
    initTheme,
    renderThemeSelector
};
