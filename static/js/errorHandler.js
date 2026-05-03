/**
 * errorHandler.js - 错误处理与恢复模块
 *
 * 统一错误处理、错误恢复和用户友好的错误提示。
 *
 * @module ErrorHandler
 */

window.App = window.App || {};

/**
 * 错误类型枚举
 */
const ERROR_TYPES = {
    NETWORK: 'network',
    WEBSOCKET: 'websocket',
    API: 'api',
    VALIDATION: 'validation',
    STORAGE: 'storage',
    UNKNOWN: 'unknown'
};

/**
 * 错误历史记录
 */
const errorHistory = [];
const MAX_ERROR_HISTORY = 100;

/**
 * 错误恢复策略
 */
const RECOVERY_STRATEGIES = {
    [ERROR_TYPES.NETWORK]: {
        retryCount: 3,
        retryDelay: 2000,
        canRetry: true
    },
    [ERROR_TYPES.WEBSOCKET]: {
        retryCount: 10,
        retryDelay: 1000,
        maxRetryDelay: 30000,
        canRetry: true,
        exponentialBackoff: true
    },
    [ERROR_TYPES.API]: {
        retryCount: 3,
        retryDelay: 1000,
        canRetry: true
    },
    [ERROR_TYPES.VALIDATION]: {
        canRetry: false,
        showToUser: true
    },
    [ERROR_TYPES.STORAGE]: {
        canRetry: true,
        retryDelay: 500,
        retryCount: 2
    },
    [ERROR_TYPES.UNKNOWN]: {
        canRetry: false,
        showToUser: true
    }
};

/**
 * 用户友好的错误消息映射
 */
const USER_FRIENDLY_MESSAGES = {
    [ERROR_TYPES.NETWORK]: '网络连接失败，请检查网络连接后重试',
    [ERROR_TYPES.WEBSOCKET]: '服务器连接断开，正在尝试重连...',
    [ERROR_TYPES.API]: '请求服务器失败，请稍后重试',
    [ERROR_TYPES.VALIDATION]: '输入验证失败，请检查您的输入',
    [ERROR_TYPES.STORAGE]: '数据存储失败，请清理浏览器缓存后重试',
    [ERROR_TYPES.UNKNOWN]: '发生了一个未知错误，请刷新页面重试'
};

/**
 * 记录错误
 * @param {string} type - 错误类型
 * @param {Error|string} error - 错误对象或消息
 * @param {Object} [context={}] - 错误上下文
 * @returns {Object} 错误条目
 */
const recordError = (type, error, context = {}) => {
    const entry = {
        id: Date.now(),
        type,
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { ...context },
        url: window.location.href,
        userAgent: navigator.userAgent
    };
    
    errorHistory.push(entry);
    
    // 限制历史记录数量
    while (errorHistory.length > MAX_ERROR_HISTORY) {
        errorHistory.shift();
    }
    
    // 记录到日志
    console.error('[ErrorHandler] 记录错误:', type, entry.message, context);
    if (entry.stack) {
        console.error('[ErrorHandler] 错误堆栈:', entry.stack);
    }
    
    if (window.App.logger && typeof window.App.logger.error === 'function') {
        try {
            window.App.logger.error(`[${type}] ${entry.message}`, context);
        } catch (e) {
            console.error('[ErrorHandler] 记录到 logger 失败:', e);
        }
    }
    
    return entry;
};

/**
 * 显示错误通知给用户
 * @param {string} type - 错误类型
 * @param {string} [customMessage] - 自定义消息
 * @param {Object} [options] - 选项
 */
const showErrorNotification = (type, customMessage, options = {}) => {
    const {
        duration = 5000,
        showRetry = true,
        onRetry = null
    } = options;
    
    const message = customMessage || USER_FRIENDLY_MESSAGES[type] || USER_FRIENDLY_MESSAGES[ERROR_TYPES.UNKNOWN];
    
    // 尝试使用现有的 UI 函数
    try {
        if (window.App.ui && typeof window.App.ui.showCenterBanner === 'function') {
            window.App.ui.showCenterBanner('⚠️ 错误', message, 'error-banner', duration);
            return;
        }
    } catch (e) {
        console.warn('[ErrorHandler] UI 通知失败，使用降级方案', e);
    }
    
    // 降级方案：直接使用 console.log 输出错误而不是 alert，避免阻塞
    console.warn('[ErrorHandler] 错误通知:', message);
};

/**
 * 处理错误
 * @param {string} type - 错误类型
 * @param {Error|string} error - 错误对象或消息
 * @param {Object} [options] - 选项
 * @returns {Promise<boolean>} 是否成功恢复
 */
