import os
import stat
from cryptography.fernet import Fernet

_KEY_FILE = os.path.join(os.path.dirname(__file__), "data", ".enc_key")


def _ensure_data_dir():
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


def _restrict_file_permission(file_path: str):
    """限制文件权限为仅当前用户可读写（Windows 上使用 ACL，Unix 上使用 chmod）"""
    try:
        if os.name == 'nt':
            # Windows: 使用 ACL 限制为仅当前用户可读写
            import subprocess
            # 先移除所有现有权限（继承的），再为当前用户添加读写权限
            # icacls 命令: /grant 授予权限, /inheritance:r 移除继承, /q 静默模式
            subprocess.run(
                ['icacls', file_path, '/inheritance:r',
                 '/grant', f'{os.getlogin()}:RW', '/q'],
                capture_output=True, timeout=5
            )
        else:
            # Unix/Linux/macOS: 设置权限为 600 (仅所有者可读写)
            os.chmod(file_path, stat.S_IRUSR | stat.S_IWUSR)
    except Exception:
        pass  # 权限设置失败不应阻塞核心功能


def _get_or_create_key() -> bytes:
    _ensure_data_dir()
    if os.path.exists(_KEY_FILE):
        with open(_KEY_FILE, "rb") as f:
            return f.read()

    key = Fernet.generate_key()
    with open(_KEY_FILE, "wb") as f:
        f.write(key)
    _restrict_file_permission(_KEY_FILE)
    return key


def _get_fernet() -> Fernet:
    key = _get_or_create_key()
    return Fernet(key)


_ENCRYPTED_PREFIX = "enc:"


def encrypt_api_key(api_key: str) -> str:
    if not api_key:
        return ""
    f = _get_fernet()
    # Fernet 返回的已经是 base64 编码的 bytes，无需再次 base64 编码
    # 添加 enc: 前缀以明确标记为加密格式，防止与明文混淆
    return _ENCRYPTED_PREFIX + f.encrypt(api_key.encode("utf-8")).decode("utf-8")


def decrypt_api_key(encrypted_key: str) -> str:
    if not encrypted_key:
        return ""
    # 去除加密前缀（如果存在）
    key_to_decrypt = encrypted_key
    if key_to_decrypt.startswith(_ENCRYPTED_PREFIX):
        key_to_decrypt = key_to_decrypt[len(_ENCRYPTED_PREFIX):]
    try:
        f = _get_fernet()
        # 直接解密，Fernet 内部会处理 base64 解码
        decrypted = f.decrypt(key_to_decrypt.encode("utf-8"))
        return decrypted.decode("utf-8")
    except Exception:
        return ""


def mask_api_key(api_key: str) -> str:
    if not api_key or len(api_key) < 8:
        return "****"
    return api_key[:4] + "****" + api_key[-4:]


def _is_encrypted_key(api_key: str) -> bool:
    """安全地判断 api_key 是否已经是加密格式

    优先通过 enc: 前缀判断，同时也支持检测无前缀的遗留加密格式。
    """
    if not api_key:
        return False
    # 方式 1: 有加密前缀，直接判定为加密格式
    if api_key.startswith(_ENCRYPTED_PREFIX):
        return True
    # 方式 2: 无前缀的遗留加密格式，尝试解密确认
    # 注意：Fernet 密文通常以 gAAAAA 开头（base64 编码的版本字节 0x80）
    # 但为了避免误判，我们只对看起来像 Fernet 密文的字符串尝试解密
    if api_key.startswith("gAAAAA") and len(api_key) > 100:
        try:
            f = _get_fernet()
            f.decrypt(api_key.encode("utf-8"))
            return True
        except Exception:
            return False
    return False


def _safe_decrypt_api_key(api_key: str) -> str:
    """安全地解密 API Key

    如果已经是加密格式则解密，否则原样返回（认为是明文）。
    这样前端传递明文 key 或加密 key 都能正确处理。
    """
    if not api_key:
        return ""
    if _is_encrypted_key(api_key):
        return decrypt_api_key(api_key)
    return api_key
