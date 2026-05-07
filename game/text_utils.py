"""
text_utils.py - 文本处理工具函数

提供LLM响应文本的过滤、清理和解析功能。
从 app.py 中提取，消除 game 模块对 app 模块的循环依赖。
"""
import re


def filter_think_process(text: str) -> str:
    """过滤掉思考过程标记，只保留最终答案

    支持以下格式：
    -  thinking... response 标签对（包括大小写变体）
    - <reasoning>...</reasoning> 标签对
    - 【思考】...【/思考】等中文标记
    """
    original_text = text.strip()
    if not original_text:
        return ""

    # 1. 优先使用正则移除所有思考标签对（最可靠的方式）
    think_patterns = [
        r'\s*<think(?:ing)?>[\s\S]*?</think(?:ing)?>',
        r'\s*thinking[\s\S]*?response',
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

    # 2. 处理未闭合的  thinking 标签：取  thinking 之后的内容
    unclosed_match = re.search(r'\s*<think(?:ing)?>\s*(.*)', original_text, re.IGNORECASE | re.DOTALL)
    if unclosed_match:
        after_think = unclosed_match.group(1).strip()
        if after_think:
            lines = [l.strip() for l in after_think.split('\n') if l.strip()]
            if lines:
                return lines[-1]

    # 3. 尝试提取"答："后的内容
    answer_match = re.search(r'答[：:]\s*(.*)', original_text, re.DOTALL)
    if answer_match:
        candidate = answer_match.group(1).strip()
        if candidate:
            return candidate

    # 4. 尝试提取"答案是"后的内容
    answer_is_match = re.search(r'答案[是为：:]\s*(.*)', original_text, re.DOTALL)
    if answer_is_match:
        candidate = answer_is_match.group(1).strip()
        if candidate:
            return candidate

    # 5. 尝试提取"所以/因此/那么"等结论关键词后的内容
    conclusion_match = re.search(r'(?:所以|因此|那么|综上|最终答案[是为：:]?)\s*(.+)', original_text, re.DOTALL)
    if conclusion_match:
        candidate = conclusion_match.group(1).strip()
        if candidate:
            return candidate

    # 6. 如果原始文本有多行，取最后非空行（可能是答案）
    lines = [l.strip() for l in original_text.split('\n') if l.strip()]
    if len(lines) > 1:
        return lines[-1]

    # 7. 默认返回原始内容
    return original_text