const handleError = async (type, error, options = {}) => {
    try {
        const {
            showNotification = true,
            recordInHistory = true,
            attemptRecovery = true,
            customMessage = null,
            context = {}
        } = options;
        
        // 记录错误
        if (recordInHistory) {
            recordError(type, error, context);
        }
        
        // 显示通知
        if (showNotification) {
            showErrorNotification(type, customMessage);
        }
        
        // 尝试恢复
        if (attemptRecovery) {
            const strategy = RECOVERY_STRATEGIES[type] || RECOVERY_STRATEGIES[ERROR_TYPES.UNKNOWN] || { canRetry: false };
            if (strategy && strategy.canRetry && options.retryCallback) {
                return await attemptRetry(strategy, options.retryCallback);
            }
        }
        
        return false;
    } catch (e) {
        console.error('[ErrorHandler] handleError 自身出错:', e);
        return false;
    }
};

/**
 * 尝试重试操作
 * @param {Object} strategy - 重试策略
 * @param {Function} callback - 重试回调
 * @returns {Promise<boolean>} 是否成功
 */
const attemptRetry = async (strategy, callback) => {
    const {
        retryCount = 3,
        retryDelay = 1000,
        maxRetryDelay = 30000,
        exponentialBackoff = false
    } = strategy;
    
    for (let attempt = 0; attempt < retryCount; attempt++) {
        try {
            const result = await callback(attempt);
            if (result !== false) {
                if (window.App.logger) {
                    window.App.logger.info(`Recovery successful on attempt ${attempt + 1}`);
                }
                return true;
            }
        } catch (e) {
            if (window.App.logger) {
                window.App.logger.warn(`Recovery attempt ${attempt + 1} failed`, e);
            }
        }
        
        // 计算延迟
        let delay = retryDelay;
        if (exponentialBackoff) {
            delay = Math.min(retryDelay * Math.pow(2, attempt), maxRetryDelay);
        }
        
        // 等待
        await new Promise(resolve => {
            if (window.App.resourceManager) {
                window.App.resourceManager.setTimeout(resolve, delay);
            } else {
                setTimeout(resolve, delay);
            }
        });
    }
    
    return false;
};

/**
 * 获取错误历史
 * @param {string} [filterType] - 按类型过滤
 * @returns {Object[]} 错误历史
 */
const getErrorHistory = (filterType) => {
    if (filterType) {
        return errorHistory.filter(e => e.type === filterType);
    }
    return [...errorHistory];
};

/**
 * 清空错误历史
 */
const clearErrorHistory = () => {
    errorHistory.length = 0;
};

/**
 * 导出错误报告
 * @returns {string} JSON 字符串
 */
const exportErrorReport = () => {
    return JSON.stringify({
        generatedAt: new Date().toISOString(),
        errorCount: errorHistory.length,
        errors: errorHistory,
        environment: {
            url: window.location.href,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language
        }
    }, null, 2);
};

/**
 * 下载错误报告
 */
const downloadErrorReport = () => {
    const jsonContent = exportErrorReport();
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wolfgame-errors-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * 包装异步函数以自动处理错误
 * @param {Function} fn - 要包装的函数
 * @param {string} errorType - 错误类型
 * @param {Object} [options] - 选项
 * @returns {Function} 包装后的函数
 */
const wrapAsync = (fn, errorType, options = {}) => {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (e) {
            await handleError(errorType, e, {
                ...options,
                context: { args }
            });
            throw e;
        }
    };
};

/**
 * 包装同步函数以自动处理错误
 * @param {Function} fn - 要包装的函数
 * @param {string} errorType - 错误类型
 * @param {Object} [options] - 选项
 * @returns {Function} 包装后的函数
 */
const wrapSync = (fn, errorType, options = {}) => {
    return (...args) => {
        try {
            return fn(...args);
        } catch (e) {
            handleError(errorType, e, {
                ...options,
                context: { args }
            });
            throw e;
        }
    };
};

// 设置全局错误处理器
window.addEventListener('error', async (event) => {
    await handleError(ERROR_TYPES.UNKNOWN, event.error || event.message, {
        context: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        }
    });
});

window.addEventListener('unhandledrejection', async (event) => {
    await handleError(ERROR_TYPES.UNKNOWN, event.reason || 'Unhandled promise rejection', {
        context: {
            promise: event.promise
        }
    });
});

window.App.errorHandler = {
    ERROR_TYPES,
    RECOVERY_STRATEGIES,
    recordError,
    showErrorNotification,
    handleError,
    attemptRetry,
    getErrorHistory,
    clearErrorHistory,
    exportErrorReport,
    downloadErrorReport,
    wrapAsync,
    wrapSync
};

// 导出到全局
window.handleError = window.App.errorHandler.handleError;
window.recordError = window.App.errorHandler.recordError;
