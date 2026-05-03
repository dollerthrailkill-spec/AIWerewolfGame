// Jest 测试环境初始化

// 模拟 DOM 环境 - 必须在加载 app.js 之前设置
document.body.innerHTML = `
  <div id="home-page"></div>
  <div id="game-page" class="hidden"></div>
  <div id="settings-modal" class="hidden"></div>
  <div id="role-edit-modal" class="hidden"></div>
  <div id="mvp-vote-modal" class="hidden"></div>
  <div id="game-over-modal" class="hidden"></div>
  <div id="api-error-modal" class="hidden"></div>
  <div id="seats-container"></div>
  <div id="center-text"></div>
  <div id="speech-area" class="hidden"></div>
  <div id="voting-area" class="hidden"></div>
  <div id="eulogy-overlay" class="hidden">
    <span id="eulogy-player-name"></span>
  </div>
  <div id="action-connections"></div>
  <div class="relative w-full max-w-6xl"></div>
  <div id="game-step"></div>
  <button id="auto-play-btn">自动播放</button>
  <div id="transition-overlay" class="hidden">
    <div id="transition-text"></div>
  </div>
`;

require('@testing-library/jest-dom');

// 模拟 WebSocket
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 10);
  }
  send(data) {
    this.lastSent = data;
  }
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
};

// 模拟 Audio API
global.Audio = class MockAudio {
  constructor() {
    this.src = '';
    this.volume = 1;
    this.loop = false;
  }
  play() { return Promise.resolve(); }
  pause() {}
  load() {}
};

// 模拟 Web Audio API
global.AudioContext = class MockAudioContext {
  constructor() {
    this.currentTime = 0;
  }
  createOscillator() {
    return {
      connect: () => {},
      frequency: { value: 0 },
      type: 'sine',
      start: () => {},
      stop: () => {}
    };
  }
  createGain() {
    return {
      connect: () => {},
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      }
    };
  }
};

// 模拟 localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// 模拟 window.alert 和 confirm
window.alert = jest.fn();
window.confirm = jest.fn(() => true);

// 注意：app.js 已被模块化拆分到各个子模块中，
// 测试文件（utils.test.js / dom.test.js）各自包含被测试函数的副本，
// 因此此处不再 require app.js。
