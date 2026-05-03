
import re
import asyncio
import threading
from pathlib import Path
from typing import List, Dict, Optional
from pydantic import BaseModel


class ExamQuestion(BaseModel):
    id: int
    question: str
    answer: str


class ExamAnswerRequest(BaseModel):
    provider_id: str
    question_id: int
    model_answer: str


class ExamAnswerResponse(BaseModel):
    question_id: int
    correct_answer: str
    model_answer: str
    score: int
    is_correct: bool


class ExamResult(BaseModel):
    total_score: int
    total_questions: int
    correct_count: int
    answers: List[ExamAnswerResponse]


def parse_exam_questions(file_path):
    questions = []
    current_id = None
    current_question = None
    answer_lines = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    for line in lines:
        line = line.strip()
        
        if not line or '京东' in line or '¥' in line or '去购买' in line or '广告' in line:
            continue
        
        # 检测题目开头：数字. 格式
        question_match = re.match(r'^(\d+)\.\s*(.+)$', line)
        if question_match:
            if current_id and current_question and answer_lines:
                answer_text = '\n'.join(answer_lines).strip()
                answer_match = re.search(r'答[：:]\s*(.+)$', answer_text)
                if answer_match:
                    clean_answer = answer_match.group(1).strip()
                else:
                    clean_answer = answer_text
                
                questions.append(ExamQuestion(
                    id=current_id,
                    question=current_question.strip(),
                    answer=clean_answer
                ))
            
            current_id = int(question_match.group(1))
            current_question = question_match.group(2)
            answer_lines = []
            continue
        
        # 跳过 "解题思路" 开头的行
        if line.startswith('解题思路'):
            continue
        
        # 跳过或接受 "答题" 开头的行
        if line.startswith('答题'):
            continue
        
        # 收集答案行（任何不是新题目开头的都算答案）
        answer_lines.append(line)
    
    # 处理最后一个题目
    if current_id and current_question and answer_lines:
        answer_text = '\n'.join(answer_lines).strip()
        answer_match = re.search(r'答[：:]\s*(.+)$', answer_text)
        if answer_match:
            clean_answer = answer_match.group(1).strip()
        else:
            clean_answer = answer_text
        
        questions.append(ExamQuestion(
            id=current_id,
            question=current_question.strip(),
            answer=clean_answer
        ))
    
    return questions


def evaluate_answer(model_answer, correct_answer):
    """评估答案得分，返回 (score, is_correct) 元组。

    评分规则（0/1/2 三档）：
    - 2分：完全正确（数字精确匹配 或 文本完全包含）
    - 1分：部分正确（核心关键词匹配 或 数字接近）
    - 0分：错误
    """
    def extract_numbers(text):
        numbers = re.findall(r'(\d+(?:\.\d+)?)', text)
        return set(float(n) if '.' in n else int(n) for n in numbers)

    def extract_keywords(text):
        """提取中文关键词（2字以上的实词）和英文单词"""
        # 去除标点和空白后按非中文字符分割
        cleaned = re.sub(r'[，。！？、；：""''（）\s]+', ' ', text)
        words = set()
        for token in cleaned.split():
            if re.match(r'^[\u4e00-\u9fff]+$', token) and len(token) >= 2:
                words.add(token)
            elif re.match(r'^[a-zA-Z]+$', token):
                words.add(token.lower())
        return words

    def keyword_overlap(keywords_a, keywords_b):
        """计算关键词重叠比例"""
        if not keywords_a or not keywords_b:
            return 0.0
        intersection = keywords_a & keywords_b
        union = keywords_a | keywords_b
        return len(intersection) / len(union) if union else 0.0

    # 空答案直接判零
    if not model_answer or not model_answer.strip():
        return (0, False)
    if not correct_answer or not correct_answer.strip():
        return (0, False)

    model_answer = model_answer.strip()
    correct_answer = correct_answer.strip()

    # --- 数字匹配 ---
    model_nums = extract_numbers(model_answer)
    correct_nums = extract_numbers(correct_answer)

    if model_nums and correct_nums:
        for m_num in model_nums:
            for c_num in correct_nums:
                if isinstance(m_num, (int, float)) and isinstance(c_num, (int, float)):
                    if abs(m_num - c_num) < 0.1:
                        return (2, True)  # 数字精确匹配（容差 0.1）→ 满分
                    # 数字接近（相对误差 < 5%）→ 部分分
                    if c_num != 0 and abs(m_num - c_num) / abs(c_num) < 0.05:
                        return (1, False)

    # --- 文本完全包含（2分）---
    if correct_answer in model_answer or model_answer in correct_answer:
        return (2, True)

    # --- 关键词部分匹配（1分）---
    model_keywords = extract_keywords(model_answer)
    correct_keywords = extract_keywords(correct_answer)
    overlap = keyword_overlap(model_keywords, correct_keywords)
    if overlap >= 0.5:
        return (1, False)  # 关键词重叠 ≥50% → 部分分

    return (0, False)


_questions_cache = None
_questions_cache_mtime = 0.0
_questions_cache_lock = asyncio.Lock()

def _is_cache_stale(cache_entry, file_path: Path, cache_mtime: float) -> bool:
    """检查缓存是否因文件更新而失效"""
    if cache_entry is None:
        return True
    try:
        current_mtime = file_path.stat().st_mtime
        return current_mtime > cache_mtime
    except FileNotFoundError:
        return True

