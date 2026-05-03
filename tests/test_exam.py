"""考试模块单元测试"""
import os
import tempfile
from pathlib import Path

import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from exam import (
    parse_exam_questions,
    evaluate_answer,
    save_uploaded_file,
    get_exam_questions_by_file,
)


SAMPLE_EXAM_CONTENT = """1. 小明有5个苹果，小红给了他3个，小明现在有几个苹果？
答：8

2. 一个长方形的长是8米，宽是5米，面积是多少平方米？
答：40

3. 计算：125 × 8 = ?
答：1000
"""


@pytest.fixture
def sample_exam_file():
    """创建临时题库文件"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write(SAMPLE_EXAM_CONTENT)
        temp_path = f.name
    yield temp_path
    os.unlink(temp_path)


@pytest.fixture
def temp_upload_dir(tmp_path):
    """提供临时上传目录"""
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir(exist_ok=True)
    return upload_dir


class TestParseExamQuestions:
    """测试题目解析功能"""

    def test_parse_valid_file(self, sample_exam_file):
        """应能正确解析有效的题库文件"""
        questions = parse_exam_questions(sample_exam_file)
        assert len(questions) == 3

    def test_parse_first_question(self, sample_exam_file):
        """第一道题的内容应正确"""
        questions = parse_exam_questions(sample_exam_file)
        assert questions[0].id == 1
        assert "苹果" in questions[0].question
        assert questions[0].answer == "8"

    def test_parse_empty_file(self, tmp_path):
        """空文件应返回空列表"""
        empty_file = tmp_path / "empty.txt"
        empty_file.write_text("", encoding='utf-8')
        questions = parse_exam_questions(str(empty_file))
        assert len(questions) == 0

    def test_parse_file_with_ads(self, tmp_path):
        """应自动过滤广告行"""
        content = "京东\n¥99\n去购买\n广告\n1. 测试题目？\n答：测试答案\n"
        file_path = tmp_path / "with_ads.txt"
        file_path.write_text(content, encoding='utf-8')
        questions = parse_exam_questions(str(file_path))
        assert len(questions) == 1
        assert questions[0].answer == "测试答案"


class TestEvaluateAnswer:
    """测试答案评分功能"""

    def test_correct_numeric_answer(self):
        """数字答案正确应得 2 分"""
        score, is_correct = evaluate_answer("8", "8")
        assert score == 2
        assert is_correct is True

    def test_correct_answer_with_text(self):
        """文本包含正确答案应得 2 分"""
        score, is_correct = evaluate_answer("答案是40", "40")
        assert score == 2
        assert is_correct is True

    def test_wrong_answer(self):
        """错误答案应得 0 分"""
        score, is_correct = evaluate_answer("999", "8")
        assert score == 0
        assert is_correct is False

    def test_float_tolerance(self):
        """浮点数应在容差范围内"""
        score, is_correct = evaluate_answer("7.95", "8")
        assert score == 2
        assert is_correct is True

    def test_empty_model_answer(self):
        """空答案应得 0 分"""
        score, is_correct = evaluate_answer("", "8")
        assert score == 0
        assert is_correct is False


class TestSaveUploadedFile:
    """测试文件上传安全功能"""

    def test_save_valid_file(self, tmp_path, monkeypatch):
        """正常文件应能安全保存，返回 UUID 格式文件名"""
        # 将 save_uploaded_file 中的文件保存目录重定向到 tmp_path
        import exam as exam_module
        from pathlib import Path as RealPath
        import uuid as real_uuid

        # 生成预期的 UUID 以便定位保存的文件
        expected_uuid = real_uuid.uuid4().hex

        def mock_uuid4():
            class FakeUUID:
                hex = expected_uuid
            return FakeUUID()

        monkeypatch.setattr(real_uuid, "uuid4", mock_uuid4)
        # 通过修改 __file__ 的路径解析，让文件保存到 tmp_path
        monkeypatch.setattr(exam_module, "__file__", str(tmp_path / "exam.py"))

        result = save_uploaded_file("test.txt", b"test content")
        assert result.endswith(".txt")
        # 验证返回的是 UUID 格式（32 hex + .txt）
        name_part = result.replace(".txt", "")
        assert len(name_part) == 32
        assert name_part == expected_uuid
        # 验证文件确实被保存到 tmp_path
        saved_file = tmp_path / result
        assert saved_file.exists()
        assert saved_file.read_bytes() == b"test content"

    def test_reject_large_file(self, tmp_path):
        """超大文件应被拒绝"""
        huge_content = b"x" * (1024 * 1024 + 1)  # 1MB + 1
        with pytest.raises(ValueError, match="文件大小超过限制"):
            save_uploaded_file("large.txt", huge_content)

    def test_reject_invalid_extension(self, tmp_path):
        """非允许扩展名应被拒绝"""
        with pytest.raises(ValueError, match="不支持的文件类型"):
            save_uploaded_file("malicious.exe", b"evil content")

    def test_reject_path_traversal(self, tmp_path):
        """路径遍历文件名应被拒绝"""
        with pytest.raises(ValueError, match="不支持的文件类型"):
            save_uploaded_file("../../etc/passwd", b"evil")

    def test_save_uses_uuid_not_original_name(self, tmp_path, monkeypatch):
        """保存后应使用 UUID 而非原始文件名"""
        monkeypatch.chdir(tmp_path)
        result = save_uploaded_file("my-secret-file.txt", b"test content")
        # 不应包含原始文件名
        assert "my-secret" not in result
        assert "original" not in result
        # 应该是 UUID 格式
        name_part = result.replace(".txt", "")
        assert len(name_part) == 32
        int(name_part, 16)  # 验证是有效的 hex


class TestGetExamQuestionsByFile:
    """测试按文件获取题目的安全性"""

    def test_path_traversal_rejected(self, tmp_path, monkeypatch):
        """路径遍历文件名应被拒绝"""
        import exam as exam_module
        monkeypatch.setattr(exam_module, "__file__", str(tmp_path / "exam.py"))
        with pytest.raises(ValueError, match="非法文件名"):
            get_exam_questions_by_file("../../etc/passwd")

    def test_path_traversal_with_dotdot_rejected(self, tmp_path, monkeypatch):
        """包含 ../ 的文件名应被拒绝"""
        import exam as exam_module
        monkeypatch.setattr(exam_module, "__file__", str(tmp_path / "exam.py"))
        with pytest.raises(ValueError, match="非法文件名"):
            get_exam_questions_by_file("../secret.txt")


class TestEvaluateAnswerEdgeCases:
    """测试答案评分边界情况"""

    def test_both_empty_strings(self):
        """双方都为空应得 0 分"""
        score, is_correct = evaluate_answer("", "")
        assert score == 0
        assert is_correct is False

    def test_model_empty_correct_nonempty(self):
        """模型答案为空应得 0 分"""
        score, is_correct = evaluate_answer("", "42")
        assert score == 0
        assert is_correct is False

    def test_model_nonempty_correct_empty(self):
        """正确答案为空应得 0 分"""
        score, is_correct = evaluate_answer("42", "")
        assert score == 0
        assert is_correct is False

    def test_whitespace_only_answer(self):
        """纯空白答案应得 0 分"""
        score, is_correct = evaluate_answer("   ", "42")
        assert score == 0
        assert is_correct is False

    def test_float_exact_match(self):
        """浮点数精确匹配"""
        score, is_correct = evaluate_answer("3.14", "3.14")
        assert score == 2
        assert is_correct is True

    def test_float_within_tolerance(self):
        """浮点数在容差范围内"""
        score, is_correct = evaluate_answer("3.141", "3.14")
        assert score == 2
        assert is_correct is True

    def test_float_outside_tolerance(self):
        """浮点数超出容差范围 (>0.1)"""
        score, is_correct = evaluate_answer("3.5", "3.14")
        assert score == 0
        assert is_correct is False

    def test_negative_numbers(self):
        """负数应正确比较"""
        score, is_correct = evaluate_answer("-5", "-5")
        assert score == 2
        assert is_correct is True

    def test_text_contains_answer(self):
        """文本包含正确答案"""
        score, is_correct = evaluate_answer("答案是 42 没错", "42")
        assert score == 2
        assert is_correct is True

    def test_answer_contains_text(self):
        """正确答案包含模型答案（模型答案更短）"""
        score, is_correct = evaluate_answer("42", "答案是 42")
        assert score == 2
        assert is_correct is True

    def test_completely_different_text(self):
        """完全不同的文本应得 0 分"""
        score, is_correct = evaluate_answer("hello world", "42")
        assert score == 0
        assert is_correct is False

    def test_numeric_string_match(self):
        """数字字符串匹配"""
        score, is_correct = evaluate_answer("100", "100")
        assert score == 2
        assert is_correct is True

    def test_number_in_text(self):
        """数字在文本中"""
        score, is_correct = evaluate_answer("计算结果是 1000 千克", "1000")
        assert score == 2
        assert is_correct is True


class TestParseExamQuestionsEdgeCases:
    """测试题目解析边界情况"""

    def test_file_with_only_ads(self, tmp_path):
        """仅含广告的文件应返回空列表"""
        content = "京东\n¥99\n去购买\n广告\n"
        file_path = tmp_path / "ads_only.txt"
        file_path.write_text(content, encoding='utf-8')
        questions = parse_exam_questions(str(file_path))
        assert len(questions) == 0

    def test_file_with_no_answer_line(self, tmp_path):
        """无答案行的题目不应被收录（需要至少一行答案内容）"""
        content = "1. 这是一道题\n"
        file_path = tmp_path / "no_answer.txt"
        file_path.write_text(content, encoding='utf-8')
        questions = parse_exam_questions(str(file_path))
        assert len(questions) == 0

    def test_file_with_answer_text_but_no_label(self, tmp_path):
        """有内容行但无'答：'标签时，应使用最后一行作为答案"""
        content = "1. 这是一道题\n我的答案是 42\n"
        file_path = tmp_path / "answer_no_label.txt"
        file_path.write_text(content, encoding='utf-8')
        questions = parse_exam_questions(str(file_path))
        assert len(questions) == 1

    def test_multiline_answer(self, tmp_path):
        """多行答案应被正确合并"""
        content = "1. 计算题\n答：\n第一步：1+1=2\n第二步：2+2=4\n"
        file_path = tmp_path / "multiline.txt"
        file_path.write_text(content, encoding='utf-8')
        questions = parse_exam_questions(str(file_path))
        assert len(questions) == 1
        assert "4" in questions[0].answer

    def test_question_with_special_chars(self, tmp_path):
        """含特殊字符的题目"""
        content = "1. 计算：125 × 8 = ?\n答：1000\n"
        file_path = tmp_path / "special.txt"
        file_path.write_text(content, encoding='utf-8')
        questions = parse_exam_questions(str(file_path))
        assert len(questions) == 1
        assert questions[0].answer == "1000"

    def test_consecutive_questions(self, tmp_path):
        """连续多道题"""
        content = ""
        for i in range(1, 11):
            content += f"{i}. 题目{i}\n答：答案{i}\n\n"
        file_path = tmp_path / "many.txt"
        file_path.write_text(content, encoding='utf-8')
        questions = parse_exam_questions(str(file_path))
        assert len(questions) == 10
        assert questions[9].answer == "答案10"

    def test_answer_with_colon_variations(self, tmp_path):
        """不同冒号格式的答案"""
        content = "1. 题目1\n答：答案1\n\n2. 题目2\n答:答案2\n\n3. 题目3\n答： 答案3\n"
        file_path = tmp_path / "colons.txt"
        file_path.write_text(content, encoding='utf-8')
        questions = parse_exam_questions(str(file_path))
        assert len(questions) == 3
        assert questions[0].answer == "答案1"
        assert questions[1].answer == "答案2"
        assert questions[2].answer == "答案3"
