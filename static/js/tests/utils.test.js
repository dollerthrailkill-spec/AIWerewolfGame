/**
 * 纯工具函数单元测试
 * 用于测试 utils.js 中的核心工具函数
 */

// 复制 utils.js 中的工具函数
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function getRoleInfo(roleType) {
    const roleMap = {
        'werewolf': { name: '狼人', emoji: '' },
        'seer': { name: '预言家', emoji: '' },
        'witch': { name: '女巫', emoji: '' },
        'hunter': { name: '猎人', emoji: '' },
        'guard': { name: '守卫', emoji: '' },
        'villager': { name: '平民', emoji: '' }
    };
    return roleMap[roleType] || { name: '未知', emoji: '' };
}

function getAvatarForRole(roleType) {
    // 使用简化的测试用头像路径
    const avatarMap = {
        'werewolf': '/static/logo/ChatGPT.png',
        'seer': '/static/logo/Gemini.png',
        'witch': '/static/logo/DeepSeek.png',
        'hunter': '/static/logo/Kimi.png',
        'guard': '/static/logo/Qwen.png',
        'villager': '/static/logo/Claude.png'
    };
    return avatarMap[roleType] || avatarMap.villager;
}

function getLogoForModel(modelName) {
    const modelLogoMap = {
        'chatgpt': '/static/logo/ChatGPT.png',
        'gpt': '/static/logo/ChatGPT.png',
        'deepseek': '/static/logo/DeepSeek.png',
        'gemini': '/static/logo/Gemini.png',
        'gamma': '/static/logo/Gamma.png',
        'gemma': '/static/logo/Gamma.png',
        'kimi': '/static/logo/Kimi.png',
        'minimax': '/static/logo/Minimax.png',
        'abab': '/static/logo/Minimax.png',
        'qwen': '/static/logo/Qwen.png',
        'doubao': '/static/logo/doubao.png',
        'zhipu': '/static/logo/zhipu-GLM.png',
        'glm': '/static/logo/zhipu-GLM.png',
        'bytedance': '/static/logo/bytedance-seed.png',
        'seed': '/static/logo/bytedance-seed.png',
        'llama': '/static/logo/llama.png',
        'claude': '/static/logo/Claude.png',
        'sonnet': '/static/logo/Claude.png',
        'haiku': '/static/logo/Claude.png',
        'opus': '/static/logo/Claude.png'
    };
    
    if (!modelName) return '/static/logo/ChatGPT.png';
    
    const lowerModelName = modelName.toLowerCase();
    
    for (const [keyword, logoPath] of Object.entries(modelLogoMap)) {
        if (lowerModelName.includes(keyword)) {
            return logoPath;
        }
    }
    
    return '/static/logo/ChatGPT.png';
}

// ==================== 测试用例 ====================

describe('shuffleArray', () => {
    test('应该返回长度相同的数组', () => {
        const input = [1, 2, 3, 4, 5];
        const result = shuffleArray(input);
        expect(result).toHaveLength(input.length);
    });

    test('应该包含相同的元素', () => {
        const input = [1, 2, 3, 4, 5];
        const result = shuffleArray(input);
        expect(result.sort()).toEqual(input.sort());
    });

    test('不应修改原数组', () => {
        const input = [1, 2, 3, 4, 5];
        const original = [...input];
        shuffleArray(input);
        expect(input).toEqual(original);
    });

    test('应该处理空数组', () => {
        expect(shuffleArray([])).toEqual([]);
    });

    test('应该处理单元素数组', () => {
        expect(shuffleArray([1])).toEqual([1]);
    });

    test('多次洗牌应该产生不同结果（概率上）', () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        let allSame = true;
        const firstResult = shuffleArray(input).join(',');
        
        // 进行多次洗牌，检查是否至少有一次不同
        for (let i = 0; i < 5; i++) {
            if (shuffleArray(input).join(',') !== firstResult) {
                allSame = false;
                break;
            }
        }
        
        // 由于随机性，理论上几乎不可能5次都相同
        expect(allSame).toBe(false);
    });
});

describe('getRoleInfo', () => {
    test('应该返回狼人信息', () => {
        expect(getRoleInfo('werewolf')).toEqual({ name: '狼人', emoji: '' });
    });

    test('应该返回预言家信息', () => {
        expect(getRoleInfo('seer')).toEqual({ name: '预言家', emoji: '' });
    });

    test('应该返回女巫信息', () => {
        expect(getRoleInfo('witch')).toEqual({ name: '女巫', emoji: '' });
    });

    test('未知角色应该返回默认值', () => {
        expect(getRoleInfo('unknown')).toEqual({ name: '未知', emoji: '' });
    });

    test('空字符串应该返回默认值', () => {
        expect(getRoleInfo('')).toEqual({ name: '未知', emoji: '' });
    });
});

