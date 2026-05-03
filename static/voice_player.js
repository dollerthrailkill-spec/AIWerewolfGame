// 语音播放器模块 - 基于 Web Speech API
class VoicePlayer {
    constructor() {
        this.synth = window.speechSynthesis;
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.currentSpeechTask = null; // 当前正在播放的语音任务
        this.voiceQueue = [];
        this.isStopping = false; // 防止重复调用的标志
        
        // 角色音色配置
        this.voiceConfigs = {
            werewolf: { rate: 0.9, pitch: 0.7, volume: 1.0, gender: 'male', voiceIndex: 0 },
            seer: { rate: 0.8, pitch: 1.5, volume: 0.9, gender: 'female', voiceIndex: 1 },
            witch: { rate: 1.0, pitch: 1.3, volume: 1.0, gender: 'female', voiceIndex: 2 },
            hunter: { rate: 1.1, pitch: 0.6, volume: 1.1, gender: 'male', voiceIndex: 3 },
            guard: { rate: 0.9, pitch: 0.8, volume: 0.95, gender: 'male', voiceIndex: 4 },
            villager: { rate: 1.0, pitch: 1.0, volume: 0.9, gender: 'neutral', voiceIndex: 5 }
        };
        
        // 角色声音映射
        this.roleToVoiceIndex = {};
        
        // 检查浏览器支持
        this.supported = this._checkSupport();
        
        // 初始化语音
        this._initVoices();
    }
    
    _checkSupport() {
        if (!('speechSynthesis' in window)) {
            console.warn('浏览器不支持 Web Speech API');
            return false;
        }
        return true;
    }
    
    _initVoices() {
        if (!this.supported) return;
        
        // 等待语音加载
        const loadVoices = () => {
            const voices = this.synth.getVoices();
            if (voices.length > 0) {
                console.log(`可用语音: ${voices.length} 种`);
                this.availableVoices = voices;
                
                // 输出所有可用语音信息
                this._logAvailableVoices();
                
                // 为角色分配声音
                this._assignVoicesToRoles();
            }
        };
        
        if (this.synth.getVoices().length > 0) {
            loadVoices();
        } else {
            this.synth.onvoiceschanged = loadVoices;
        }
    }
    
    _logAvailableVoices() {
        if (!this.availableVoices) return;
        
        console.log('=== 可用语音列表 ===');
        this.availableVoices.forEach((voice, index) => {
            console.log(`[${index}] ${voice.name} - ${voice.lang} - ${voice.localService ? '本地' : '网络'}`);
        });
        console.log('==================');
    }
    
    _assignVoicesToRoles() {
        if (!this.availableVoices || this.availableVoices.length === 0) return;
        
        // 获取所有中文语音
        const chineseVoices = this.availableVoices.filter(voice => 
            voice.lang.toLowerCase().includes('zh') || voice.lang.toLowerCase().includes('cn')
        );
        
        let voicesToUse = chineseVoices.length > 0 ? chineseVoices : this.availableVoices;
        
        console.log(`为角色分配声音，使用 ${voicesToUse.length} 个语音`);
        
        // 为每个角色分配不同的声音索引（循环使用所有可用声音）
        const roles = ['werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager'];
        roles.forEach((role, index) => {
            const voiceIndex = index % voicesToUse.length;
            this.roleToVoiceIndex[role] = voiceIndex;
            this.voiceConfigs[role].voiceIndex = voiceIndex;
            
            console.log(`角色 ${role} 使用语音 [${voiceIndex}]: ${voicesToUse[voiceIndex].name}`);
        });
    }
    
