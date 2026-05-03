# AI 狼人杀项目 - 单元测试说明文档

## 概述

本文档描述 `tests/` 目录下所有单元测试文件的结构、覆盖范围及运行方式。

**测试框架**: pytest + pytest-asyncio
**测试运行命令**: `python -m pytest tests/ -v`
**当前状态**: 224 个测试全部通过 ✅

---

## 测试文件总览

| 测试文件 | 测试类数 | 覆盖模块 | 主要内容 |
|---------|---------|---------|---------|
| `test_crypto.py` | 8 | `crypto.py` | 加密/解密/脱敏 |
| `test_exam.py` | 5 | `exam.py` | 题目解析/评分/文件上传安全 |
| `test_roles.py` | 7 | `game/roles.py` | 角色枚举/配置/玩家模型 |
| `test_engine.py` | 9 | `game/engine.py` | 游戏引擎核心逻辑 |
| `test_voice_config.py` | 7 | `game/voice_config.py` | 语音配置/角色音色 |
| `test_voice_player.py` | 7 | `game/voice_player.py` | 语音播放器生命周期 |
| `test_ai_player.py` | 6 | `game/ai_player.py` | AI 解析逻辑/模式配置 |
| `test_logger.py` | 5 | `logger.py` | 日志记录/文件路径 |
| `test_app.py` | 9 | `app.py` | API 端点/输入验证/配置 |

---

## 各文件详细说明

### 1. test_crypto.py — 加密模块测试

**文件**: `crypto.py`
**测试类**: 8 个 | **测试方法**: 约 25 个

| 测试类 | 说明 |
|-------|------|
| `TestEncryptApiKey` | API Key 加密：非空密钥加密、空密钥、Base64 格式验证 |
| `TestDecryptApiKey` | API Key 解密：正常解密、空密钥、无效数据、篡改数据 |
| `TestMaskApiKey` | API Key 脱敏：正常长度、短密钥、空密钥、None、8/9/长/特殊字符 |
| `TestEncryptDecryptRoundTrip` | 加解密往返：多种密钥类型、Fernet 时间戳差异、密钥变更场景 |

**关键测试点**:
- 空字符串加密/解密返回空字符串
- 篡改后的密文解密返回空字符串（Fernet 完整性校验）
- 密钥长度 < 8 时脱敏返回 `****`
- 相同明文两次加密结果不同（Fernet 内置时间戳）

---

### 2. test_exam.py — 考试模块测试

**文件**: `exam.py`
**测试类**: 5 个 | **测试方法**: 约 20 个

| 测试类 | 说明 |
|-------|------|
| `TestParseExamQuestions` | 题目解析：有效文件、空文件、广告过滤 |
| `TestEvaluateAnswer` | 答案评分：数字正确、文本包含、错误答案、浮点容差、空答案 |
| `TestSaveUploadedFile` | 文件上传安全：正常保存、超大文件拒绝、非法扩展名、路径遍历、UUID 命名 |
| `TestEvaluateAnswerEdgeCases` | 评分边界：双方空、单方空、纯空白、浮点精确/容差/超容差、负数、文本包含、完全不同文本 |
| `TestParseExamQuestionsEdgeCases` | 解析边界：仅广告文件、无答案行、无标签答案、多行答案、特殊字符、连续多题、冒号格式变体 |

**关键测试点**:
- `"" in ""` 返回 `True` 的 Python 特性已通过前置条件过滤
- 文件上传使用 UUID 文件名，防止路径遍历
- 仅允许 `.txt` 扩展名，文件大小限制 1MB
- 浮点数比较容差为 0.1

---

### 3. test_roles.py — 角色与玩家模型测试

**文件**: `game/roles.py`
**测试类**: 7 个 | **测试方法**: 约 30 个

| 测试类 | 说明 |
|-------|------|
| `TestRoleType` | 角色枚举：所有角色存在、枚举值、字符串比较 |
| `TestRoleInfo` | 角色信息：所有角色有配置、必需字段、阵营验证、名称/emoji |
| `TestGameConfigs` | 游戏配置：6/8/10 人局角色数量匹配、各配置角色分布、描述字段 |
| `TestDefaultNames` | 默认名称：数量 ≥ 10、不重复 |
| `TestModelConfig` | 模型配置：默认值、自定义值 |
| `TestPlayer` | 玩家模型：默认属性、角色属性、阵营、to_dict 显示/隐藏角色、死亡状态 |

