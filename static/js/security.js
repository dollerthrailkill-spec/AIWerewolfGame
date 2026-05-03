/**
 * security.js - 安全工具模块
 *
 * 提供XSS防护、输入验证等安全相关功能。
 *
 * @module Security
 */

window.App = window.App || {};

/**
 * 转义HTML特殊字符，防止XSS攻击
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
const escapeHtml = (str) => {
    if (typeof str !== 'string') {
        return String(str);
    }
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * 安全地设置元素的文本内容
 * @param {HTMLElement} element - DOM元素
 * @param {string} text - 文本内容
 */
const setTextContent = (element, text) => {
    if (element) {
        element.textContent = text;
    }
};

/**
 * 安全地创建HTML元素并设置属性
 * @param {string} tag - 标签名
 * @param {Object} attributes - 属性对象
 * @param {string} textContent - 文本内容
 * @returns {HTMLElement} 创建的元素
 */
const createElement = (tag, attributes = {}, textContent = '') => {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else {
            element.setAttribute(key, value);
        }
    });
    
    if (textContent) {
        element.textContent = textContent;
    }
    
    return element;
};

/**
 * 验证输入是否为安全字符串
 * @param {string} input - 输入字符串
 * @param {number} maxLength - 最大长度
 * @returns {boolean} 是否安全
 */
const isSafeString = (input, maxLength = 1000) => {
    if (typeof input !== 'string') return false;
    if (input.length > maxLength) return false;
    
    // 检查危险模式
    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /data:/i
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(input));
};

/**
 * 清理用户输入
 * @param {string} input - 输入字符串
 * @param {Object} options - 选项
 * @returns {string} 清理后的字符串
 */
const sanitizeInput = (input, options = {}) => {
    const { 
        maxLength = 1000,
        allowHtml = false,
        trim = true
    } = options;
    
    let result = String(input || '');
    
    if (trim) {
        result = result.trim();
    }
    
    if (result.length > maxLength) {
        result = result.substring(0, maxLength);
    }
    
    if (!allowHtml) {
        result = escapeHtml(result);
    }
    
    return result;
};

window.App.security = {
    escapeHtml,
    setTextContent,
    createElement,
    isSafeString,
    sanitizeInput
};

window.escapeHtml = escapeHtml;
window.sanitizeInput = sanitizeInput;
