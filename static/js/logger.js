/**
 * logger.js - 日志管理模块
 *
 * 统一管理日志输出，支持不同日志级别和日志持久化。
 *
 * @module Logger
 */

window.App = window.App || {};

/**
 * 日志级别枚举
 */
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

/**
 * 日志配置
 */
let config = {
    level: LOG_LEVELS.INFO,
    maxEntries: 1000,
    enableConsole: true,
    enableMemoryLog: true,
    prefix: '[WolfGame]'
};

/**
 * 内存日志存储
 */
const memoryLog = [];

/**
 * 格式化日志消息
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {any[]} args - 额外参数
 * @returns {string} 格式化后的消息
 */
const formatMessage = (level, message, args) => {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    return `${config.prefix} [${levelStr}] [${timestamp}] ${message}`;
};

/**
 * 添加日志条目
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {any[]} args - 额外参数
 */
const addLogEntry = (level, message, args) => {
    if (!config.enableMemoryLog) return;
    
    const entry = {
        level,
        message,
        args: args.length > 0 ? [...args] : undefined,
        timestamp: new Date().toISOString()
    };
    
    memoryLog.push(entry);
    
    // 限制日志数量
    while (memoryLog.length > config.maxEntries) {
        memoryLog.shift();
    }
};

/**
 * 输出调试日志
 * @param {string} message - 日志消息
 * @param {...any} args - 额外参数
 */
const debug = (message, ...args) => {
    if (config.level > LOG_LEVELS.DEBUG) return;
    
    const formatted = formatMessage('DEBUG', message, args);
    addLogEntry('debug', message, args);
    
    if (config.enableConsole) {
        console.debug(formatted, ...args);
    }
};

/**
 * 输出信息日志
 * @param {string} message - 日志消息
 * @param {...any} args - 额外参数
 */
const info = (message, ...args) => {
    if (config.level > LOG_LEVELS.INFO) return;
    
    const formatted = formatMessage('INFO', message, args);
    addLogEntry('info', message, args);
    
    if (config.enableConsole) {
        console.info(formatted, ...args);
    }
};

/**
 * 输出警告日志
 * @param {string} message - 日志消息
 * @param {...any} args - 额外参数
 */
const warn = (message, ...args) => {
    if (config.level > LOG_LEVELS.WARN) return;
    
    const formatted = formatMessage('WARN', message, args);
    addLogEntry('warn', message, args);
    
    if (config.enableConsole) {
        console.warn(formatted, ...args);
    }
};

/**
 * 输出错误日志
 * @param {string} message - 日志消息
 * @param {...any} args - 额外参数
 */
const error = (message, ...args) => {
    if (config.level > LOG_LEVELS.ERROR) return;
    
    const formatted = formatMessage('ERROR', message, args);
    addLogEntry('error', message, args);
    
    if (config.enableConsole) {
        console.error(formatted, ...args);
    }
};

/**
 * 设置日志级别
 * @param {string|number} level - 日志级别
 */
const setLevel = (level) => {
    if (typeof level === 'string') {
        config.level = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
    } else if (typeof level === 'number') {
        config.level = Math.max(0, Math.min(4, level));
    }
};

/**
 * 获取当前日志级别
 * @returns {number} 当前日志级别
 */
const getLevel = () => config.level;

/**
 * 更新配置
 * @param {Object} newConfig - 新配置
 */
const setConfig = (newConfig) => {
    config = { ...config, ...newConfig };
};

/**
 * 获取内存日志
 * @param {string} [filterLevel] - 过滤级别
 * @returns {Object[]} 日志条目数组
 */
const getMemoryLog = (filterLevel) => {
    if (!filterLevel) {
        return [...memoryLog];
    }
    return memoryLog.filter(entry => entry.level === filterLevel.toLowerCase());
};

/**
 * 清空内存日志
 */
const clearMemoryLog = () => {
    memoryLog.length = 0;
};

/**
 * 导出日志为JSON字符串
 * @param {string} [filterLevel] - 过滤级别
 * @returns {string} JSON字符串
 */
const exportLogs = (filterLevel) => {
    const logs = filterLevel ? getMemoryLog(filterLevel) : getMemoryLog();
    return JSON.stringify({
        exportedAt: new Date().toISOString(),
        logCount: logs.length,
        logs: logs
    }, null, 2);
};

/**
 * 下载日志文件
 * @param {string} [filterLevel] - 过滤级别
 */
const downloadLogs = (filterLevel) => {
    const jsonContent = exportLogs(filterLevel);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wolfgame-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.App.logger = {
    LOG_LEVELS,
    debug,
    info,
    warn,
    error,
    setLevel,
    getLevel,
    setConfig,
    getMemoryLog,
    clearMemoryLog,
    exportLogs,
    downloadLogs
};

// 导出到全局，方便迁移
window.logger = window.App.logger;
window.logDebug = debug;
window.logInfo = info;
window.logWarn = warn;
window.logError = error;