**关键测试点**:
- 6 人局：2 狼人 / 1 预言家 / 1 女巫 / 2 村民（无守卫、无猎人）
- 8 人局：2 狼人 / 1 预言家 / 1 女巫 / 1 猎人 / 3 村民（有猎人、无守卫）
- 10 人局：3 狼人 / 1 预言家 / 1 女巫 / 1 猎人 / 1 守卫 / 3 村民
- `to_dict(reveal_role=False)` 隐藏角色信息，防止前端泄露

---

### 4. test_engine.py — 游戏引擎测试

**文件**: `game/engine.py`
**测试类**: 9 个 | **测试方法**: 约 40 个

| 测试类 | 说明 |
|-------|------|
| `TestGameEngineInit` | 初始化：默认属性、角色分配、存活状态、座位号、唯一 ID、女巫/守卫初始状态 |
| `TestGameEnginePlayerQueries` | 玩家查询：存活玩家、按角色筛选、按 ID/名查找、死亡后查询 |
| `TestGameEngineGameOver` | 结束判定：初始未结束、好人胜、狼人胜(等量/超量)、游戏继续、全灭 |
| `TestResolveNight` | 夜晚结算：简单击杀、女巫救人、守卫保护、毒药击杀、平安夜、救毒同时、去重、守卫不防毒 |
| `TestBuildGameState` | 状态构建：必需字段、初始值、额外字段合并 |
| `TestGameEngineBroadcast` | 广播：无回调不报错、有回调正确调用 |
| `TestGameEngineDifferentPlayerCounts` | 不同人数：8人局/10人局初始化 |
| `TestGetStateSummary` | 状态摘要：必需字段、玩家角色信息 |

**关键测试点**:
- 游戏结束条件：狼人数量 ≥ 好人数量时狼人胜，狼人为 0 时好人胜
- 夜晚结算去重：同一玩家不会被击杀和毒杀重复记录
- 守卫不能防止毒药
- 女巫救药和毒药同时选择时优先救人

---

### 5. test_voice_config.py — 语音配置测试

**文件**: `game/voice_config.py`
**测试类**: 7 个 | **测试方法**: 约 16 个

| 测试类 | 说明 |
|-------|------|
| `TestVoiceGender` | 语音性别枚举值 |
| `TestVoiceStyle` | 语音风格枚举值 |
| `TestVoiceConfigs` | 角色音色配置：所有角色有配置、必需字段、语速/音调/音量范围、语言、风格验证 |
| `TestGetVoiceConfig` | 获取配置 |
| `TestGetVoiceParams` | 获取语音参数：返回字段、参数类型 |

**关键测试点**:
- 狼人：攻击性风格
- 预言家：神秘风格
- 村民：友好风格
- 所有角色语言为 `zh-CN`

---

### 6. test_voice_player.py — 语音播放器测试

**文件**: `game/voice_player.py`
**测试类**: 7 个 | **测试方法**: 约 14 个

| 测试类 | 说明 |
|-------|------|
| `TestVoicePlayerInit` | 初始状态：默认属性、回调函数初始值、回调设置 |
| `TestVoicePlayerStartStop` | 启动/停止：创建任务、清除任务、重复启动 |
| `TestVoicePlayerSpeak` | 语音播放：加入队列、空文本过滤、空白文本过滤、数据格式 |
| `TestVoicePlayerIsBusy` | 忙状态：初始不忙、队列有任务时忙 |
| `TestVoicePlayerClearQueue` | 清空队列 |

**关键测试点**:
- 空文本和纯空白文本不会加入队列
- 语音数据包含 id/text/role_type/player_name/voice_params
- 重复启动不会创建多个后台任务

---

### 7. test_ai_player.py — AI 玩家解析测试

**文件**: `game/ai_player.py`
**测试类**: 6 个 | **测试方法**: 约 28 个

| 测试类 | 说明 |
|-------|------|
| `TestGetModeConfig` | 模式配置：6/8/10 人局描述、未知人数回退 |
| `TestAIPlayerParseTarget` | 目标解析：直接匹配、冒号格式、括号格式、选择格式、多名字、空列表回退 |
| `TestAIPlayerParseWitchAction` | 女巫行为：使用解药、使用毒药、同时使用(救优先)、不行动、无药水、否定表达 |
| `TestAIPlayerPersonality` | 人格获取：默认人格、自定义人格、空自定义回退 |
| `TestAIPlayerClientConfig` | 客户端配置：有效配置、无配置、缺少 key、回退到可用配置 |