    // 获取角色对应的语音
    _getVoiceForRole(roleType) {
        if (!this.availableVoices || this.availableVoices.length === 0) return null;
        
        // 获取所有中文语音
        const chineseVoices = this.availableVoices.filter(voice => 
            voice.lang.toLowerCase().includes('zh') || voice.lang.toLowerCase().includes('cn')
        );
        
        let voicesToUse = chineseVoices.length > 0 ? chineseVoices : this.availableVoices;
        
        // 获取角色配置的语音索引
        const voiceIndex = this.roleToVoiceIndex[roleType] !== undefined ? this.roleToVoiceIndex[roleType] : 0;
        const safeIndex = voiceIndex % voicesToUse.length;
        
        console.log(`获取角色 ${roleType} 的语音，索引 ${safeIndex}: ${voicesToUse[safeIndex].name}`);
        
        return voicesToUse[safeIndex];
    }
    
    // 播放语音
    speak(text, roleType = 'villager', playerName = '', voiceIndex = undefined, customPitch = undefined, customRate = undefined) {
        return new Promise((resolve) => {
            if (!this.supported || !text || !text.trim()) {
                resolve();
                return;
            }
            
            const voiceConfig = this.voiceConfigs[roleType] || this.voiceConfigs.villager;
            
            // 使用自定义参数（如果提供）
            const finalConfig = { ...voiceConfig };
            if (customPitch !== undefined) finalConfig.pitch = customPitch;
            if (customRate !== undefined) finalConfig.rate = customRate;
            
            // 创建语音任务
            const speechTask = {
                text: text,
                roleType: roleType,
                playerName: playerName,
                config: finalConfig,
                voiceIndex: voiceIndex,
                resolve: resolve
            };
            
            // 如果正在播放，加入队列；否则立即播放
            if (this.isSpeaking) {
                this.voiceQueue.push(speechTask);
                console.log(`语音加入队列: ${playerName} - ${text.substring(0, 30)}...`);
            } else {
                this._playSpeech(speechTask);
            }
        });
    }
    
    _playSpeech(speechTask) {
        if (!this.supported) {
            speechTask.resolve();
            return;
        }
        
        // 如果正在停止，则直接解析任务
        if (this.isStopping) {
            speechTask.resolve();
            return;
        }
        
        this.isSpeaking = true;
        this.currentSpeechTask = speechTask;
        
        const utterance = new SpeechSynthesisUtterance(speechTask.text);
        
        // 设置语音参数
        utterance.rate = speechTask.config.rate;
        utterance.pitch = speechTask.config.pitch;
        utterance.volume = speechTask.config.volume;
        utterance.lang = 'zh-CN';
        
        // 检查是否有指定的 voiceIndex
        if (speechTask.voiceIndex !== undefined && speechTask.voiceIndex >= 0) {
            // 使用指定的语音索引（原始索引）
            console.log(`🔍 尝试使用语音索引: [${speechTask.voiceIndex}]`);
            if (this.availableVoices && this.availableVoices[speechTask.voiceIndex]) {
                const voice = this.availableVoices[speechTask.voiceIndex];
                utterance.voice = voice;
                console.log(`✅ 使用语音索引 [${speechTask.voiceIndex}]: ${voice.name} (${voice.lang})`);
            } else {
                // 如果原始索引无效，则回退到角色对应语音
                console.log(`⚠️ 语音索引无效，回退到角色默认`);
                const voice = this._getVoiceForRole(speechTask.roleType);
                if (voice) {
                    utterance.voice = voice;
                    console.log(`[回退] 角色 ${speechTask.roleType} 使用语音: ${voice.name}`);
                }
            }
        } else {
            // 使用角色对应的语音
            const voice = this._getVoiceForRole(speechTask.roleType);
            if (voice) {
                utterance.voice = voice;
                console.log(`角色 ${speechTask.roleType} 使用语音: ${voice.name}`);
            }
        }
        
        // 语音播放完成
        utterance.onend = () => {
            // 如果正在停止，防止重复处理
            if (this.isStopping) {
                console.log('[VoicePlayer] 停止中，忽略 onend 事件');
                return;
            }
            
            console.log(`语音播放完成: ${speechTask.playerName}`);
            this.isSpeaking = false;
            this.currentSpeechTask = null;
            speechTask.resolve();
            
            // 播放队列中的下一个语音
            if (this.voiceQueue.length > 0) {
                const nextTask = this.voiceQueue.shift();
                setTimeout(() => this._playSpeech(nextTask), 500);
            }
        };
        
        // 语音播放错误
        utterance.onerror = (error) => {
            // 如果正在停止，防止重复处理
            if (this.isStopping) {
                console.log('[VoicePlayer] 停止中，忽略 onerror 事件');
                return;
            }
            
            console.error(`语音播放错误:`, error);
            this.isSpeaking = false;
            this.currentSpeechTask = null;
            speechTask.resolve();
            
            // 继续播放队列
            if (this.voiceQueue.length > 0) {
                const nextTask = this.voiceQueue.shift();
                setTimeout(() => this._playSpeech(nextTask), 500);
            }
        };
        
        this.currentUtterance = utterance;
        this.synth.speak(utterance);
        
        console.log(`开始播放语音: ${speechTask.playerName} - ${speechTask.text.substring(0, 30)}...`);
    }
    
