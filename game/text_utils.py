"""
text_utils.py - 文本处理工具函数

提供LLM响应文本的过滤、清理和解析功能。
从 app.py 中提取，消除 game 模块对 app 模块的循环依赖。
"""
import re


def filter_think_process(text: str) -> str:
    """过滤掉思考过程标记，只保留最终答案

    支持以下格式：
    - <think>...</think> 标签对（包括大小写变体）
    - <reasoning>...</reasoning> 标签对
    - 【思考】...【/思考】等中文标记
    """
    original_text = text.strip()

    # 1. 优先使用正则移除所有思考标签对（最可靠的方式）
    # 匹配 <think>...</think>、<reasoning>...</reasoning> 等
    think_patterns = [
        r'<think>[\s\S]*?</think>',
        r'<reasoning>[\s\S]*?</reasoning>',
        r'【思考】[\s\S]*?【/思考】',
        r'【分析】[\s\S]*?【/分析】',
        r'Thinking Process[\s\S]*?(?=\n\n|\Z)',
    ]
    cleaned = original_text
    for pattern in think_patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE | re.DOTALL)

    cleaned = cleaned.strip()
    if cleaned:
        return cleaned

    # 2. 如果正则没有匹配到，尝试提取"答："后的内容
    answer_match = re.search(r'答[：:]\s*(.*)', original_text, re.DOTALL)
    if answer_match:
        candidate = answer_match.group(1).strip()
        if candidate:
            return candidate

    # 3. 默认返回原始内容（去除首尾空白）
    return original_text
