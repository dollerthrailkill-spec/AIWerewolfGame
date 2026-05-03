/**
 * cinematicTransitions.js - 电影感过场动画系统
 *
 * 提供游戏中的电影级过场动画：
 * - 血月升起（夜晚降临）
 * - 黎明破晓（白天到来）
 * - 审判之锤（投票阶段）
 * - 通用文字动画（金属质感字幕）
 *
 * 所有动画时长约5秒，支持跳过功能
 *
 * @module CinematicTransitions
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 配置 ====================

/** 动画默认配置 */
const CINEMATIC_CONFIG = {
    defaultDuration: 5000,    // 默认动画时长(ms)
    skipEnabled: true,        // 是否允许跳过
    textDisplayDuration: 2500, // 文字显示时长(ms)
};

// ==================== DOM 元素引用 ====================

let cinematicContainer = null;
let cinematicCanvas = null;
let cinematicCanvasCtx = null;
let isAnimating = false;
let currentAnimationId = null;
let skipResolve = null;

// ==================== 初始化 ====================

/**
 * 初始化电影感过场动画系统
 */
const initCinematicTransitions = () => {
    console.log('[CinematicTransitions] Initializing...');

    createCinematicDOM();
    console.log('[CinematicTransitions] Initialized');
};

/**
 * 创建过场动画DOM结构
 */
