/**
 * sceneBackground.js - 场景化背景系统
 *
 * 提供游戏中的动态场景背景：
 * - 多背景预加载与平滑切换
 * - 游戏阶段到背景的自动映射
 * - Canvas 动态氛围效果（雾气、粒子、光线）
 * - 与消息处理器集成，自动响应阶段变化
 *
 * @module SceneBackground
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 背景配置 ====================

/** 背景图片配置：阶段/场景 -> 图片路径映射 */
const BACKGROUND_CONFIG = {
    // 过场/过渡
    'night-falls':  '/static/images/backgrounds/night-falls.webp',
    'dawn-breaks':  '/static/images/backgrounds/dawn-breaks.webp',
    // 游戏阶段
    'night-action': '/static/images/backgrounds/night-action.webp',
    'day-discussion': '/static/images/backgrounds/day-discussion.webp',
    'voting-hall':  '/static/images/backgrounds/voting-hall.webp',
    // 游戏结束
    'game-end-human': '/static/images/backgrounds/game-end-Human.webp',
    'game-end-werewolf': '/static/images/backgrounds/game-end-Werewolf.webp',
};

/** 游戏阶段到背景场景映射 */
const PHASE_BACKGROUND_MAP = {
    // 夜晚阶段
    'night': 'night-action',
    'night-falls': 'night-falls',
    // 白天阶段
    'day': 'day-discussion',
    'dawn-breaks': 'dawn-breaks',
    // 投票阶段
    'vote': 'voting-hall',
    'voting': 'voting-hall',
    // 默认/等待
    'waiting': 'day-discussion',
    'default': 'day-discussion',
};

/** 背景切换动画配置 */
const TRANSITION_CONFIG = {
    duration: 1200,      // 淡入淡出持续时间(ms)
    crossfade: true,     // 是否使用交叉淡入淡出
};

// ==================== 状态管理 ====================

/** 预加载的图片缓存 */
const imageCache = new Map();

/** 当前显示的背景场景ID */
let currentSceneId = null;

/** Canvas 动画帧ID */
let canvasAnimationId = null;

/** 动态效果是否启用 */
let effectsEnabled = true;

// ==================== DOM 元素引用 ====================

let bgContainer = null;
let bgLayerA = null;
let bgLayerB = null;
let activeLayer = 'a';
let canvasOverlay = null;
let sceneCanvasCtx = null;

// ==================== 初始化 ====================

/**
 * 初始化场景背景系统
 * 创建DOM结构、预加载图片、启动Canvas动画
 */
const initSceneBackground = () => {
    console.log('[SceneBackground] Initializing...');

    createBackgroundDOM();
    createCanvasOverlay();
    preloadAllImages();
    startCanvasAnimation();

    console.log('[SceneBackground] Initialized');
};

/**
 * 创建背景图层DOM结构
 * 使用双图层(A/B)实现交叉淡入淡出
 */
const createBackgroundDOM = () => {
    // 移除旧的背景容器（如果存在）
    const oldContainer = document.getElementById('scene-background-container');
    if (oldContainer) oldContainer.remove();

    // 创建新容器
    bgContainer = document.createElement('div');
    bgContainer.id = 'scene-background-container';
    bgContainer.className = 'fixed inset-0 z-0 pointer-events-none';
    bgContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        pointer-events: none;
        overflow: hidden;
    `;

    // 创建两个背景图层用于交叉淡入淡出
    bgLayerA = createBackgroundLayer('bg-layer-a');
    bgLayerB = createBackgroundLayer('bg-layer-b');

    bgContainer.appendChild(bgLayerA);
    bgContainer.appendChild(bgLayerB);

    // 插入到 particles-container 之前
    const particlesContainer = document.getElementById('particles-container');
    if (particlesContainer && particlesContainer.parentNode) {
        particlesContainer.parentNode.insertBefore(bgContainer, particlesContainer);
    } else {
        document.body.insertBefore(bgContainer, document.body.firstChild);
    }
};

/**
 * 创建单个背景图层
 * @param {string} id - 图层ID
 * @returns {HTMLDivElement}
 */
const createBackgroundLayer = (id) => {
    const layer = document.createElement('div');
    layer.id = id;
    layer.className = 'scene-bg-layer';
    layer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: 0;
        transition: opacity ${TRANSITION_CONFIG.duration}ms ease-in-out;
        will-change: opacity;
    `;
    return layer;
};

/**
 * 创建 Canvas 氛围叠加层
 */
