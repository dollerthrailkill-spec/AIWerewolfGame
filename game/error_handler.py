"""
error_handler.py - 统一的异常处理工具

提供标准化的异常捕获、日志记录和错误响应生成。
"""
import logging
from typing import Optional, Any
from logger import log_error

logger = logging.getLogger(__name__)


def safe_execute(func, default=None, context: str = "", log_exception: bool = True):
    """安全执行函数，捕获异常并返回默认值

    Args:
        func: 要执行的函数
        default: 异常时返回的默认值
        context: 异常日志上下文描述
        log_exception: 是否记录异常日志

    Returns:
        函数执行结果或默认值
    """
    try:
        return func()
    except Exception as e:
        if log_exception:
            log_error(e, context=context or f"执行 {func.__name__} 时出错")
        return default


async def safe_execute_async(func, default=None, context: str = "", log_exception: bool = True):
    """安全执行异步函数，捕获异常并返回默认值

    Args:
        func: 要执行的异步函数
        default: 异常时返回的默认值
        context: 异常日志上下文描述
        log_exception: 是否记录异常日志

    Returns:
        函数执行结果或默认值
    """
    try:
        return await func()
    except Exception as e:
        if log_exception:
            log_error(e, context=context or f"异步执行 {func.__name__} 时出错")
        return default


def handle_api_error(e: Exception, context: str = "") -> dict:
    """将异常转换为 API 错误响应

    Args:
        e: 捕获的异常
        context: 异常上下文

    Returns:
        包含错误信息的字典
    """
    log_error(e, context=context)
    return {
        "success": False,
        "error": str(e) if str(e) else f"内部错误: {context}"
    }
