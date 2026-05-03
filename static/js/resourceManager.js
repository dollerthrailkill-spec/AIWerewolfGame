/**
 * resourceManager.js - 资源管理模块
 *
 * 统一管理定时器、事件监听器等资源，防止内存泄漏。
 *
 * @module ResourceManager
 */

window.App = window.App || {};

class ResourceManager {
    constructor() {
        this.timeouts = new Set();
        this.intervals = new Set();
        this.eventListeners = new Map();
        this.animationFrames = new Set();
        this.cleanupCallbacks = [];
    }

    /**
     * 设置定时器
     * @param {Function} callback - 回调函数
     * @param {number} delay - 延迟时间(ms)
     * @returns {number} 定时器ID
     */
    setTimeout(callback, delay) {
        const id = setTimeout(() => {
            this.timeouts.delete(id);
            callback();
        }, delay);
        this.timeouts.add(id);
        return id;
    }

    /**
     * 清除定时器
     * @param {number} id - 定时器ID
     */
    clearTimeout(id) {
        if (this.timeouts.has(id)) {
            clearTimeout(id);
            this.timeouts.delete(id);
        }
    }

    /**
     * 设置间隔定时器
     * @param {Function} callback - 回调函数
     * @param {number} interval - 间隔时间(ms)
     * @returns {number} 间隔定时器ID
     */
    setInterval(callback, interval) {
        const id = setInterval(callback, interval);
        this.intervals.add(id);
        return id;
    }

    /**
     * 清除间隔定时器
     * @param {number} id - 间隔定时器ID
     */
    clearInterval(id) {
        if (this.intervals.has(id)) {
            clearInterval(id);
            this.intervals.delete(id);
        }
    }

    /**
     * 请求动画帧
     * @param {Function} callback - 回调函数
     * @returns {number} 动画帧ID
     */
    requestAnimationFrame(callback) {
        const id = requestAnimationFrame(() => {
            this.animationFrames.delete(id);
            callback();
        });
        this.animationFrames.add(id);
        return id;
    }

    /**
     * 取消动画帧
     * @param {number} id - 动画帧ID
     */
    cancelAnimationFrame(id) {
        if (this.animationFrames.has(id)) {
            cancelAnimationFrame(id);
            this.animationFrames.delete(id);
        }
    }

    /**
     * 添加事件监听器
     * @param {EventTarget} target - 事件目标
     * @param {string} eventType - 事件类型
     * @param {Function} callback - 回调函数
     * @param {Object} [options] - 选项
     */
    addEventListener(target, eventType, callback, options) {
        if (!target) return;
        
        const key = `${target.constructor.name}-${eventType}-${callback.name}`;
        
        target.addEventListener(eventType, callback, options);
        
        if (!this.eventListeners.has(target)) {
            this.eventListeners.set(target, []);
        }
        
        this.eventListeners.get(target).push({ eventType, callback, options });
    }

    /**
     * 移除事件监听器
     * @param {EventTarget} target - 事件目标
     * @param {string} eventType - 事件类型
     * @param {Function} callback - 回调函数
     */
    removeEventListener(target, eventType, callback) {
        if (!target) return;
        
        const listeners = this.eventListeners.get(target);
        if (listeners) {
            const index = listeners.findIndex(l => l.eventType === eventType && l.callback === callback);
            if (index !== -1) {
                const listener = listeners[index];
                target.removeEventListener(eventType, listener.callback, listener.options);
                listeners.splice(index, 1);
                
                if (listeners.length === 0) {
                    this.eventListeners.delete(target);
                }
            }
        }
    }

    /**
     * 添加清理回调
     * @param {Function} callback - 清理回调
     */
    addCleanupCallback(callback) {
        this.cleanupCallbacks.push(callback);
    }

    /**
     * 清理所有资源
     */
    clearAll() {
        // 清除定时器
        this.timeouts.forEach(id => clearTimeout(id));
        this.timeouts.clear();
        
        // 清除间隔定时器
        this.intervals.forEach(id => clearInterval(id));
        this.intervals.clear();
        
        // 清除动画帧
        this.animationFrames.forEach(id => cancelAnimationFrame(id));
        this.animationFrames.clear();
        
        // 清除事件监听器
        this.eventListeners.forEach((listeners, target) => {
            listeners.forEach(({ eventType, callback, options }) => {
                try {
                    target.removeEventListener(eventType, callback, options);
                } catch (e) {
                    // 忽略错误
                }
            });
        });
        this.eventListeners.clear();
        
        // 执行清理回调
        this.cleanupCallbacks.forEach(callback => {
            try {
                callback();
            } catch (e) {
                // 忽略错误
            }
        });
        this.cleanupCallbacks = [];
    }

    /**
     * 获取当前资源数量统计
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            timeouts: this.timeouts.size,
            intervals: this.intervals.size,
            animationFrames: this.animationFrames.size,
            eventTargets: this.eventListeners.size,
            cleanupCallbacks: this.cleanupCallbacks.length
        };
    }
}

// 创建全局资源管理器实例
const resourceManager = new ResourceManager();

window.App.resourceManager = resourceManager;

// 导出常用方法到window，方便迁移
window.safeSetTimeout = (callback, delay) => resourceManager.setTimeout(callback, delay);
window.safeClearTimeout = (id) => resourceManager.clearTimeout(id);
window.safeSetInterval = (callback, interval) => resourceManager.setInterval(callback, interval);
window.safeClearInterval = (id) => resourceManager.clearInterval(id);
window.safeRequestAnimationFrame = (callback) => resourceManager.requestAnimationFrame(callback);
window.safeCancelAnimationFrame = (id) => resourceManager.cancelAnimationFrame(id);
window.safeAddEventListener = (target, eventType, callback, options) => resourceManager.addEventListener(target, eventType, callback, options);
window.safeRemoveEventListener = (target, eventType, callback) => resourceManager.removeEventListener(target, eventType, callback);
window.clearAllResources = () => resourceManager.clearAll();