**关键测试点**:
- 目标解析支持多种格式：`投票：张三`、`投票：【张三】`、`选择 张三`
- 女巫否定表达：`不救`、`不毒` 不应被解析为使用药水
- 同一晚只能使用一种药水（同时选择时优先救人）

---

### 8. test_logger.py — 日志模块测试

**文件**: `logger.py`
**测试类**: 5 个 | **测试方法**: 约 13 个

| 测试类 | 说明 |
|-------|------|
| `TestLogGameEvent` | 游戏事件：INFO/DEBUG/WARNING/ERROR 级别、额外 kwargs |
| `TestLogPlayerAction` | 玩家行为：基本行为、无详情 |
| `TestLogError` | 错误日志：有异常、None 错误、玩家名、空上下文 |
| `TestLogGameStartEnd` | 游戏开始/结束：正常记录、None 胜利方 |
| `TestLogFilePath` | 日志文件路径：game.log / error.log |

---

### 9. test_app.py — API 端点测试

**文件**: `app.py`
**测试类**: 9 个 | **测试方法**: 约 26 个

| 测试类 | 说明 |
|-------|------|
| `TestFilterThinkProcess` | 思考过滤：移除 think 标签、未闭合标签、答/答案是/所以/因此/那么、空字符串 |
| `TestIndexEndpoint` | 主页端点 |
| `TestConfigEndpoints` | 配置端点：获取配置(脱敏)、保存供应商(有/无 ID)、删除(存在/不存在) |
| `TestGameConfigsEndpoint` | 游戏配置端点：返回所有配置、包含描述 |
| `TestGameStatusEndpoint` | 游戏状态端点：无游戏时返回 running=False |
| `TestProviderInputValidation` | Provider 输入验证：合法 URL、非法 URL(ftp)、空 URL、空格修剪、合法/非法 ID |
| `TestGameStartInputValidation` | 游戏开始输入验证：默认 6 人、合法人数、太小/太大拒绝 |
| `TestLoadSaveConfig` | 配置加载/保存：不存在文件返回空、保存后正确加载、创建文件 |

**关键测试点**:
- `filter_think_process` 支持多种格式：`<think>...</think>`、`答：XX`、`答案是 XX`、`所以/因此 XX`
- API Key 在返回前端时自动脱敏
- Provider ID 只能包含字母、数字、下划线和连字符
- 游戏人数限制为 6-10 人

---

## 运行方式

### 运行全部测试
```bash
python -m pytest tests/ -v
```

### 运行单个测试文件
```bash
python -m pytest tests/test_engine.py -v
```

### 运行单个测试类
```bash
python -m pytest tests/test_engine.py::TestResolveNight -v
```

### 运行单个测试方法
```bash
python -m pytest tests/test_engine.py::TestResolveNight::test_simple_kill -v
```

### 查看测试覆盖率报告
```bash
python -m pytest tests/ --cov=. --cov-report=html
```

---

## 测试编写规范

1. **命名**: 测试文件 `test_*.py`，测试类 `Test*`，测试方法 `test_*`
2. **每个测试方法只验证一个行为**，方法名清晰描述预期行为
3. **使用中文 docstring** 说明测试目的
4. **异步测试** 使用 `@pytest.mark.asyncio` 装饰器
5. **临时文件/目录** 使用 `tmp_path` fixture，避免污染项目目录
6. **Mock 外部依赖**（如 LLM API、文件系统）确保测试可重复
7. **不依赖测试执行顺序**，每个测试独立可运行

---

## 覆盖范围总结

| 模块 | 文件 | 测试覆盖 | 说明 |
|-----|------|---------|------|
| 加密 | `crypto.py` | ✅ 完整 | 加密/解密/脱敏全部路径 |
| 考试 | `exam.py` | ✅ 完整 | 解析/评分/文件安全 |
| 角色 | `game/roles.py` | ✅ 完整 | 所有数据模型 |
| 引擎 | `game/engine.py` | ✅ 核心逻辑 | 初始化/查询/结算/判定 |
| 语音配置 | `game/voice_config.py` | ✅ 完整 | 所有配置项 |
| 语音播放 | `game/voice_player.py` | ✅ 核心逻辑 | 生命周期/队列 |
| AI 玩家 | `game/ai_player.py` | ✅ 可测试部分 | 解析/人格/配置 |
| 日志 | `logger.py` | ✅ 完整 | 所有日志函数 |
| API | `app.py` | ✅ 核心逻辑 | 端点/验证/配置 |
