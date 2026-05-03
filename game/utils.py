"""
game/utils.py - 游戏模块共享工具函数

将多个子模块中重复定义的函数提取到此公共模块，避免代码重复。
"""


def smart_truncate(text: str, max_len: int = 300) -> str:
    """智能截断文本，优先在句子边界处截断，避免截断在句子中间导致意思不全。"""
    if len(text) <= max_len:
        return text
    # 在 max_len 范围内找最后一个句子结束标记
    truncated = text[:max_len]
    # 按优先级找句子边界：句号 > 问号 > 感叹号 > 分号 > 逗号
    for delimiter in ['。', '？', '！', '；', '，']:
        last_pos = truncated.rfind(delimiter)
        if last_pos > max_len // 2:  # 至少要保留一半以上的内容
            return truncated[:last_pos + 1]
    # 找不到合适的句子边界，直接截断
    return truncated
