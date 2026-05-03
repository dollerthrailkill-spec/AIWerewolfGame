/**
 * skillEffects.js - 重度技能特效系统
 *
 * 提供游戏中的角色技能释放特效：
 * - 狼人击杀：屏幕闪红、狼爪撕裂、头像裂痕、血滴滑落
 * - 预言家查验：蓝色符文阵旋转、光束笼罩、结果显示
 * - 女巫毒药：紫色漩涡、骷髅浮现
 * - 女巫解药：绿色光芒、伤口愈合
 * - 守卫守护：金色护盾升起、环绕、脉冲
 * - 猎人开枪：火焰喷射、目标爆炸
 *
 * 所有特效时长约5秒，使用Canvas绘制
 *
 * @module SkillEffects
 */

// ==================== App 命名空间初始化 ====================
window.App = window.App || {};

// ==================== 配置 ====================

/** 特效默认配置 */
const EFFECT_CONFIG = {
    defaultDuration: 5000,    // 默认特效时长(ms)
    screenShakeIntensity: 8,  // 屏幕震动强度
};

// ==================== DOM 元素引用 ====================

let effectsContainer = null;
let effectsCanvas = null;
let skillCanvasCtx = null;
let isPlaying = false;
let currentEffectId = null;

// ==================== 初始化 ====================

/**
 * 初始化技能特效系统
 */
const initSkillEffects = () => {
    console.log('[SkillEffects] Initializing...');

    createEffectsDOM();
    console.log('[SkillEffects] Initialized');
};

/**
 * 创建特效DOM结构
 */
const createEffectsDOM = () => {
    // 移除旧容器（如果存在）
    const oldContainer = document.getElementById('skill-effects-container');
    if (oldContainer) oldContainer.remove();

    // 创建主容器
    effectsContainer = document.createElement('div');
    effectsContainer.id = 'skill-effects-container';
    effectsContainer.className = 'fixed inset-0 z-[55] pointer-events-none hidden';
    effectsContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 55;
        pointer-events: none;
        overflow: hidden;
    `;

    // 创建Canvas用于绘制特效
    effectsCanvas = document.createElement('canvas');
    effectsCanvas.id = 'skill-effects-canvas';
    effectsCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    `;

    effectsContainer.appendChild(effectsCanvas);
    document.body.appendChild(effectsContainer);

    // 设置Canvas尺寸
    resizeEffectsCanvas();
    window.addEventListener('resize', resizeEffectsCanvas);

    skillCanvasCtx = effectsCanvas.getContext('2d');
};

/**
 * 调整Canvas尺寸
 */
const resizeEffectsCanvas = () => {
    if (!effectsCanvas) return;
    effectsCanvas.width = window.innerWidth;
    effectsCanvas.height = window.innerHeight;
};

// ==================== 核心控制 ====================

/**
 * 显示特效容器
 */
const showEffectsContainer = () => {
    if (effectsContainer) {
        effectsContainer.classList.remove('hidden');
    }
};

/**
 * 隐藏特效容器
 */
const hideEffectsContainer = () => {
    if (effectsContainer) {
        effectsContainer.classList.add('hidden');
    }
    // 清空画布
    if (skillCanvasCtx && effectsCanvas) {
        skillCanvasCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);
    }
};

/**
 * 获取座位在屏幕上的位置
 * @param {string} playerId - 玩家ID
 * @returns {{x: number, y: number, width: number, height: number}|null}
 */
const getSeatRect = (playerId) => {
    const seat = document.querySelector(`.seat[data-player-id="${playerId}"]`);
    if (!seat) return null;
    const rect = seat.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
    };
};

/**
 * 屏幕震动效果
 * @param {number} intensity - 震动强度
 * @param {number} duration - 震动时长(ms)
 */
const screenShake = (intensity, duration) => {
    const startTime = Date.now();
    const gameArea = document.querySelector('.game-area');
    if (!gameArea) return;

    const shake = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
            gameArea.style.transform = '';
            return;
        }

        const progress = elapsed / duration;
        const currentIntensity = intensity * (1 - progress);
        const dx = (Math.random() - 0.5) * currentIntensity * 2;
        const dy = (Math.random() - 0.5) * currentIntensity * 2;

        gameArea.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(shake);
    };

    shake();
};

// ==================== 狼人击杀特效 ====================