async def get_exam_questions_async():
    """异步安全地获取考试题目（异步版本），基于文件 mtime 自动刷新缓存"""
    global _questions_cache, _questions_cache_mtime
    file_path = Path(__file__).parent / "50.txt"
    
    async with _questions_cache_lock:
        if _questions_cache is not None and not _is_cache_stale(_questions_cache, file_path, _questions_cache_mtime):
            return _questions_cache
        
        loop = asyncio.get_running_loop()
        _questions_cache = await loop.run_in_executor(None, parse_exam_questions, file_path)
        _questions_cache_mtime = file_path.stat().st_mtime
        return _questions_cache


def get_exam_questions():
    global _questions_cache, _questions_cache_mtime
    file_path = Path(__file__).parent / "50.txt"
    
    if _questions_cache is not None:
        try:
            current_mtime = file_path.stat().st_mtime
            if current_mtime <= _questions_cache_mtime:
                return _questions_cache
        except FileNotFoundError:
            pass
    
    import threading
    with threading.Lock():
        if _questions_cache is None:
            try:
                current_mtime = file_path.stat().st_mtime
                if current_mtime > _questions_cache_mtime:
                    _questions_cache = parse_exam_questions(file_path)
                    _questions_cache_mtime = current_mtime
            except FileNotFoundError:
                return []
    
    return _questions_cache


def get_question_by_id(question_id):
    questions = get_exam_questions()
    for q in questions:
        if q.id == question_id:
            return q
    return None


def get_all_exam_files():
    exam_dir = Path(__file__).parent
    txt_files = list(exam_dir.glob('*.txt'))
    # 按修改时间排序，最新的在前面
    txt_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    return [f.name for f in txt_files]


def save_uploaded_file(file_name, content):
    """安全地保存上传的文件，防止路径遍历攻击"""
    import uuid

    ALLOWED_EXTENSIONS = {'.txt'}
    MAX_FILE_SIZE = 1024 * 1024  # 1MB

    if len(content) > MAX_FILE_SIZE:
        raise ValueError("文件大小超过限制（最大 1MB）")

    original_path = Path(file_name)
    ext = original_path.suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"不支持的文件类型: {ext}，只允许 {', '.join(ALLOWED_EXTENSIONS)}")

    # 使用 UUID 生成安全文件名，防止路径遍历
    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = Path(__file__).parent / safe_name

    # 确保解析后的路径仍在项目目录内（防止路径遍历）
    if not file_path.resolve().is_relative_to(Path(__file__).parent.resolve()):
        raise ValueError("非法文件名")

    file_path.write_bytes(content)
    return safe_name


def get_question_by_file_and_id(file_name, question_id):
    questions = get_exam_questions_by_file(file_name)
    for q in questions:
        if q.id == question_id:
            return q
    return None


# 全局缓存，不同的题库文件有不同的缓存
_questions_caches = {}
_questions_caches_mtime = {}  # 每道题缓存时的文件 mtime
_questions_caches_lock = threading.Lock()


_async_file_cache_lock = asyncio.Lock()

async def get_exam_questions_by_file_async(file_name):
    """异步安全地获取指定文件的考试题目（异步版本），基于文件 mtime 自动刷新"""
    global _questions_caches, _questions_caches_mtime
    file_path = Path(__file__).parent / file_name
    if _is_file_cache_valid(file_name, file_path, _questions_caches, _questions_caches_mtime):
        return _questions_caches[file_name]
    async with _async_file_cache_lock:
        if not _is_file_cache_valid(file_name, file_path, _questions_caches, _questions_caches_mtime):
            loop = asyncio.get_running_loop()
            _questions_caches[file_name] = await loop.run_in_executor(None, parse_exam_questions, file_path)
            _questions_caches_mtime[file_name] = file_path.stat().st_mtime
        return _questions_caches[file_name]


def _is_file_cache_valid(file_name, file_path, caches_dict, mtime_dict):
    """检查文件缓存是否有效（文件存在且未修改）"""
    if file_name not in caches_dict:
        return False
    try:
        return file_path.stat().st_mtime <= mtime_dict.get(file_name, 0)
    except FileNotFoundError:
        return False


def get_exam_questions_by_file(file_name):
    global _questions_caches, _questions_caches_mtime
    file_path = Path(__file__).parent / file_name
    # 路径遍历防护：确保解析后的路径仍在项目目录内
    if not file_path.resolve().is_relative_to(Path(__file__).parent.resolve()):
        raise ValueError("非法文件名")
    if _is_file_cache_valid(file_name, file_path, _questions_caches, _questions_caches_mtime):
        return _questions_caches[file_name]
    # 使用线程锁保证线程安全（防止多线程同时写入同一 key）
    with _questions_caches_lock:
        if not _is_file_cache_valid(file_name, file_path, _questions_caches, _questions_caches_mtime):
            _questions_caches[file_name] = parse_exam_questions(file_path)
            _questions_caches_mtime[file_name] = file_path.stat().st_mtime
    return _questions_caches[file_name]


def clear_question_cache(file_name=None):
    """清除题库缓存，线程安全"""
    global _questions_caches, _questions_cache, _questions_cache_mtime, _questions_caches_mtime
    with _questions_caches_lock:
        if file_name:
            _questions_caches.pop(file_name, None)
            _questions_caches_mtime.pop(file_name, None)
        else:
            _questions_caches.clear()
            _questions_caches_mtime.clear()
            _questions_cache = None
            _questions_cache_mtime = 0.0