    // 停止所有语音
    stop() {
        if (this.supported) {
            console.log('[VoicePlayer] stop() 被调用');
            
            // 设置停止标志，防止 onend/onerror 重复处理
            this.isStopping = true;
            
            // 取消当前语音播放
            this.synth.cancel();
            
            // 立即解析当前正在播放的任务
            if (this.currentSpeechTask && this.currentSpeechTask.resolve) {
                console.log('[VoicePlayer] 解析当前正在播放的任务');
                this.currentSpeechTask.resolve();
            }
            
            // 清空语音队列并解析所有队列中的任务
            console.log('[VoicePlayer] 清空队列，剩余任务数:', this.voiceQueue.length);
            while (this.voiceQueue.length > 0) {
                const task = this.voiceQueue.shift();
                if (task && task.resolve) {
                    task.resolve();
                }
            }
            
            // 重置状态
            this.isSpeaking = false;
            this.currentUtterance = null;
            this.currentSpeechTask = null;
            
            // 使用 setTimeout 延迟清除 isStopping 标志，确保所有事件都已处理
            setTimeout(() => {
                this.isStopping = false;
                console.log('[VoicePlayer] 停止完成，重置状态');
            }, 100);
        }
    }
    
    // 检查是否正在播放
    isBusy() {
        return this.isSpeaking || this.voiceQueue.length > 0;
    }
    
    // 获取所有可用语音列表
    getAvailableVoices() {
        if (!this.availableVoices || this.availableVoices.length === 0) {
            return [];
        }
        
        // 获取所有中文语音
        const chineseVoices = this.availableVoices.filter(voice => 
            voice.lang.toLowerCase().includes('zh') || voice.lang.toLowerCase().includes('cn')
        );
        
        let voicesToUse = chineseVoices.length > 0 ? chineseVoices : this.availableVoices;
        
        console.log('=== 可用语音列表 ===');
        this.availableVoices.forEach((voice, index) => {
            const isChinese = voice.lang.toLowerCase().includes('zh') || voice.lang.toLowerCase().includes('cn');
            console.log(`[${index}] ${voice.name} (${voice.lang}, ${voice.localService ? '本地' : '网络'}) ${isChinese ? '[中文]' : ''}`);
        });
        console.log('==================');
        
        return voicesToUse.map((voice) => ({
            index: this.availableVoices.indexOf(voice), // 使用原始索引
            name: voice.name,
            lang: voice.lang,
            localService: voice.localService
        }));
    }
    