/**
 * 播放狼人击杀特效
 * @param {string} actorId - 狼人玩家ID
 * @param {string} targetId - 目标玩家ID
 * @returns {Promise<void>}
 */
const playWerewolfKillEffect = (actorId, targetId) => {
    return new Promise((resolve) => {
        if (isPlaying) {
            console.warn('[SkillEffects] Another effect is playing');
            resolve();
            return;
        }

        isPlaying = true;
        showEffectsContainer();

        const startTime = Date.now();
        const duration = EFFECT_CONFIG.defaultDuration;
        const canvas = effectsCanvas;
        const ctx = skillCanvasCtx;

        const actorRect = getSeatRect(actorId);
        const targetRect = getSeatRect(targetId);

        if (!actorRect || !targetRect) {
            console.warn('[SkillEffects] Seat not found for werewolf kill');
            isPlaying = false;
            hideEffectsContainer();
            resolve();
            return;
        }

        // 屏幕闪红
        const flashRed = () => {
            const flashDiv = document.createElement('div');
            flashDiv.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(180, 30, 30, 0.4);
                z-index: 56;
                pointer-events: none;
                opacity: 1;
                transition: opacity 0.5s;
            `;
            document.body.appendChild(flashDiv);
            setTimeout(() => {
                flashDiv.style.opacity = '0';
                setTimeout(() => flashDiv.remove(), 500);
            }, 200);
        };

        // 狼爪轨迹
        const claws = [];
        for (let i = 0; i < 5; i++) {
            claws.push({
                angle: (i - 2) * 0.15,
                length: 0,
                maxLength: Math.min(canvas.width, canvas.height) * 0.4,
                width: 8 - Math.abs(i - 2) * 2,
            });
        }

        // 血滴粒子
        const bloodDrops = [];
        const initBloodDrops = () => {
            for (let i = 0; i < 30; i++) {
                bloodDrops.push({
                    x: targetRect.x + (Math.random() - 0.5) * 60,
                    y: targetRect.y + (Math.random() - 0.5) * 60,
                    vx: (Math.random() - 0.5) * 4,
                    vy: Math.random() * 3 + 2,
                    radius: Math.random() * 4 + 2,
                    opacity: 1,
                });
            }
        };

        // 头像裂痕效果（通过CSS类实现）
        const addCrackEffect = () => {
            const targetSeat = document.querySelector(`.seat[data-player-id="${targetId}"] .avatar-wrapper`);
            if (targetSeat) {
                targetSeat.style.filter = 'grayscale(0.8) brightness(0.6)';
                targetSeat.style.transition = 'filter 0.5s';

                // 添加裂痕覆盖层
                const crackOverlay = document.createElement('div');
                crackOverlay.className = 'crack-overlay';
                crackOverlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M50 0 L55 30 L45 35 L60 60 L40 70 L50 100' stroke='rgba(180,30,30,0.6)' stroke-width='2' fill='none'/%3E%3Cpath d='M30 20 L40 40 L35 50 L45 65' stroke='rgba(180,30,30,0.4)' stroke-width='1.5' fill='none'/%3E%3Cpath d='M70 15 L60 35 L65 45 L55 60' stroke='rgba(180,30,30,0.4)' stroke-width='1.5' fill='none'/%3E%3C/svg%3E") center/contain no-repeat;
                    pointer-events: none;
                    z-index: 10;
                `;
                targetSeat.style.position = 'relative';
                targetSeat.appendChild(crackOverlay);
            }
        };

        const animate = () => {
            if (!isPlaying) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 阶段1: 屏幕闪红 + 狼爪伸出 (0-30%)
            if (progress < 0.3) {
                const clawProgress = progress / 0.3;

                // 在20%时触发闪红
                if (progress > 0.15 && progress < 0.17) {
                    flashRed();
                    screenShake(EFFECT_CONFIG.screenShakeIntensity, 300);
                }

                // 绘制狼爪轨迹
                claws.forEach((claw, index) => {
                    claw.length = claw.maxLength * clawProgress;

                    const startX = actorRect.x;
                    const startY = actorRect.y;
                    const endX = targetRect.x + Math.cos(claw.angle) * claw.length;
                    const endY = targetRect.y + Math.sin(claw.angle) * claw.length;

                    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
                    gradient.addColorStop(0, 'rgba(180, 30, 30, 0)');
                    gradient.addColorStop(0.5, `rgba(220, 50, 50, ${0.6 * clawProgress})`);
                    gradient.addColorStop(1, `rgba(180, 30, 30, ${0.8 * clawProgress})`);

                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = claw.width;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();

                    // 爪尖
                    ctx.fillStyle = `rgba(220, 60, 60, ${0.9 * clawProgress})`;
                    ctx.beginPath();
                    ctx.arc(endX, endY, claw.width, 0, Math.PI * 2);
                    ctx.fill();
                });
            }

            // 阶段2: 血滴飞溅 (30-60%)
            if (progress >= 0.3 && progress < 0.6) {
                if (bloodDrops.length === 0) {
                    initBloodDrops();
                    addCrackEffect();
                }

                bloodDrops.forEach(drop => {
                    drop.x += drop.vx;
                    drop.y += drop.vy;
                    drop.vy += 0.15; // 重力
                    drop.opacity = Math.max(0, 1 - (progress - 0.3) / 0.3);

                    if (drop.opacity > 0) {
                        ctx.fillStyle = `rgba(180, 30, 30, ${drop.opacity})`;
                        ctx.beginPath();
                        ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });
            }

            // 阶段3: 持续血雾 (60-100%)
            if (progress >= 0.6) {
                const fadeProgress = (progress - 0.6) / 0.4;
                const mistOpacity = 0.3 * (1 - fadeProgress);

                const mistGradient = ctx.createRadialGradient(
                    targetRect.x, targetRect.y, 0,
                    targetRect.x, targetRect.y, 150
                );
                mistGradient.addColorStop(0, `rgba(150, 30, 30, ${mistOpacity})`);
                mistGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = mistGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            if (progress < 1 && isPlaying) {
                requestAnimationFrame(animate);
            } else {
                isPlaying = false;
                hideEffectsContainer();
                resolve();
            }
        };

        animate();
    });
};

// ==================== 预言家查验特效 ====================

/**
 * 播放预言家查验特效
 * @param {string} actorId - 预言家玩家ID
 * @param {string} targetId - 目标玩家ID
 * @param {boolean} isWerewolf - 是否为狼人
 * @returns {Promise<void>}
 */
const playSeerCheckEffect = (actorId, targetId, isWerewolf) => {
    return new Promise((resolve) => {
        if (isPlaying) {
            resolve();
            return;
        }

        isPlaying = true;
        showEffectsContainer();

        const startTime = Date.now();
        const duration = EFFECT_CONFIG.defaultDuration;
        const canvas = effectsCanvas;
        const ctx = skillCanvasCtx;

        const actorRect = getSeatRect(actorId);
        const targetRect = getSeatRect(targetId);

        if (!actorRect || !targetRect) {
            isPlaying = false;
            hideEffectsContainer();
            resolve();
            return;
        }

        // 符文粒子
        const runes = [];
        const initRunes = () => {
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                runes.push({
                    angle,
                    distance: 80,
                    targetDistance: 120,
                    size: 20,
                    symbol: ['✦', '◈', '✧', '◇', '✶', '◉'][i % 6],
                });
            }
        };
        initRunes();

        // 结果文字
        let resultShown = false;

        const animate = () => {
            if (!isPlaying) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 阶段1: 符文阵旋转出现 (0-40%)
            if (progress < 0.4) {
                const appearProgress = progress / 0.4;

                runes.forEach((rune, index) => {
                    rune.angle += 0.02;
                    rune.distance = 80 + (rune.targetDistance - 80) * appearProgress;

                    const x = targetRect.x + Math.cos(rune.angle) * rune.distance;
                    const y = targetRect.y + Math.sin(rune.angle) * rune.distance;

                    ctx.font = `${rune.size}px Cinzel`;
                    ctx.fillStyle = `rgba(100, 200, 255, ${0.8 * appearProgress})`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(rune.symbol, x, y);

                    // 连线
                    ctx.strokeStyle = `rgba(100, 200, 255, ${0.2 * appearProgress})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(targetRect.x, targetRect.y);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                });

                // 中心光环
                const haloGradient = ctx.createRadialGradient(
                    targetRect.x, targetRect.y, 0,
                    targetRect.x, targetRect.y, 60 * appearProgress
                );
                haloGradient.addColorStop(0, `rgba(100, 200, 255, ${0.3 * appearProgress})`);
                haloGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = haloGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 阶段2: 光束笼罩 (40-70%)
            if (progress >= 0.4 && progress < 0.7) {
                const beamProgress = (progress - 0.4) / 0.3;

                // 旋转符文
                runes.forEach((rune) => {
                    rune.angle += 0.03;
                    const x = targetRect.x + Math.cos(rune.angle) * rune.distance;
                    const y = targetRect.y + Math.sin(rune.angle) * rune.distance;

                    ctx.font = `${rune.size}px Cinzel`;
                    ctx.fillStyle = `rgba(100, 200, 255, ${0.6 * (1 - beamProgress * 0.5)})`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(rune.symbol, x, y);
                });

                // 光束
                const beamGradient = ctx.createLinearGradient(
                    targetRect.x, targetRect.y - 200,
                    targetRect.x, targetRect.y + 100
                );
                beamGradient.addColorStop(0, `rgba(100, 200, 255, ${0.5 * beamProgress})`);
                beamGradient.addColorStop(0.5, `rgba(150, 220, 255, ${0.3 * beamProgress})`);
                beamGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = beamGradient;
                ctx.fillRect(targetRect.x - 60, targetRect.y - 200, 120, 300);
            }

            // 阶段3: 结果显示 (70-100%)
            if (progress >= 0.7) {
                const resultProgress = (progress - 0.7) / 0.3;

                if (!resultShown && progress > 0.75) {
                    resultShown = true;
                    // 在目标座位上显示结果标记
                    const targetSeat = document.querySelector(`.seat[data-player-id="${targetId}"]`);
                    if (targetSeat) {
                        const resultMark = document.createElement('div');
                        resultMark.className = 'seer-result-mark';
                        resultMark.style.cssText = `
                            position: absolute;
                            top: -10px;
                            right: -10px;
                            width: 30px;
                            height: 30px;
                            border-radius: 50%;
                            background: ${isWerewolf ? 'rgba(180, 30, 30, 0.9)' : 'rgba(30, 180, 80, 0.9)'};
                            color: white;
                            font-size: 16px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 20;
                            animation: resultMarkPop 0.5s ease-out;
                        `;
                        resultMark.textContent = isWerewolf ? '✕' : '✓';
                        targetSeat.style.position = 'relative';
                        targetSeat.appendChild(resultMark);

                        // 3秒后移除
                        setTimeout(() => {
                            if (resultMark.parentNode) resultMark.remove();
                        }, 3000);
                    }
                }

                // 结果光晕
                const resultColor = isWerewolf ? '180, 30, 30' : '30, 180, 80';
                const resultGradient = ctx.createRadialGradient(
                    targetRect.x, targetRect.y, 0,
                    targetRect.x, targetRect.y, 100
                );
                resultGradient.addColorStop(0, `rgba(${resultColor}, ${0.4 * resultProgress})`);
                resultGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = resultGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            if (progress < 1 && isPlaying) {
                requestAnimationFrame(animate);
            } else {
                isPlaying = false;
                hideEffectsContainer();
                resolve();
            }
        };

        animate();
    });
};

// ==================== 女巫技能特效 ====================

/**
 * 播放女巫毒药特效
 * @param {string} actorId - 女巫玩家ID
 * @param {string} targetId - 目标玩家ID
 * @returns {Promise<void>}
 */
const playWitchPoisonEffect = (actorId, targetId) => {
    return new Promise((resolve) => {
        if (isPlaying) {
            resolve();
            return;
        }

        isPlaying = true;
        showEffectsContainer();

        const startTime = Date.now();
        const duration = EFFECT_CONFIG.defaultDuration;
        const canvas = effectsCanvas;
        const ctx = skillCanvasCtx;

        const actorRect = getSeatRect(actorId);
        const targetRect = getSeatRect(targetId);

        if (!actorRect || !targetRect) {
            isPlaying = false;
            hideEffectsContainer();
            resolve();
            return;
        }

        // 紫色漩涡粒子
        const vortexParticles = [];
        const initVortex = () => {
            for (let i = 0; i < 50; i++) {
                vortexParticles.push({
                    angle: Math.random() * Math.PI * 2,
                    distance: Math.random() * 30 + 20,
                    speed: Math.random() * 0.05 + 0.02,
                    size: Math.random() * 4 + 2,
                    opacity: Math.random() * 0.5 + 0.5,
                });
            }
        };
        initVortex();

        // 骷髅浮现
        let skullOpacity = 0;

        const animate = () => {
            if (!isPlaying) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 阶段1: 紫色漩涡 (0-50%)
            if (progress < 0.5) {
                const vortexProgress = progress / 0.5;

                vortexParticles.forEach(p => {
                    p.angle += p.speed;
                    p.distance = 20 + 100 * vortexProgress;

                    const x = targetRect.x + Math.cos(p.angle) * p.distance;
                    const y = targetRect.y + Math.sin(p.angle) * p.distance * 0.6;

                    ctx.fillStyle = `rgba(150, 50, 200, ${p.opacity * vortexProgress})`;
                    ctx.beginPath();
                    ctx.arc(x, y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                });

                // 中心漩涡
                const centerGradient = ctx.createRadialGradient(
                    targetRect.x, targetRect.y, 0,
                    targetRect.x, targetRect.y, 50 * vortexProgress
                );
                centerGradient.addColorStop(0, `rgba(150, 50, 200, ${0.5 * vortexProgress})`);
                centerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = centerGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 阶段2: 骷髅浮现 (50-80%)
            if (progress >= 0.5 && progress < 0.8) {
                const skullProgress = (progress - 0.5) / 0.3;
                skullOpacity = skullProgress;

                // 绘制骷髅（简化版）
                ctx.font = '80px serif';
                ctx.fillStyle = `rgba(200, 200, 200, ${skullOpacity})`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('💀', targetRect.x, targetRect.y - 20);

                // 紫色雾气
                const mistGradient = ctx.createRadialGradient(
                    targetRect.x, targetRect.y, 0,
                    targetRect.x, targetRect.y, 150
                );
                mistGradient.addColorStop(0, `rgba(150, 50, 200, ${0.3 * (1 - skullProgress * 0.5)})`);
                mistGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = mistGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 阶段3: 消散 (80-100%)
            if (progress >= 0.8) {
                const fadeProgress = (progress - 0.8) / 0.2;

                ctx.font = '80px serif';
                ctx.fillStyle = `rgba(200, 200, 200, ${skullOpacity * (1 - fadeProgress)})`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('💀', targetRect.x, targetRect.y - 20);
            }

            if (progress < 1 && isPlaying) {
                requestAnimationFrame(animate);
            } else {
                isPlaying = false;
                hideEffectsContainer();
                resolve();
            }
        };

        animate();
    });
};

/**
 * 播放女巫解药特效
 * @param {string} actorId - 女巫玩家ID
 * @param {string} targetId - 目标玩家ID
 * @returns {Promise<void>}
 */
const playWitchHealEffect = (actorId, targetId) => {
    return new Promise((resolve) => {
        if (isPlaying) {
            resolve();
            return;
        }

        isPlaying = true;
        showEffectsContainer();

        const startTime = Date.now();
        const duration = EFFECT_CONFIG.defaultDuration;
        const canvas = effectsCanvas;
        const ctx = skillCanvasCtx;

        const actorRect = getSeatRect(actorId);
        const targetRect = getSeatRect(targetId);

        if (!actorRect || !targetRect) {
            isPlaying = false;
            hideEffectsContainer();
            resolve();
            return;
        }

        // 治愈光芒粒子
        const healParticles = [];
        const initHealParticles = () => {
            for (let i = 0; i < 40; i++) {
                healParticles.push({
                    x: targetRect.x + (Math.random() - 0.5) * 100,
                    y: targetRect.y + (Math.random() - 0.5) * 100,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -Math.random() * 3 - 1,
                    size: Math.random() * 6 + 3,
                    opacity: Math.random() * 0.5 + 0.5,
                    pulse: Math.random() * Math.PI * 2,
                });
            }
        };
        initHealParticles();

        const animate = () => {
            if (!isPlaying) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 阶段1: 绿色光芒降临 (0-50%)
            if (progress < 0.5) {
                const lightProgress = progress / 0.5;

                // 光柱
                const lightGradient = ctx.createLinearGradient(
                    targetRect.x, targetRect.y - 200,
                    targetRect.x, targetRect.y + 100
                );
                lightGradient.addColorStop(0, `rgba(50, 200, 100, ${0.6 * lightProgress})`);
                lightGradient.addColorStop(0.5, `rgba(80, 220, 130, ${0.3 * lightProgress})`);
                lightGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = lightGradient;
                ctx.fillRect(targetRect.x - 80, targetRect.y - 200, 160, 300);
            }

            // 阶段2: 治愈粒子上升 (30-80%)
            if (progress >= 0.3 && progress < 0.8) {
                const particleProgress = Math.min((progress - 0.3) / 0.5, 1);

                healParticles.forEach(p => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.pulse += 0.05;
                    const pulseOpacity = p.opacity * (0.7 + 0.3 * Math.sin(p.pulse));

                    ctx.fillStyle = `rgba(80, 220, 130, ${pulseOpacity * (1 - particleProgress * 0.5)})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                });

                // 中心治愈光环
                const healGradient = ctx.createRadialGradient(
                    targetRect.x, targetRect.y, 0,
                    targetRect.x, targetRect.y, 80
                );
                healGradient.addColorStop(0, `rgba(50, 200, 100, ${0.4 * (1 - particleProgress * 0.5)})`);
                healGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = healGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 阶段3: 伤口愈合光效 (60-100%)
            if (progress >= 0.6) {
                const woundProgress = (progress - 0.6) / 0.4;

                // 十字光芒
                const crossSize = 40 * woundProgress;
                ctx.strokeStyle = `rgba(150, 255, 180, ${0.6 * (1 - woundProgress)})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(targetRect.x - crossSize, targetRect.y);
                ctx.lineTo(targetRect.x + crossSize, targetRect.y);
                ctx.moveTo(targetRect.x, targetRect.y - crossSize);
                ctx.lineTo(targetRect.x, targetRect.y + crossSize);
                ctx.stroke();
            }

            if (progress < 1 && isPlaying) {
                requestAnimationFrame(animate);
            } else {
                isPlaying = false;
                hideEffectsContainer();

                const healedWrapper = document.querySelector(`.seat[data-player-id="${targetId}"] .avatar-wrapper`);
                if (healedWrapper) {
                    healedWrapper.style.filter = '';
                    healedWrapper.style.position = '';
                    healedWrapper.querySelectorAll('.crack-overlay').forEach(el => el.remove());
                }

                resolve();
            }
        };

        animate();
    });
};

// ==================== 守卫守护特效 ====================

/**
 * 播放守卫守护特效
 * @param {string} actorId - 守卫玩家ID
 * @param {string} targetId - 目标玩家ID
 * @returns {Promise<void>}
 */
const playGuardProtectEffect = (actorId, targetId) => {
    return new Promise((resolve) => {
        if (isPlaying) {
            resolve();
            return;
        }

        isPlaying = true;
        showEffectsContainer();

        const startTime = Date.now();
        const duration = EFFECT_CONFIG.defaultDuration;
        const canvas = effectsCanvas;
        const ctx = skillCanvasCtx;

        const actorRect = getSeatRect(actorId);
        const targetRect = getSeatRect(targetId);

        if (!actorRect || !targetRect) {
            isPlaying = false;
            hideEffectsContainer();
            resolve();
            return;
        }

        // 护盾参数
        let shieldRadius = 0;
        let shieldOpacity = 0;
        let pulsePhase = 0;

        const animate = () => {
            if (!isPlaying) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 阶段1: 护盾从地面升起 (0-40%)
            if (progress < 0.4) {
                const riseProgress = progress / 0.4;
                shieldRadius = 60 * riseProgress;
                shieldOpacity = 0.8 * riseProgress;

                // 地面光环
                const groundGradient = ctx.createRadialGradient(
                    targetRect.x, targetRect.y + 40, 0,
                    targetRect.x, targetRect.y + 40, 100 * riseProgress
                );
                groundGradient.addColorStop(0, `rgba(212, 168, 48, ${0.3 * riseProgress})`);
                groundGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = groundGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 阶段2: 护盾环绕 (40-100%)
            if (progress >= 0.4) {
                const surroundProgress = (progress - 0.4) / 0.6;
                pulsePhase += 0.03;
                const pulseScale = 1 + 0.1 * Math.sin(pulsePhase);

                shieldRadius = 60 * pulseScale;
                shieldOpacity = 0.6 + 0.2 * Math.sin(pulsePhase);

                // 外圈
                ctx.strokeStyle = `rgba(212, 168, 48, ${shieldOpacity})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(targetRect.x, targetRect.y, shieldRadius, 0, Math.PI * 2);
                ctx.stroke();

                // 内圈
                ctx.strokeStyle = `rgba(255, 220, 150, ${shieldOpacity * 0.5})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(targetRect.x, targetRect.y, shieldRadius * 0.7, 0, Math.PI * 2);
                ctx.stroke();

                // 护盾光芒
                const shieldGradient = ctx.createRadialGradient(
                    targetRect.x, targetRect.y, 0,
                    targetRect.x, targetRect.y, shieldRadius
                );
                shieldGradient.addColorStop(0, `rgba(212, 168, 48, ${0.1 * shieldOpacity})`);
                shieldGradient.addColorStop(0.8, `rgba(212, 168, 48, ${0.2 * shieldOpacity})`);
                shieldGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = shieldGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // 符文装饰
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2 + pulsePhase * 0.5;
                    const rx = targetRect.x + Math.cos(angle) * shieldRadius;
                    const ry = targetRect.y + Math.sin(angle) * shieldRadius;

                    ctx.fillStyle = `rgba(212, 168, 48, ${shieldOpacity})`;
                    ctx.font = '16px Cinzel';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('◆', rx, ry);
                }
            }

            if (progress < 1 && isPlaying) {
                requestAnimationFrame(animate);
            } else {
                isPlaying = false;
                hideEffectsContainer();

                const guardedWrapper = document.querySelector(`.seat[data-player-id="${targetId}"] .avatar-wrapper`);
                if (guardedWrapper) {
                    guardedWrapper.style.filter = '';
                    guardedWrapper.style.position = '';
                    guardedWrapper.querySelectorAll('.crack-overlay').forEach(el => el.remove());
                }

                resolve();
            }
        };

        animate();
    });
};

// ==================== 猎人开枪特效 ====================

/**
 * 播放猎人开枪特效
 * @param {string} actorId - 猎人玩家ID
 * @param {string} targetId - 目标玩家ID
 * @returns {Promise<void>}
 */
const playHunterShootEffect = (actorId, targetId) => {
    return new Promise((resolve) => {
        if (isPlaying) {
            resolve();
            return;
        }

        isPlaying = true;
        showEffectsContainer();

        const startTime = Date.now();
        const duration = EFFECT_CONFIG.defaultDuration;
        const canvas = effectsCanvas;
        const ctx = skillCanvasCtx;

        const actorRect = getSeatRect(actorId);
        const targetRect = getSeatRect(targetId);

        if (!actorRect || !targetRect) {
            isPlaying = false;
            hideEffectsContainer();
            resolve();
            return;
        }

        // 火焰粒子
        const fireParticles = [];
        const initFireParticles = () => {
            for (let i = 0; i < 60; i++) {
                fireParticles.push({
                    x: actorRect.x,
                    y: actorRect.y,
                    vx: (targetRect.x - actorRect.x) / 30 + (Math.random() - 0.5) * 4,
                    vy: (targetRect.y - actorRect.y) / 30 + (Math.random() - 0.5) * 4,
                    size: Math.random() * 8 + 4,
                    life: 1,
                    decay: Math.random() * 0.02 + 0.01,
                });
            }
        };

        // 爆炸粒子
        const explosionParticles = [];
        const initExplosion = () => {
            for (let i = 0; i < 40; i++) {
                explosionParticles.push({
                    x: targetRect.x,
                    y: targetRect.y,
                    vx: (Math.random() - 0.5) * 15,
                    vy: (Math.random() - 0.5) * 15,
                    size: Math.random() * 6 + 3,
                    life: 1,
                    decay: Math.random() * 0.03 + 0.02,
                    color: Math.random() > 0.5 ? '255, 150, 50' : '255, 80, 30',
                });
            }
        };

        let explosionTriggered = false;

        const animate = () => {
            if (!isPlaying) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 阶段1: 火焰喷射 (0-40%)
            if (progress < 0.4) {
                const fireProgress = progress / 0.4;

                if (fireParticles.length === 0) {
                    initFireParticles();
                }

                fireParticles.forEach(p => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.life -= p.decay;
                    p.size *= 0.98;

                    if (p.life > 0) {
                        const fireGradient = ctx.createRadialGradient(
                            p.x, p.y, 0,
                            p.x, p.y, p.size
                        );
                        fireGradient.addColorStop(0, `rgba(255, 220, 100, ${p.life})`);
                        fireGradient.addColorStop(0.5, `rgba(255, 150, 50, ${p.life * 0.8})`);
                        fireGradient.addColorStop(1, `rgba(255, 80, 30, ${p.life * 0.3})`);

                        ctx.fillStyle = fireGradient;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });

                // 枪口闪光
                const flashOpacity = Math.max(0, 1 - fireProgress * 2);
                const flashGradient = ctx.createRadialGradient(
                    actorRect.x, actorRect.y, 0,
                    actorRect.x, actorRect.y, 50
                );
                flashGradient.addColorStop(0, `rgba(255, 255, 200, ${flashOpacity})`);
                flashGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = flashGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 阶段2: 目标爆炸 (35-70%)
            if (progress >= 0.35) {
                if (!explosionTriggered) {
                    explosionTriggered = true;
                    initExplosion();
                    screenShake(EFFECT_CONFIG.screenShakeIntensity * 1.5, 400);
                }

                const explosionProgress = Math.min((progress - 0.35) / 0.35, 1);

                explosionParticles.forEach(p => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vx *= 0.95;
                    p.vy *= 0.95;
                    p.life -= p.decay;
                    p.size *= 0.97;

                    if (p.life > 0) {
                        ctx.fillStyle = `rgba(${p.color}, ${p.life})`;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });

                // 爆炸光晕
                const explosionGlow = ctx.createRadialGradient(
                    targetRect.x, targetRect.y, 0,
                    targetRect.x, targetRect.y, 100 * explosionProgress
                );
                explosionGlow.addColorStop(0, `rgba(255, 150, 50, ${0.5 * (1 - explosionProgress)})`);
                explosionGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = explosionGlow;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 阶段3: 烟雾消散 (70-100%)
            if (progress >= 0.7) {
                const smokeProgress = (progress - 0.7) / 0.3;
                const smokeOpacity = 0.3 * (1 - smokeProgress);

                const smokeGradient = ctx.createRadialGradient(
                    targetRect.x, targetRect.y, 0,
                    targetRect.x, targetRect.y, 120
                );
                smokeGradient.addColorStop(0, `rgba(100, 100, 100, ${smokeOpacity})`);
                smokeGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = smokeGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            if (progress < 1 && isPlaying) {
                requestAnimationFrame(animate);
            } else {
                isPlaying = false;
                hideEffectsContainer();
                resolve();
            }
        };

        animate();
    });
};

// ==================== 通用接口 ====================

/**
 * 根据技能类型播放对应特效
 * @param {string} skillType - 技能类型
 * @param {string} actorId - 施法者ID
 * @param {string} targetId - 目标ID
 * @param {Object} [options] - 额外选项
 * @returns {Promise<void>}
 */
const playSkillEffect = async (skillType, actorId, targetId, options = {}) => {
    console.log(`[SkillEffects] Playing ${skillType} effect: ${actorId} -> ${targetId}`);

    switch (skillType) {
        case 'werewolf':
        case 'kill':
            await playWerewolfKillEffect(actorId, targetId);
            break;
        case 'seer':
        case 'check':
            await playSeerCheckEffect(actorId, targetId, options.isWerewolf || false);
            break;
        case 'witch-poison':
        case 'poison':
            await playWitchPoisonEffect(actorId, targetId);
            break;
        case 'witch-heal':
        case 'heal':
            await playWitchHealEffect(actorId, targetId);
            break;
        case 'guard':
        case 'protect':
            await playGuardProtectEffect(actorId, targetId);
            break;
        case 'hunter':
        case 'shoot':
            await playHunterShootEffect(actorId, targetId);
            break;
        default:
            console.warn(`[SkillEffects] Unknown skill type: ${skillType}`);
    }
};

// ==================== 导出 ====================

window.App.skillEffects = {
    init: initSkillEffects,
    playWerewolfKillEffect,
    playSeerCheckEffect,
    playWitchPoisonEffect,
    playWitchHealEffect,
    playGuardProtectEffect,
    playHunterShootEffect,
    playSkillEffect,
};

// 向后兼容
window.initSkillEffects = initSkillEffects;
window.playWerewolfKillEffect = playWerewolfKillEffect;
window.playSeerCheckEffect = playSeerCheckEffect;
window.playWitchPoisonEffect = playWitchPoisonEffect;
window.playWitchHealEffect = playWitchHealEffect;
window.playGuardProtectEffect = playGuardProtectEffect;
window.playHunterShootEffect = playHunterShootEffect;
window.playSkillEffect = playSkillEffect;
