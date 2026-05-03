/**
 * domCache.js - DOM 缓存与优化模块
 *
 * 缓存 DOM 查询结果，优化频繁 DOM 操作的性能。
 *
 * @module DOMCache
 */

window.App = window.App || {};

/**
 * DOM 元素缓存
 */
const elementCache = new Map();

/**
 * 缓存统计信息
 */
const cacheStats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    totalQueries: 0
};

/**
 * 从缓存获取或查询元素
 * @param {string} selector - CSS 选择器
 * @param {HTMLElement} [context=document] - 查询上下文
 * @returns {HTMLElement|null} 元素
 */
const get = (selector, context = document) => {
    cacheStats.totalQueries++;
    
    const cacheKey = `${context.constructor.name}-${selector}`;
    
    if (elementCache.has(cacheKey)) {
        cacheStats.hits++;
        const cached = elementCache.get(cacheKey);
        
        // 验证元素是否仍在 DOM 中
        if (cached && document.body.contains(cached)) {
            return cached;
        }
        
        // 元素已移除，清理缓存
        elementCache.delete(cacheKey);
    }
    
    cacheStats.misses++;
    const element = context.querySelector(selector);
    
    if (element) {
        elementCache.set(cacheKey, element);
    }
    
    return element;
};

/**
 * 从缓存获取或查询多个元素
 * @param {string} selector - CSS 选择器
 * @param {HTMLElement} [context=document] - 查询上下文
 * @returns {HTMLElement[]} 元素数组
 */
const getAll = (selector, context = document) => {
    cacheStats.totalQueries++;
    
    const cacheKey = `all-${context.constructor.name}-${selector}`;
    
    // 对于多个元素，我们不缓存，因为结果可能变化
    // 但我们统计查询次数
    return Array.from(context.querySelectorAll(selector));
};

/**
 * 通过 ID 获取元素（带缓存）
 * @param {string} id - 元素 ID
 * @returns {HTMLElement|null} 元素
 */
const getById = (id) => {
    cacheStats.totalQueries++;
    
    const cacheKey = `id-${id}`;
    
    if (elementCache.has(cacheKey)) {
        cacheStats.hits++;
        const cached = elementCache.get(cacheKey);
        if (cached && document.body.contains(cached)) {
            return cached;
        }
        elementCache.delete(cacheKey);
    }
    
    cacheStats.misses++;
    const element = document.getElementById(id);
    
    if (element) {
        elementCache.set(cacheKey, element);
    }
    
    return element;
};

/**
 * 使缓存失效
 * @param {string} [selector] - 选择器（可选，不传则清空全部）
 */
const invalidate = (selector) => {
    if (selector) {
        const keysToDelete = [];
        elementCache.forEach((_, key) => {
            if (key.includes(selector)) {
                keysToDelete.push(key);
            }
        });
        
        keysToDelete.forEach(key => {
            elementCache.delete(key);
            cacheStats.invalidations++;
        });
    } else {
        const count = elementCache.size;
        elementCache.clear();
        cacheStats.invalidations += count;
    }
};

/**
 * 清空所有缓存
 */
const clear = () => {
    const count = elementCache.size;
    elementCache.clear();
    cacheStats.invalidations += count;
};

/**
 * 获取缓存统计信息
 * @returns {Object} 统计信息
 */
const getStats = () => {
    const hitRate = cacheStats.totalQueries > 0 
        ? (cacheStats.hits / cacheStats.totalQueries * 100).toFixed(1)
        : 0;
    
    return {
        ...cacheStats,
        hitRate: `${hitRate}%`,
        cacheSize: elementCache.size
    };
};

/**
 * 重置缓存统计信息
 */
const resetCacheStats = () => {
    cacheStats.hits = 0;
    cacheStats.misses = 0;
    cacheStats.invalidations = 0;
    cacheStats.totalQueries = 0;
};

/**
 * 使用 DocumentFragment 批量添加元素
 * @param {HTMLElement} container - 容器元素
 * @param {HTMLElement[]} elements - 要添加的元素数组
 */
const batchAppend = (container, elements) => {
    if (!container || !elements.length) return;
    
    const fragment = document.createDocumentFragment();
    elements.forEach(el => fragment.appendChild(el));
    container.appendChild(fragment);
};

/**
 * 使用 DocumentFragment 批量添加元素（从 HTML 字符串）
 * @param {HTMLElement} container - 容器元素
 * @param {string} html - HTML 字符串
 */
const batchAppendHTML = (container, html) => {
    if (!container || !html) return;
    
    const template = document.createElement('template');
    template.innerHTML = html;
    container.appendChild(template.content.cloneNode(true));
};

/**
 * 安全的 innerHTML 替换（先清空再使用 DocumentFragment）
 * @param {HTMLElement} container - 容器元素
 * @param {string} html - HTML 字符串
 */
const safeSetHTML = (container, html) => {
    if (!container) return;
    
    // 先清空
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    // 再添加新内容
    batchAppendHTML(container, html);
};

/**
 * 批量更新元素属性
 * @param {HTMLElement[]} elements - 元素数组
 * @param {Object} attributes - 属性对象
 */
const batchSetAttributes = (elements, attributes) => {
    elements.forEach(el => {
        Object.entries(attributes).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                el.removeAttribute(key);
            } else {
                el.setAttribute(key, value);
            }
        });
    });
};

/**
 * 批量切换类名
 * @param {HTMLElement[]} elements - 元素数组
 * @param {string} className - 类名
 * @param {boolean} [force] - 强制添加或移除
 */
const batchToggleClass = (elements, className, force) => {
    elements.forEach(el => {
        el.classList.toggle(className, force);
    });
};

window.App.domCache = {
    get,
    getAll,
    getById,
    invalidate,
    clear,
    getStats,
    resetCacheStats,
    batchAppend,
    batchAppendHTML,
    safeSetHTML,
    batchSetAttributes,
    batchToggleClass
};

// 导出到全局，方便替换现有代码
window.$ = window.App.domCache.get;
window.$$ = window.App.domCache.getAll;
window.$id = window.App.domCache.getById;