const createCanvasOverlay = () => {
    canvasOverlay = document.createElement('canvas');
    canvasOverlay.id = 'scene-canvas-overlay';
    canvasOverlay.className = 'fixed inset-0 z-0 pointer-events-none';
    canvasOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        pointer-events: none;
        opacity: 0.6;
        mix-blend-mode: screen;
    `;

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 插入到 grain-overlay 之前
    const grainOverlay = document.querySelector('.grain-overlay');
    if (grainOverlay && grainOverlay.parentNode) {
        grainOverlay.parentNode.insertBefore(canvasOverlay, grainOverlay);
    } else {
        document.body.appendChild(canvasOverlay);
    }

    sceneCanvasCtx = canvasOverlay.getContext('2d');
};

/**
 * 调整 Canvas 尺寸
 */
const resizeCanvas = () => {
    if (!canvasOverlay) return;
    canvasOverlay.width = window.innerWidth;
    canvasOverlay.height = window.innerHeight;
};

// ==================== 图片预加载 ====================

/**
 * 预加载所有背景图片
 */
const preloadAllImages = () => {
    Object.entries(BACKGROUND_CONFIG).forEach(([sceneId, url]) => {
        const img = new Image();
        img.onload = () => {
            imageCache.set(sceneId, img);
            console.log(`[SceneBackground] Preloaded: ${sceneId}`);
        };
        img.onerror = () => {
            console.warn(`[SceneBackground] Failed to load: ${url}`);
        };
        img.src = url;
    });
};

/**
 * 获取已缓存的图片
 * @param {string} sceneId - 场景ID
 * @returns {HTMLImageElement|null}
 */
const getCachedImage = (sceneId) => {
    return imageCache.get(sceneId) || null;
};

// ==================== 背景切换 ====================

/**
 * 切换到指定场景背景
 * @param {string} sceneId - 场景ID
 * @returns {Promise<void>}
 */
const switchToScene = async (sceneId) => {
    if (!BACKGROUND_CONFIG[sceneId]) {
        console.warn(`[SceneBackground] Unknown scene: ${sceneId}`);
        return;
    }

    if (currentSceneId === sceneId) {
        console.log(`[SceneBackground] Already on scene: ${sceneId}`);
        return;
    }

    console.log(`[SceneBackground] Switching to: ${sceneId}`);

    const targetLayer = activeLayer === 'a' ? bgLayerB : bgLayerA;
    const currentLayer = activeLayer === 'a' ? bgLayerA : bgLayerB;

    // 设置新背景图
    targetLayer.style.backgroundImage = `url(${BACKGROUND_CONFIG[sceneId]})`;

    // 等待图片加载完成（如果未缓存）
    const cachedImg = getCachedImage(sceneId);
    if (!cachedImg) {
        await waitForImageLoad(sceneId);
    }

    // 执行交叉淡入淡出
    targetLayer.style.opacity = '1';
    currentLayer.style.opacity = '0';

    // 切换活跃图层标记
    activeLayer = activeLayer === 'a' ? 'b' : 'a';
    currentSceneId = sceneId;

    // 更新动态效果参数
    updateEffectsForScene(sceneId);

    // 等待过渡完成
    await delay(TRANSITION_CONFIG.duration);
};

/**
 * 等待图片加载完成
 * @param {string} sceneId - 场景ID
 * @returns {Promise<void>}
 */
const waitForImageLoad = (sceneId) => {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (imageCache.has(sceneId)) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);

        // 超时处理（5秒）
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 5000);
    });
};

/**
 * 根据游戏阶段自动切换背景
 * @param {string} phase - 游戏阶段
 * @param {Object} [options] - 额外选项
 */
const switchBackgroundForPhase = async (phase, options = {}) => {
    const sceneId = options.forceScene || PHASE_BACKGROUND_MAP[phase] || PHASE_BACKGROUND_MAP.default;
    await switchToScene(sceneId);
};

// ==================== Canvas 动态效果 ====================

/** 粒子系统状态 */
let particles = [];
let fogParticles = [];
let lightRays = [];
let sceneEffectType = 'default';

/**
 * 更新当前场景的效果类型
 * @param {string} sceneId - 场景ID
 */
const updateEffectsForScene = (sceneId) => {
    // 根据场景设置不同的效果参数
    switch (sceneId) {
        case 'night-falls':
        case 'night-action':
            sceneEffectType = 'night';
            initFogParticles(30, 'dark');
            initLightRays(3, 'moon');
            break;
        case 'dawn-breaks':
        case 'day-discussion':
            sceneEffectType = 'day';
            initFogParticles(15, 'light');
            initLightRays(5, 'sun');
            break;
        case 'voting-hall':
            sceneEffectType = 'voting';
            initFogParticles(20, 'dust');
            initLightRays(2, 'torch');
            break;
        case 'game-end-human':
        case 'game-end-werewolf':
            sceneEffectType = 'ending';
            initFogParticles(25, 'dramatic');
            initLightRays(4, 'divine');
            break;
        default:
            sceneEffectType = 'default';
            initFogParticles(10, 'light');
            initLightRays(0, 'none');
    }
};

/**
 * 初始化雾气粒子
 * @param {number} count - 粒子数量
 * @param {string} style - 样式类型
 */
const initFogParticles = (count, style) => {
    fogParticles = [];
    const colors = {
        dark:   ['rgba(60, 20, 80, 0.15)', 'rgba(20, 10, 40, 0.2)', 'rgba(80, 30, 30, 0.1)'],
        light:  ['rgba(212, 168, 48, 0.08)', 'rgba(255, 255, 255, 0.05)', 'rgba(100, 150, 200, 0.06)'],
        dust:   ['rgba(139, 90, 43, 0.12)', 'rgba(100, 80, 60, 0.15)', 'rgba(160, 140, 100, 0.08)'],
        dramatic: ['rgba(180, 50, 50, 0.15)', 'rgba(212, 168, 48, 0.12)', 'rgba(50, 20, 80, 0.2)'],
    };

    const palette = colors[style] || colors.light;

    for (let i = 0; i < count; i++) {
        fogParticles.push({
            x: Math.random() * canvasOverlay.width,
            y: Math.random() * canvasOverlay.height,
            radius: Math.random() * 100 + 50,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.2 - 0.1,
            color: palette[Math.floor(Math.random() * palette.length)],
            opacity: Math.random() * 0.3 + 0.1,
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: Math.random() * 0.01 + 0.005,
        });
    }
};

/**
 * 初始化光线效果
 * @param {number} count - 光线数量
 * @param {string} type - 光线类型
 */
const initLightRays = (count, type) => {
    lightRays = [];
    if (type === 'none') return;

    const configs = {
        moon: { color: 'rgba(150, 180, 220, 0.08)', width: 80, angle: -30 },
        sun:  { color: 'rgba(255, 220, 150, 0.12)', width: 120, angle: 45 },
        torch: { color: 'rgba(255, 160, 60, 0.1)', width: 60, angle: -15 },
        divine: { color: 'rgba(212, 168, 48, 0.15)', width: 100, angle: 0 },
    };

    const config = configs[type] || configs.sun;

    for (let i = 0; i < count; i++) {
        lightRays.push({
            x: Math.random() * canvasOverlay.width,
            y: -50,
            width: config.width + Math.random() * 40,
            height: canvasOverlay.height + 100,
            angle: config.angle + (Math.random() - 0.5) * 20,
            color: config.color,
            opacity: Math.random() * 0.3 + 0.2,
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: Math.random() * 0.008 + 0.003,
        });
    }
};

/**
 * 启动 Canvas 动画循环
 */
const startCanvasAnimation = () => {
    if (canvasAnimationId) return;

    const animate = () => {
        if (!sceneCanvasCtx || !canvasOverlay) return;

        sceneCanvasCtx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);

        if (effectsEnabled) {
            drawFogParticles();
            drawLightRays();
        }

        canvasAnimationId = requestAnimationFrame(animate);
    };

    animate();
};

/**
 * 绘制雾气粒子
 */
const drawFogParticles = () => {
    fogParticles.forEach(p => {
        // 更新位置
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;

        // 边界处理
        if (p.x < -p.radius) p.x = canvasOverlay.width + p.radius;
        if (p.x > canvasOverlay.width + p.radius) p.x = -p.radius;
        if (p.y < -p.radius) p.y = canvasOverlay.height + p.radius;
        if (p.y > canvasOverlay.height + p.radius) p.y = -p.radius;

        // 脉动透明度
        const pulseOpacity = p.opacity * (0.7 + 0.3 * Math.sin(p.pulse));

        // 绘制径向渐变
        const gradient = sceneCanvasCtx.createRadialGradient(
            p.x, p.y, 0,
            p.x, p.y, p.radius
        );
        gradient.addColorStop(0, p.color.replace(/[\d.]+\)$/, `${pulseOpacity})`));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        sceneCanvasCtx.fillStyle = gradient;
        sceneCanvasCtx.beginPath();
        sceneCanvasCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        sceneCanvasCtx.fill();
    });
};

/**
 * 绘制光线效果
 */
const drawLightRays = () => {
    lightRays.forEach(ray => {
        ray.pulse += ray.pulseSpeed;
        const pulseOpacity = ray.opacity * (0.6 + 0.4 * Math.sin(ray.pulse));

        sceneCanvasCtx.save();
        sceneCanvasCtx.translate(ray.x, ray.y);
        sceneCanvasCtx.rotate((ray.angle * Math.PI) / 180);

        const gradient = sceneCanvasCtx.createLinearGradient(0, 0, 0, ray.height);
        gradient.addColorStop(0, ray.color.replace(/[\d.]+\)$/, `${pulseOpacity})`));
        gradient.addColorStop(0.5, ray.color.replace(/[\d.]+\)$/, `${pulseOpacity * 0.5})`));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        sceneCanvasCtx.fillStyle = gradient;
        sceneCanvasCtx.fillRect(-ray.width / 2, 0, ray.width, ray.height);

        sceneCanvasCtx.restore();
    });
};

/**
 * 停止 Canvas 动画
 */
const stopCanvasAnimation = () => {
    if (canvasAnimationId) {
        cancelAnimationFrame(canvasAnimationId);
        canvasAnimationId = null;
    }
};

// ==================== 导出 ====================

window.App.sceneBackground = {
    init: initSceneBackground,
    switchToScene,
    switchBackgroundForPhase,
    getCurrentScene: () => currentSceneId,
    setEffectsEnabled: (enabled) => { effectsEnabled = enabled; },
    preloadAllImages,
};

// 向后兼容
window.initSceneBackground = initSceneBackground;
window.switchToScene = switchToScene;
window.switchBackgroundForPhase = switchBackgroundForPhase;
