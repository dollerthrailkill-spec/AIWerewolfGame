"""加密模块单元测试"""
import os
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet

# 确保导入路径正确
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from crypto import encrypt_api_key, decrypt_api_key, mask_api_key


class TestEncryptApiKey:
    """测试 API Key 加密功能"""

    def test_encrypt_non_empty_key(self):
        """非空密钥应能正常加密"""
        key = "sk-test-key-12345"
        encrypted = encrypt_api_key(key)
        assert encrypted != key
        assert len(encrypted) > 0

    def test_encrypt_empty_key(self):
        """空密钥应返回空字符串"""
        assert encrypt_api_key("") == ""

    def test_encrypt_produces_base64(self):
        """加密结果去除 enc: 前缀后应为有效的 URL-safe Base64 字符串"""
        import base64
        key = "test-api-key"
        encrypted = encrypt_api_key(key)
        # 新格式带有 enc: 前缀
        assert encrypted.startswith("enc:")
        # 去除前缀后应为有效的 URL-safe Base64（Fernet 使用 urlsafe_b64encode）
        payload = encrypted[4:]
        # 补齐 base64 填充
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
        base64.urlsafe_b64decode(payload)


class TestDecryptApiKey:
    """测试 API Key 解密功能"""

    def test_decrypt_encrypted_key(self):
        """加密后再解密应得到原始密钥"""
        original = "sk-test-key-12345"
        encrypted = encrypt_api_key(original)
        decrypted = decrypt_api_key(encrypted)
        assert decrypted == original

    def test_decrypt_empty_key(self):
        """空密钥应返回空字符串"""
        assert decrypt_api_key("") == ""

    def test_decrypt_invalid_data(self):
        """无效数据应返回空字符串"""
        assert decrypt_api_key("not-valid-encrypted-data") == ""

    def test_decrypt_tampered_data(self):
        """篡改后的数据应返回空字符串"""
        original = "sk-test-key-12345"
        encrypted = encrypt_api_key(original)
        tampered = encrypted[:-4] + "XXXX"
        assert decrypt_api_key(tampered) == ""


class TestMaskApiKey:
    """测试 API Key 脱敏功能"""

    def test_mask_normal_key(self):
        """正常长度的密钥应显示前4位和后4位"""
        assert mask_api_key("sk-1234567890abcdef") == "sk-1****cdef"

    def test_mask_short_key(self):
        """短密钥应返回 ****"""
        assert mask_api_key("short") == "****"

    def test_mask_empty_key(self):
        """空密钥应返回 ****"""
        assert mask_api_key("") == "****"

    def test_mask_none_key(self):
        """None 应返回 ****"""
        assert mask_api_key(None) == "****"

    def test_mask_exactly_8_chars(self):
        """刚好 8 个字符的密钥"""
        result = mask_api_key("12345678")
        assert result == "1234****5678"

    def test_mask_nine_chars(self):
        """9 个字符的密钥"""
        result = mask_api_key("123456789")
        assert result == "1234****6789"

    def test_mask_long_key(self):
        """长密钥应正确脱敏"""
        key = "sk-abcdefghijklmnopqrstuvwxyz"
        result = mask_api_key(key)
        assert result == "sk-a****wxyz"

    def test_mask_special_chars(self):
        """含特殊字符的密钥"""
        result = mask_api_key("sk-12_45")
        assert result == "sk-1****2_45"

    def test_mask_very_short_key(self):
        """极短密钥应返回 ****"""
        assert mask_api_key("ab") == "****"
        assert mask_api_key("a") == "****"


class TestEncryptDecryptRoundTrip:
    """测试加密解密往返"""

    def test_round_trip_various_keys(self):
        """多种密钥应能正确加解密"""
        test_keys = [
            "sk-short",
            "sk-very-long-api-key-with-many-characters-12345",
            "key-with-unicode-中文",
            "key-with-special-chars-!@#$%",
            "a" * 1000,  # 超长密钥
        ]
        for key in test_keys:
            encrypted = encrypt_api_key(key)
            decrypted = decrypt_api_key(encrypted)
            assert decrypted == key, f"密钥 '{key[:20]}...' 加解密往返失败"

    def test_encrypt_produces_different_output(self):
            """相同输入加密应产生不同输出（Fernet 使用时间戳）"""
            key = "sk-test-key"
            enc1 = encrypt_api_key(key)
            import time
            time.sleep(0.01)
            enc2 = encrypt_api_key(key)
            # Fernet 加密结果应不同（包含时间戳）
            assert enc1 != enc2

    def test_decrypt_with_wrong_key(self):
            """用错误的密钥解密应返回空字符串"""
            encrypted = encrypt_api_key("test-key")
            # 模拟密钥变更导致解密失败
            with patch("crypto._get_or_create_key", return_value=Fernet.generate_key()):
                result = decrypt_api_key(encrypted)
                assert result == ""
