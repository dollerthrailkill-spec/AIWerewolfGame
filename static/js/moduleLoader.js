/**
 * moduleLoader.js - 模块加载与依赖管理系统
 *
 * 管理模块初始化顺序和依赖关系。
 *
 * @module ModuleLoader
 */

window.App = window.App || {};

/**
 * 模块注册表
 */
const moduleRegistry = new Map();

/**
 * 已初始化的模块
 */
const initializedModules = new Set();

/**
 * 模块初始化状态
 */
const moduleStates = new Map();

/**
 * 定义模块
 * @param {string} name - 模块名称
 * @param {Object} options - 模块选项
 * @param {string[]} options.depends - 依赖的模块列表
 * @param {Function} options.init - 初始化函数
 * @param {Function} options.destroy - 销毁函数
 */
const defineModule = (name, options) => {
    const { depends = [], init, destroy } = options;
    
    moduleRegistry.set(name, {
        name,
        depends,
        init,
        destroy,
        state: 'registered' // registered, pending, initializing, ready, error
    });
};

/**
 * 检查模块依赖是否满足
 * @param {string[]} depends - 依赖列表
 * @returns {boolean} 是否满足
 */
const checkDependencies = (depends) => {
    return depends.every(dep => initializedModules.has(dep));
};

/**
 * 获取模块初始化顺序（拓扑排序）
 * @returns {string[]} 模块名称列表
 */
const getInitOrder = () => {
    const order = [];
    const visited = new Set();
    const visiting = new Set();
    
    const visit = (name) => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            console.error(`[ModuleLoader] Circular dependency detected: ${name}`);
            return;
        }
        
        visiting.add(name);
        const module = moduleRegistry.get(name);
        if (module) {
            module.depends.forEach(dep => visit(dep));
        }
        visiting.delete(name);
        visited.add(name);
        order.push(name);
    };
    
    moduleRegistry.forEach((_, name) => visit(name));
    return order;
};

/**
 * 初始化单个模块
 * @param {string} name - 模块名称
 * @returns {Promise<boolean>} 是否成功
 */
const initModule = async (name) => {
    if (initializedModules.has(name)) {
        return true;
    }
    
    const module = moduleRegistry.get(name);
    if (!module) {
        console.error(`[ModuleLoader] Module not found: ${name}`);
        return false;
    }
    
    // 检查依赖
    if (!checkDependencies(module.depends)) {
        console.error(`[ModuleLoader] Dependencies not satisfied for: ${name}`, module.depends);
        return false;
    }
    
    try {
        module.state = 'initializing';
        if (module.init) {
            await module.init();
        }
        module.state = 'ready';
        initializedModules.add(name);
        console.log(`[ModuleLoader] Module initialized: ${name}`);
        return true;
    } catch (e) {
        module.state = 'error';
        console.error(`[ModuleLoader] Failed to initialize module: ${name}`, e);
        return false;
    }
};

/**
 * 初始化所有模块
 * @returns {Promise<boolean>} 是否成功
 */
const initAll = async () => {
    const order = getInitOrder();
    console.log(`[ModuleLoader] Initialization order: ${order.join(' -> ')}`);
    
    for (const name of order) {
        const success = await initModule(name);
        if (!success) {
            console.error(`[ModuleLoader] Initialization stopped at: ${name}`);
            return false;
        }
    }
    
    console.log('[ModuleLoader] All modules initialized successfully');
    return true;
};

/**
 * 销毁模块
 * @param {string} name - 模块名称
 */
const destroyModule = async (name) => {
    const module = moduleRegistry.get(name);
    if (!module) return;
    
    try {
        if (module.destroy) {
            await module.destroy();
        }
        initializedModules.delete(name);
        module.state = 'registered';
        console.log(`[ModuleLoader] Module destroyed: ${name}`);
    } catch (e) {
        console.error(`[ModuleLoader] Failed to destroy module: ${name}`, e);
    }
};

/**
 * 销毁所有模块
 */
const destroyAll = async () => {
    const order = [...getInitOrder()].reverse();
    
    for (const name of order) {
        await destroyModule(name);
    }
    
    console.log('[ModuleLoader] All modules destroyed');
};

/**
 * 检查模块是否已初始化
 * @param {string} name - 模块名称
 * @returns {boolean} 是否已初始化
 */
const isModuleReady = (name) => initializedModules.has(name);

/**
 * 获取模块状态
 * @param {string} name - 模块名称
 * @returns {string|null} 模块状态
 */
const getModuleState = (name) => {
    const module = moduleRegistry.get(name);
    return module ? module.state : null;
};

/**
 * 等待模块初始化完成
 * @param {string} name - 模块名称
 * @param {number} [timeout=10000] - 超时时间(ms)
 * @returns {Promise<boolean>} 是否成功
 */
const waitForModule = (name, timeout = 10000) => {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const check = () => {
            if (isModuleReady(name)) {
                resolve(true);
                return;
            }
            
            if (Date.now() - startTime > timeout) {
                console.warn(`[ModuleLoader] Wait for module timeout: ${name}`);
                resolve(false);
                return;
            }
            
            requestAnimationFrame(check);
        };
        
        check();
    });
};

window.App.moduleLoader = {
    defineModule,
    initModule,
    initAll,
    destroyModule,
    destroyAll,
    isModuleReady,
    getModuleState,
    waitForModule,
    getInitOrder
};

// 导出到全局
window.defineModule = window.App.moduleLoader.defineModule;
window.initModules = window.App.moduleLoader.initAll;