const createCinematicDOM = () => {
    // 移除旧容器（如果存在）
    const oldContainer = document.getElementById('cinematic-container');
    if (oldContainer) oldContainer.remove();

    // 创建主容器
    cinematicContainer = document.createElement('div');
    cinematicContainer.id = 'cinematic-container';
    cinematicContainer.className = 'fixed inset-0 z-[60] pointer-events-none hidden';
    cinematicContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 60;
        pointer-events: none;
        overflow: hidden;
    `;

    // 创建Canvas用于绘制特效
    cinematicCanvas = document.createElement('canvas');
    cinematicCanvas.id = 'cinematic-canvas';
    cinematicCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    `;

    // 创建文字容器
    const textContainer = document.createElement('div');
    textContainer.id = 'cinematic-text-container';
    textContainer.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        z-index: 2;
        pointer-events: none;
    `;

    // 创建跳过提示
    const skipHint = document.createElement('div');
    skipHint.id = 'cinematic-skip-hint';
    skipHint.style.cssText = `
        position: absolute;
        bottom: 40px;
        right: 40px;
        font-size: 12px;
        color: rgba(212, 168, 48, 0.5);
        letter-spacing: 2px;
        opacity: 0;
        transition: opacity 0.5s;
        pointer-events: auto;
        cursor: pointer;
        z-index: 3;
    `;
    skipHint.textContent = '点击跳过';
    skipHint.addEventListener('click', skipAnimation);

    cinematicContainer.appendChild(cinematicCanvas);
    cinematicContainer.appendChild(textContainer);
    cinematicContainer.appendChild(skipHint);
    document.body.appendChild(cinematicContainer);

    // 设置Canvas尺寸
    resizeCinematicCanvas();
    window.addEventListener('resize', resizeCinematicCanvas);

    cinematicCanvasCtx = cinematicCanvas.getContext('2d');
};

/**
 * 调整Canvas尺寸
 */
const resizeCinematicCanvas = () => {
    if (!cinematicCanvas) return;
    cinematicCanvas.width = window.innerWidth;
    cinematicCanvas.height = window.innerHeight;
};

// ==================== 核心动画控制 ====================

/**
 * 显示过场动画容器
 */
const showContainer = () => {
    if (cinematicContainer) {
        cinematicContainer.classList.remove('hidden');
        cinematicContainer.style.pointerEvents = 'auto';
    }
};

/**
 * 隐藏过场动画容器
 */
const hideContainer = () => {
    if (cinematicContainer) {
        cinematicContainer.classList.add('hidden');
        cinematicContainer.style.pointerEvents = 'none';
    }
    // 清空文字
    const textContainer = document.getElementById('cinematic-text-container');
    if (textContainer) textContainer.innerHTML = '';
};

/**
 * 跳过当前动画
 */
const skipAnimation = () => {
    if (!isAnimating || !CINEMATIC_CONFIG.skipEnabled) return;

    console.log('[CinematicTransitions] Animation skipped');
    isAnimating = false;

    if (currentAnimationId) {
        cancelAnimationFrame(currentAnimationId);
        currentAnimationId = null;
    }

    if (skipResolve) {
        skipResolve();
        skipResolve = null;
    }

    hideContainer();
};

/**
 * 显示跳过提示
 */
const showSkipHint = () => {
    const skipHint = document.getElementById('cinematic-skip-hint');
    if (skipHint) {
        setTimeout(() => {
            skipHint.style.opacity = '1';
        }, 1000);
    }
};

/**
 * 隐藏跳过提示
 */
const hideSkipHint = () => {
    const skipHint = document.getElementById('cinematic-skip-hint');
    if (skipHint) skipHint.style.opacity = '0';
};

// ==================== 文字动画 ====================

/**
 * 创建电影级文字元素
 * @param {string} text - 显示文字
 * @param {string} [subText] - 副标题
 */
const createCinematicText = (text, subText) => {
    const container = document.getElementById('cinematic-text-container');
    if (!container) return;

    container.innerHTML = '';

    // 主标题
    const mainText = document.createElement('div');
    mainText.className = 'cinematic-main-text';
    mainText.textContent = text;
    mainText.style.cssText = `
        font-family: 'Cinzel', serif;
        font-size: clamp(2rem, 6vw, 4.5rem);
        font-weight: 700;
        color: #d4a830;
        letter-spacing: 0.15em;
        text-shadow: 0 0 30px rgba(212, 168, 48, 0.5), 0 0 60px rgba(212, 168, 48, 0.2);
        opacity: 0;
        transform: translateY(30px) scale(0.9);
        transition: all 1.2s cubic-bezier(0.22, 1, 0.36, 1);
        white-space: nowrap;
    `;

    container.appendChild(mainText);

    // 副标题
    if (subText) {
        const subTitle = document.createElement('div');
        subTitle.className = 'cinematic-sub-text';
        subTitle.textContent = subText;
        subTitle.style.cssText = `
            font-family: 'Noto Sans SC', sans-serif;
            font-size: clamp(0.8rem, 2vw, 1.2rem);
            color: rgba(212, 168, 48, 0.6);
            letter-spacing: 0.3em;
            margin-top: 16px;
            opacity: 0;
            transform: translateY(20px);
            transition: all 1s cubic-bezier(0.22, 1, 0.36, 1) 0.3s;
        `;
        container.appendChild(subTitle);
    }

    // 触发显示动画
    requestAnimationFrame(() => {
        mainText.style.opacity = '1';
        mainText.style.transform = 'translateY(0) scale(1)';
        if (subText) {
            const subEl = container.querySelector('.cinematic-sub-text');
            if (subEl) {
                subEl.style.opacity = '1';
                subEl.style.transform = 'translateY(0)';
            }
        }
    });

    return { mainText, subTitle: container.querySelector('.cinematic-sub-text') };
};

/**
 * 隐藏文字
 */
const hideCinematicText = () => {
    const container = document.getElementById('cinematic-text-container');
    if (!container) return;

    const texts = container.querySelectorAll('div');
    texts.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-20px)';
    });
};

// ==================== 血月升起动画（夜晚降临） ====================

/**
 * 播放血月升起过场动画
 * @returns {Promise<void>}
 */
const playBloodMoonRise = () => {
    return new Promise((resolve) => {
        if (isAnimating) {
            console.warn('[CinematicTransitions] Another animation is running');
            resolve();
            return;
        }

        isAnimating = true;
        skipResolve = resolve;
        showContainer();
        showSkipHint();

        const startTime = Date.now();
        const duration = CINEMATIC_CONFIG.defaultDuration;
        const canvas = cinematicCanvas;
        const ctx = cinematicCanvasCtx;

        // 动画状态
        let moonY = canvas.height + 200;
        const moonTargetY = canvas.height * 0.25;
        const moonRadius = Math.min(canvas.width, canvas.height) * 0.18;
        let skyDarkness = 0;
        let stars = [];

        // 初始化星星
        for (let i = 0; i < 150; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height * 0.7,
                size: Math.random() * 2 + 0.5,
                twinkle: Math.random() * Math.PI * 2,
                twinkleSpeed: Math.random() * 0.02 + 0.01,
            });
        }

        // 显示文字
        setTimeout(() => {
            createCinematicText('夜幕降临', 'NIGHT FALLS');
        }, 500);

        const animate = () => {
            if (!isAnimating) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic

            // 清空画布
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 绘制渐变夜空
            skyDarkness = easeProgress * 0.95;
            const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            skyGradient.addColorStop(0, `rgba(5, 5, 15, ${skyDarkness})`);
            skyGradient.addColorStop(0.5, `rgba(10, 8, 20, ${skyDarkness * 0.9})`);
            skyGradient.addColorStop(1, `rgba(20, 10, 15, ${skyDarkness * 0.8})`);
            ctx.fillStyle = skyGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 绘制星星
            stars.forEach(star => {
                star.twinkle += star.twinkleSpeed;
                const opacity = (0.3 + 0.7 * Math.sin(star.twinkle)) * easeProgress;
                ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });

            // 绘制血月
            moonY = canvas.height + 200 - (canvas.height + 200 - moonTargetY) * easeProgress;

            // 月光辉光
            const glowGradient = ctx.createRadialGradient(
                canvas.width * 0.7, moonY, 0,
                canvas.width * 0.7, moonY, moonRadius * 3
            );
            glowGradient.addColorStop(0, `rgba(180, 40, 40, ${0.3 * easeProgress})`);
            glowGradient.addColorStop(0.5, `rgba(150, 30, 30, ${0.1 * easeProgress})`);
            glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glowGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 月亮本体
            const moonGradient = ctx.createRadialGradient(
                canvas.width * 0.7 - moonRadius * 0.3, moonY - moonRadius * 0.3, 0,
                canvas.width * 0.7, moonY, moonRadius
            );
            moonGradient.addColorStop(0, `rgba(220, 80, 80, ${easeProgress})`);
            moonGradient.addColorStop(0.7, `rgba(180, 40, 40, ${easeProgress})`);
            moonGradient.addColorStop(1, `rgba(120, 20, 20, ${easeProgress})`);

            ctx.fillStyle = moonGradient;
            ctx.beginPath();
            ctx.arc(canvas.width * 0.7, moonY, moonRadius, 0, Math.PI * 2);
            ctx.fill();

            // 月亮纹理（陨石坑）
            ctx.fillStyle = `rgba(100, 20, 20, ${0.3 * easeProgress})`;
            ctx.beginPath();
            ctx.arc(canvas.width * 0.7 - moonRadius * 0.2, moonY + moonRadius * 0.1, moonRadius * 0.15, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(canvas.width * 0.7 + moonRadius * 0.3, moonY - moonRadius * 0.2, moonRadius * 0.1, 0, Math.PI * 2);
            ctx.fill();

            // 绘制云层（暗红色）
            const cloudOpacity = easeProgress * 0.3;
            ctx.fillStyle = `rgba(80, 20, 30, ${cloudOpacity})`;
            for (let i = 0; i < 5; i++) {
                const cloudX = (canvas.width * 0.2 * i + elapsed * 0.02) % (canvas.width + 200) - 100;
                const cloudY = canvas.height * 0.3 + Math.sin(i * 1.5) * 50;
                ctx.beginPath();
                ctx.ellipse(cloudX, cloudY, 120, 40, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            if (progress < 1 && isAnimating) {
                currentAnimationId = requestAnimationFrame(animate);
            } else if (isAnimating) {
                // 动画完成
                setTimeout(() => {
                    hideCinematicText();
                    setTimeout(() => {
                        hideContainer();
                        hideSkipHint();
                        isAnimating = false;
                        skipResolve = null;
                        resolve();
                    }, 800);
                }, CINEMATIC_CONFIG.textDisplayDuration);
            }
        };

        animate();
    });
};

// ==================== 黎明破晓动画（白天到来） ====================

/**
 * 播放黎明破晓过场动画
 * @returns {Promise<void>}
 */
const playDawnBreaks = () => {
    return new Promise((resolve) => {
        if (isAnimating) {
            console.warn('[CinematicTransitions] Another animation is running');
            resolve();
            return;
        }

        isAnimating = true;
        skipResolve = resolve;
        showContainer();
        showSkipHint();

        const startTime = Date.now();
        const duration = CINEMATIC_CONFIG.defaultDuration;
        const canvas = cinematicCanvas;
        const ctx = cinematicCanvasCtx;

        // 光线状态
        let rayProgress = 0;
        let lightIntensity = 0;

        // 显示文字
        setTimeout(() => {
            createCinematicText('黎明破晓', 'DAWN BREAKS');
        }, 500);

        const animate = () => {
            if (!isAnimating) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 绘制夜空到白天的渐变
            const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            const nightOpacity = Math.max(0, 1 - easeProgress * 1.5);
            const dawnOpacity = Math.min(1, easeProgress * 1.2);

            skyGradient.addColorStop(0, `rgba(10, 15, 35, ${nightOpacity})`);
            skyGradient.addColorStop(0.3, `rgba(40, 30, 60, ${nightOpacity * 0.8})`);
            skyGradient.addColorStop(0.5, `rgba(80, 60, 100, ${dawnOpacity * 0.5})`);
            skyGradient.addColorStop(0.7, `rgba(150, 100, 80, ${dawnOpacity * 0.7})`);
            skyGradient.addColorStop(1, `rgba(200, 160, 100, ${dawnOpacity * 0.8})`);
            ctx.fillStyle = skyGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 绘制光线从顶部射入
            lightIntensity = easeProgress;
            const rayCount = 7;
            for (let i = 0; i < rayCount; i++) {
                const rayX = canvas.width * (0.2 + 0.6 * (i / (rayCount - 1)));
                const rayWidth = 30 + Math.sin(i * 2) * 15;
                const rayLength = canvas.height * 0.8 * easeProgress;

                const rayGradient = ctx.createLinearGradient(rayX, 0, rayX + 50, rayLength);
                rayGradient.addColorStop(0, `rgba(255, 220, 150, ${0.3 * lightIntensity})`);
                rayGradient.addColorStop(0.5, `rgba(255, 200, 100, ${0.15 * lightIntensity})`);
                rayGradient.addColorStop(1, 'rgba(255, 180, 80, 0)');

                ctx.fillStyle = rayGradient;
                ctx.beginPath();
                ctx.moveTo(rayX - rayWidth / 2, 0);
                ctx.lineTo(rayX + rayWidth / 2, 0);
                ctx.lineTo(rayX + rayWidth / 2 + 30, rayLength);
                ctx.lineTo(rayX - rayWidth / 2 + 30, rayLength);
                ctx.closePath();
                ctx.fill();
            }

            // 绘制太阳（从顶部升起）
            const sunY = -100 + (canvas.height * 0.2 + 100) * easeProgress;
            const sunRadius = Math.min(canvas.width, canvas.height) * 0.12;

            // 太阳光晕
            const sunGlow = ctx.createRadialGradient(
                canvas.width * 0.5, sunY, 0,
                canvas.width * 0.5, sunY, sunRadius * 4
            );
            sunGlow.addColorStop(0, `rgba(255, 220, 150, ${0.4 * lightIntensity})`);
            sunGlow.addColorStop(0.5, `rgba(255, 180, 80, ${0.15 * lightIntensity})`);
            sunGlow.addColorStop(1, 'rgba(255, 160, 60, 0)');
            ctx.fillStyle = sunGlow;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 太阳本体
            const sunGradient = ctx.createRadialGradient(
                canvas.width * 0.5 - sunRadius * 0.2, sunY - sunRadius * 0.2, 0,
                canvas.width * 0.5, sunY, sunRadius
            );
            sunGradient.addColorStop(0, `rgba(255, 240, 200, ${lightIntensity})`);
            sunGradient.addColorStop(0.7, `rgba(255, 200, 100, ${lightIntensity})`);
            sunGradient.addColorStop(1, `rgba(255, 160, 60, ${lightIntensity})`);

            ctx.fillStyle = sunGradient;
            ctx.beginPath();
            ctx.arc(canvas.width * 0.5, sunY, sunRadius, 0, Math.PI * 2);
            ctx.fill();

            // 驱散黑暗的粒子效果
            if (progress > 0.3) {
                const particleProgress = (progress - 0.3) / 0.7;
                for (let i = 0; i < 30; i++) {
                    const angle = (i / 30) * Math.PI * 2 + elapsed * 0.001;
                    const distance = particleProgress * canvas.width * 0.4;
                    const px = canvas.width * 0.5 + Math.cos(angle) * distance;
                    const py = canvas.height * 0.5 + Math.sin(angle) * distance * 0.5;

                    ctx.fillStyle = `rgba(255, 220, 150, ${particleProgress * 0.5})`;
                    ctx.beginPath();
                    ctx.arc(px, py, 2 + particleProgress * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            if (progress < 1 && isAnimating) {
                currentAnimationId = requestAnimationFrame(animate);
            } else if (isAnimating) {
                setTimeout(() => {
                    hideCinematicText();
                    setTimeout(() => {
                        hideContainer();
                        hideSkipHint();
                        isAnimating = false;
                        skipResolve = null;
                        resolve();
                    }, 800);
                }, CINEMATIC_CONFIG.textDisplayDuration);
            }
        };

        animate();
    });
};

// ==================== 审判之锤动画（投票阶段） ====================

/**
 * 播放审判之锤过场动画
 * @returns {Promise<void>}
 */
const playJudgmentHammer = () => {
    return new Promise((resolve) => {
        if (isAnimating) {
            console.warn('[CinematicTransitions] Another animation is running');
            resolve();
            return;
        }

        isAnimating = true;
        skipResolve = resolve;
        showContainer();
        showSkipHint();

        const startTime = Date.now();
        const duration = CINEMATIC_CONFIG.defaultDuration;
        const canvas = cinematicCanvas;
        const ctx = cinematicCanvasCtx;

        // 显示文字
        setTimeout(() => {
            createCinematicText('投票审判', 'JUDGMENT');
        }, 500);

        const animate = () => {
            if (!isAnimating) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 绘制审判厅背景氛围
            const bgGradient = ctx.createRadialGradient(
                canvas.width * 0.5, canvas.height * 0.3, 0,
                canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.8
            );
            bgGradient.addColorStop(0, `rgba(40, 30, 20, ${0.9 * easeProgress})`);
            bgGradient.addColorStop(0.5, `rgba(20, 15, 10, ${0.95 * easeProgress})`);
            bgGradient.addColorStop(1, `rgba(10, 8, 5, ${easeProgress})`);
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 绘制法槌
            const hammerX = canvas.width * 0.5;
            const hammerY = canvas.height * 0.4;
            const hammerScale = 0.8 + 0.2 * easeProgress;

            // 法槌头部
            ctx.save();
            ctx.translate(hammerX, hammerY);
            ctx.scale(hammerScale, hammerScale);

            // 槌头阴影
            ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * easeProgress})`;
            ctx.fillRect(-80, 20, 160, 30);

            // 槌头
            const hammerGradient = ctx.createLinearGradient(-80, -30, 80, 30);
            hammerGradient.addColorStop(0, `rgba(120, 80, 40, ${easeProgress})`);
            hammerGradient.addColorStop(0.5, `rgba(160, 110, 60, ${easeProgress})`);
            hammerGradient.addColorStop(1, `rgba(100, 70, 35, ${easeProgress})`);
            ctx.fillStyle = hammerGradient;
            ctx.fillRect(-80, -30, 160, 60);

            // 槌头金色装饰
            ctx.fillStyle = `rgba(212, 168, 48, ${0.8 * easeProgress})`;
            ctx.fillRect(-85, -35, 170, 8);
            ctx.fillRect(-85, 27, 170, 8);

            // 槌柄
            const handleGradient = ctx.createLinearGradient(0, 30, 0, 200);
            handleGradient.addColorStop(0, `rgba(140, 100, 50, ${easeProgress})`);
            handleGradient.addColorStop(1, `rgba(100, 70, 35, ${easeProgress})`);
            ctx.fillStyle = handleGradient;
            ctx.fillRect(-12, 30, 24, 170);

            ctx.restore();

            // 绘制底座
            const baseY = canvas.height * 0.65;
            const baseGradient = ctx.createLinearGradient(
                canvas.width * 0.5 - 100, baseY,
                canvas.width * 0.5 + 100, baseY + 40
            );
            baseGradient.addColorStop(0, `rgba(80, 50, 30, ${easeProgress})`);
            baseGradient.addColorStop(0.5, `rgba(120, 80, 50, ${easeProgress})`);
            baseGradient.addColorStop(1, `rgba(80, 50, 30, ${easeProgress})`);
            ctx.fillStyle = baseGradient;
            ctx.fillRect(canvas.width * 0.5 - 100, baseY, 200, 40);

            // 敲击震动效果（在动画中段）
            if (progress > 0.4 && progress < 0.6) {
                const shakeIntensity = Math.sin((progress - 0.4) * Math.PI * 5) * 5;
                ctx.save();
                ctx.translate(shakeIntensity, shakeIntensity * 0.5);
            }

            // 敲击闪光
            if (progress > 0.45 && progress < 0.55) {
                const flashIntensity = 1 - Math.abs(progress - 0.5) * 20;
                ctx.fillStyle = `rgba(255, 220, 150, ${flashIntensity * 0.3})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            if (progress > 0.4 && progress < 0.6) {
                ctx.restore();
            }

            // 绘制尘埃粒子
            if (progress > 0.5) {
                const dustProgress = (progress - 0.5) / 0.5;
                for (let i = 0; i < 20; i++) {
                    const dustX = canvas.width * 0.5 + (Math.random() - 0.5) * 200;
                    const dustY = canvas.height * 0.65 - dustProgress * 100;
                    ctx.fillStyle = `rgba(160, 130, 80, ${dustProgress * 0.4})`;
                    ctx.beginPath();
                    ctx.arc(dustX, dustY, 2 + Math.random() * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            if (progress < 1 && isAnimating) {
                currentAnimationId = requestAnimationFrame(animate);
            } else if (isAnimating) {
                setTimeout(() => {
                    hideCinematicText();
                    setTimeout(() => {
                        hideContainer();
                        hideSkipHint();
                        isAnimating = false;
                        skipResolve = null;
                        resolve();
                    }, 800);
                }, CINEMATIC_CONFIG.textDisplayDuration);
            }
        };

        animate();
    });
};

// ==================== 通用过场动画接口 ====================

/**
 * 根据阶段播放对应的过场动画
 * @param {string} phase - 阶段名称 ('night' | 'day' | 'vote')
 * @returns {Promise<void>}
 */
const playCinematicTransition = async (phase) => {
    console.log(`[CinematicTransitions] Playing transition for: ${phase}`);

    switch (phase) {
        case 'night':
        case 'night-falls':
            await playBloodMoonRise();
            break;
        case 'day':
        case 'dawn-breaks':
            await playDawnBreaks();
            break;
        case 'vote':
        case 'voting':
            await playJudgmentHammer();
            break;
        default:
            console.warn(`[CinematicTransitions] Unknown phase: ${phase}`);
    }
};

// ==================== 导出 ====================

window.App.cinematicTransitions = {
    init: initCinematicTransitions,
    playBloodMoonRise,
    playDawnBreaks,
    playJudgmentHammer,
    playCinematicTransition,
    skipAnimation,
};

// 向后兼容
window.initCinematicTransitions = initCinematicTransitions;
window.playBloodMoonRise = playBloodMoonRise;
window.playDawnBreaks = playDawnBreaks;
window.playJudgmentHammer = playJudgmentHammer;
window.playCinematicTransition = playCinematicTransition;