    // 使用指定的语音索引播放语音
    speakWithVoiceIndex(text, voiceIndex, playerName = '', customPitch = 1.0, customRate = 1.0) {
        return new Promise((resolve) => {
            if (!this.supported || !text || !text.trim()) {
                resolve();
                return;
            }
            
            // 创建语音任务，使用自定义的音调和语速
            const voiceConfig = { rate: customRate, pitch: customPitch, volume: 1.0, voiceIndex: voiceIndex };
            
            const speechTask = {
                text: text,
                roleType: 'custom',
                playerName: playerName,
                config: voiceConfig,
                voiceIndex: voiceIndex,
                resolve: resolve
            };
            
            // 如果正在播放，加入队列；否则立即播放
            if (this.isSpeaking) {
                this.voiceQueue.push(speechTask);
                console.log(`语音加入队列(指定索引 ${voiceIndex}): ${playerName} - ${text.substring(0, 30)}...`);
            } else {
                this._playSpeechWithVoiceIndex(speechTask);
            }
        });
    }
    
    // 播放单个语音（支持指定语音索引）
    _playSpeechWithVoiceIndex(speechTask) {
        if (!this.supported) {
            speechTask.resolve();
            return;
        }
        
        // 如果正在停止，则直接解析任务
        if (this.isStopping) {
            speechTask.resolve();
            return;
        }
        
        this.isSpeaking = true;
        this.currentSpeechTask = speechTask;
        
        const utterance = new SpeechSynthesisUtterance(speechTask.text);
        
        // 设置语音参数
        utterance.rate = speechTask.config.rate;
        utterance.pitch = speechTask.config.pitch;
        utterance.volume = speechTask.config.volume;
        utterance.lang = 'zh-CN';
        
        // 使用指定的语音索引（原始索引）
        if (this.availableVoices && this.availableVoices[speechTask.voiceIndex]) {
            const voice = this.availableVoices[speechTask.voiceIndex];
            utterance.voice = voice;
            console.log(`使用指定语音 [${speechTask.voiceIndex}]: ${voice.name}`);
        } else if (this.availableVoices) {
            // 如果原始索引无效，回退到第一个中文语音或默认
            const chineseVoices = this.availableVoices.filter(voice => 
                voice.lang.toLowerCase().includes('zh') || voice.lang.toLowerCase().includes('cn')
            );
            const voice = chineseVoices[0] || this.availableVoices[0];
            if (voice) {
                utterance.voice = voice;
                console.log(`[回退] 使用语音: ${voice.name}`);
            }
        }
        
        // 语音播放完成
        utterance.onend = () => {
            if (this.isStopping) {
                console.log('[VoicePlayer] 停止中，忽略 onend 事件');
                return;
            }
            
            console.log(`语音播放完成: ${speechTask.playerName}`);
            this.isSpeaking = false;
            this.currentSpeechTask = null;
            speechTask.resolve();
            
            // 播放队列中的下一个语音
            if (this.voiceQueue.length > 0) {
                const nextTask = this.voiceQueue.shift();
                setTimeout(() => this._playSpeech(nextTask), 500);
            }
        };
        
        // 语音播放错误
        utterance.onerror = (error) => {
            if (this.isStopping) {
                console.log('[VoicePlayer] 停止中，忽略 onerror 事件');
                return;
            }
            
            console.error(`语音播放错误:`, error);
            this.isSpeaking = false;
            this.currentSpeechTask = null;
            speechTask.resolve();
            
            // 继续播放队列
            if (this.voiceQueue.length > 0) {
                const nextTask = this.voiceQueue.shift();
                setTimeout(() => this._playSpeech(nextTask), 500);
            }
        };
        
        this.currentUtterance = utterance;
        this.synth.speak(utterance);
        
        console.log(`开始播放语音(指定索引): ${speechTask.playerName} - ${speechTask.text.substring(0, 30)}...`);
    }
    
    // 等待所有语音播放完成
    waitForSilence() {
        return new Promise((resolve) => {
            const checkSilence = () => {
                if (!this.isBusy()) {
                    resolve();
                } else {
                    setTimeout(checkSilence, 100);
                }
            };
            checkSilence();
        });
    }
}

// 创建全局语音播放器实例
window.voicePlayer = new VoicePlayer();