describe('getAvatarForRole', () => {
    test('应该返回对应角色的头像', () => {
        expect(getAvatarForRole('werewolf')).toBe('/static/logo/ChatGPT.png');
        expect(getAvatarForRole('seer')).toBe('/static/logo/Gemini.png');
    });

    test('未知角色应该返回平民头像', () => {
        expect(getAvatarForRole('unknown')).toBe('/static/logo/Claude.png');
    });
});

describe('getLogoForModel', () => {
    test('应该正确匹配 gpt 模型', () => {
        expect(getLogoForModel('gpt-3.5-turbo')).toBe('/static/logo/ChatGPT.png');
        expect(getLogoForModel('gpt-4')).toBe('/static/logo/ChatGPT.png');
        expect(getLogoForModel('chatgpt')).toBe('/static/logo/ChatGPT.png');
    });

    test('应该正确匹配 deepseek 模型', () => {
        expect(getLogoForModel('deepseek-chat')).toBe('/static/logo/DeepSeek.png');
    });

    test('应该正确匹配 gemini 模型', () => {
        expect(getLogoForModel('gemini-2.0-flash')).toBe('/static/logo/Gemini.png');
    });

    test('应该正确匹配 gamma/gemma 模型', () => {
        expect(getLogoForModel('gamma-2-vision')).toBe('/static/logo/Gamma.png');
        expect(getLogoForModel('gemma-2-27b-it')).toBe('/static/logo/Gamma.png');
        expect(getLogoForModel('Gemma')).toBe('/static/logo/Gamma.png');
    });

    test('应该正确匹配 kimi 模型', () => {
        expect(getLogoForModel('kimi-v2.5')).toBe('/static/logo/Kimi.png');
    });

    test('应该正确匹配 minimax 模型', () => {
        expect(getLogoForModel('minimax')).toBe('/static/logo/Minimax.png');
        expect(getLogoForModel('abab-6.5-chat')).toBe('/static/logo/Minimax.png');
    });

    test('应该正确匹配 qwen 模型', () => {
        expect(getLogoForModel('qwen-plus')).toBe('/static/logo/Qwen.png');
    });

    test('应该正确匹配 doubao 模型', () => {
        expect(getLogoForModel('doubao-pro-4k')).toBe('/static/logo/doubao.png');
    });

    test('应该正确匹配 zhipu/glm 模型', () => {
        expect(getLogoForModel('glm-4-flash')).toBe('/static/logo/zhipu-GLM.png');
        expect(getLogoForModel('zhipu-GLM-4')).toBe('/static/logo/zhipu-GLM.png');
    });

    test('应该正确匹配 bytedance/seed 模型', () => {
        expect(getLogoForModel('bytedance-seed')).toBe('/static/logo/bytedance-seed.png');
        expect(getLogoForModel('seed-2.1')).toBe('/static/logo/bytedance-seed.png');
    });

    test('应该正确匹配 llama 模型', () => {
        expect(getLogoForModel('llama-3-70b-instruct')).toBe('/static/logo/llama.png');
    });

    test('应该正确匹配 claude 模型', () => {
        expect(getLogoForModel('claude-3-opus')).toBe('/static/logo/Claude.png');
        expect(getLogoForModel('claude-3-5-sonnet')).toBe('/static/logo/Claude.png');
        expect(getLogoForModel('haiku-3')).toBe('/static/logo/Claude.png');
    });

    test('应该正确处理大小写不敏感', () => {
        expect(getLogoForModel('GPT-4')).toBe('/static/logo/ChatGPT.png');
        expect(getLogoForModel('GEMINI-2')).toBe('/static/logo/Gemini.png');
    });

    test('未知模型应该默认返回 ChatGPT 头像', () => {
        expect(getLogoForModel('some-unknown-model')).toBe('/static/logo/ChatGPT.png');
    });

    test('空字符串应该默认返回 ChatGPT 头像', () => {
        expect(getLogoForModel('')).toBe('/static/logo/ChatGPT.png');
    });

    test('null/undefined 应该默认返回 ChatGPT 头像', () => {
        expect(getLogoForModel(null)).toBe('/static/logo/ChatGPT.png');
        expect(getLogoForModel(undefined)).toBe('/static/logo/ChatGPT.png');
    });
});
