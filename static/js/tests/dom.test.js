/**
 * DOM 操作函数单元测试
 * 直接复制 app.js 中的函数进行测试
 */

// 复制 app.js 中的 DOM 操作函数
function showEulogyOverlay(playerName = '', message = '') {
    const overlay = document.getElementById('eulogy-overlay');
    const nameSpan = document.getElementById('eulogy-player-name');
    
    if (overlay && nameSpan) {
        nameSpan.textContent = playerName;
        overlay.classList.remove('hidden');
        
        // 自动关闭机制，防止因后端没有发送 eulogy_end 消息导致界面卡住
        setTimeout(() => {
            hideEulogyOverlay();
        }, 2500);
    }
}

function hideEulogyOverlay() {
    const overlay = document.getElementById('eulogy-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

function shakeElement(element, duration = 1000) {
    if (!element) return;
    
    element.classList.add('shake');
    setTimeout(() => {
        element.classList.remove('shake');
    }, duration);
}

function updateCenterText(text) {
    const centerText = document.getElementById('center-text');
    if (centerText) {
        centerText.textContent = text;
        centerText.classList.add('opacity-100');
        setTimeout(() => {
            centerText.classList.remove('opacity-100');
        }, 3000);
    }
}

function updateGameStep(text) {
    const gameStep = document.getElementById('game-step');
    if (gameStep) {
        gameStep.textContent = text;
    }
}

function toggleAutoPlay() {
    // 简化版本，仅用于测试
    const autoPlayBtn = document.getElementById('auto-play-btn');
    if (autoPlayBtn) {
        const currentText = autoPlayBtn.textContent;
        autoPlayBtn.textContent = currentText === '自动播放' ? '停止自动' : '自动播放';
    }
}

function nextSpeech() {
    // 简化版本，仅用于测试
    const speechArea = document.getElementById('speech-area');
    if (speechArea) {
        speechArea.classList.add('hidden');
    }
}

function submitVote() {
    // 简化版本，仅用于测试
    const votingArea = document.getElementById('voting-area');
    if (votingArea) {
        votingArea.classList.add('hidden');
    }
}

describe('showEulogyOverlay', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="eulogy-overlay" class="hidden">
                <span id="eulogy-player-name"></span>
            </div>
        `;
    });

    test('应该显示遗言覆盖层', () => {
        showEulogyOverlay('张三', '这是我的遗言');
        const overlay = document.getElementById('eulogy-overlay');
        const nameSpan = document.getElementById('eulogy-player-name');
        
        expect(overlay.classList.contains('hidden')).toBe(false);
        expect(nameSpan.textContent).toBe('张三');
    });

    test('空参数应该正常工作', () => {
        showEulogyOverlay();
        const overlay = document.getElementById('eulogy-overlay');
        const nameSpan = document.getElementById('eulogy-player-name');
        
        expect(overlay.classList.contains('hidden')).toBe(false);
        expect(nameSpan.textContent).toBe('');
    });

    test('应该设置自动关闭定时器', () => {
        jest.useFakeTimers();
        showEulogyOverlay('李四');
        
        const overlay = document.getElementById('eulogy-overlay');
        expect(overlay.classList.contains('hidden')).toBe(false);
        
        // 快进到定时器执行
        jest.advanceTimersByTime(2500);
        
        expect(overlay.classList.contains('hidden')).toBe(true);
        jest.useRealTimers();
    });
});

describe('hideEulogyOverlay', () => {
    test('应该隐藏遗言覆盖层', () => {
        document.body.innerHTML = `
            <div id="eulogy-overlay">
                <span id="eulogy-player-name">张三</span>
            </div>
        `;
        
        hideEulogyOverlay();
        const overlay = document.getElementById('eulogy-overlay');
        
        expect(overlay.classList.contains('hidden')).toBe(true);
    });

    test('元素不存在时应该不报错', () => {
        document.body.innerHTML = '';
        
        expect(() => hideEulogyOverlay()).not.toThrow();
    });
});

describe('shakeElement', () => {
    test('应该添加和移除 shake 类', () => {
        jest.useFakeTimers();
        
        document.body.innerHTML = '<div id="test-element"></div>';
        const element = document.getElementById('test-element');
        
        shakeElement(element, 1000);
        expect(element.classList.contains('shake')).toBe(true);
        
        jest.advanceTimersByTime(1000);
        expect(element.classList.contains('shake')).toBe(false);
        
        jest.useRealTimers();
    });

    test('空元素应该不报错', () => {
        expect(() => shakeElement(null)).not.toThrow();
    });
});

describe('updateCenterText', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="center-text"></div>';
    });

    test('应该更新中心文本', () => {
        updateCenterText('测试文本');
        const centerText = document.getElementById('center-text');
        
        expect(centerText.textContent).toBe('测试文本');
        expect(centerText.classList.contains('opacity-100')).toBe(true);
    });

    test('应该设置自动隐藏定时器', () => {
        jest.useFakeTimers();
        
        updateCenterText('测试文本');
        const centerText = document.getElementById('center-text');
        
        expect(centerText.classList.contains('opacity-100')).toBe(true);
        
        jest.advanceTimersByTime(3000);
        expect(centerText.classList.contains('opacity-100')).toBe(false);
        
        jest.useRealTimers();
    });
});

describe('updateGameStep', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="game-step"></div>';
    });

    test('应该更新游戏步骤文本', () => {
        updateGameStep('天亮了');
        const gameStep = document.getElementById('game-step');
        
        expect(gameStep.textContent).toBe('天亮了');
    });

    test('元素不存在时应该不报错', () => {
        document.body.innerHTML = '';
        
        expect(() => updateGameStep('测试文本')).not.toThrow();
    });
});

describe('toggleAutoPlay', () => {
    beforeEach(() => {
        document.body.innerHTML = '<button id="auto-play-btn">自动播放</button>';
    });

    test('应该切换按钮文本', () => {
        const autoPlayBtn = document.getElementById('auto-play-btn');
        
        toggleAutoPlay();
        expect(autoPlayBtn.textContent).toBe('停止自动');
        
        toggleAutoPlay();
        expect(autoPlayBtn.textContent).toBe('自动播放');
    });

    test('按钮不存在时应该不报错', () => {
        document.body.innerHTML = '';
        
        expect(() => toggleAutoPlay()).not.toThrow();
    });
});

describe('nextSpeech', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="speech-area"></div>';
    });

    test('应该隐藏发言区域', () => {
        const speechArea = document.getElementById('speech-area');
        
        nextSpeech();
        expect(speechArea.classList.contains('hidden')).toBe(true);
    });

    test('元素不存在时应该不报错', () => {
        document.body.innerHTML = '';
        
        expect(() => nextSpeech()).not.toThrow();
    });
});

describe('submitVote', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="voting-area"></div>';
    });

    test('应该隐藏投票区域', () => {
        const votingArea = document.getElementById('voting-area');
        
        submitVote();
        expect(votingArea.classList.contains('hidden')).toBe(true);
    });

    test('元素不存在时应该不报错', () => {
        document.body.innerHTML = '';
        
        expect(() => submitVote()).not.toThrow();
    });
});