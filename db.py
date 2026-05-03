"""
db.py - SQLite 数据库管理模块

管理游戏统计数据、成就系统、排行榜和每日挑战的持久化存储。
使用本地 SQLite 文件，无需额外安装服务。

表结构：
- game_records: 每局游戏的完整记录
- player_game_stats: 每个玩家每局游戏的详细数据
- achievements: 成就定义和解锁状态
- daily_challenges: 每日挑战模板
- daily_challenge_progress: 每日挑战完成进度
"""

import sqlite3
import json
import threading
from datetime import datetime, date
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent / "data" / "game.db"


class Database:
    """线程安全的 SQLite 数据库管理器"""

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._local = threading.local()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        """获取当前线程的数据库连接"""
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(str(self.db_path))
            self._local.conn.row_factory = sqlite3.Row
            self._local.conn.execute("PRAGMA journal_mode=WAL")
            self._local.conn.execute("PRAGMA busy_timeout=5000")
            self._local.conn.execute("PRAGMA foreign_keys=ON")
        return self._local.conn

    def _init_db(self):
        """初始化数据库表结构"""
        conn = self._get_conn()
        conn.executescript("""
            -- ==================== 游戏记录 ====================
            CREATE TABLE IF NOT EXISTS game_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT UNIQUE,
                player_count INTEGER NOT NULL,
                winner TEXT NOT NULL CHECK(winner IN ('good', 'wolf')),
                round INTEGER NOT NULL DEFAULT 0,
                started_at TEXT NOT NULL,
                ended_at TEXT NOT NULL,
                duration_seconds REAL DEFAULT 0,
                game_data TEXT DEFAULT '{}'  -- JSON: 完整游戏数据
            );

            CREATE INDEX IF NOT EXISTS idx_game_records_ended_at ON game_records(ended_at);
            CREATE INDEX IF NOT EXISTS idx_game_records_winner ON game_records(winner);

            -- ==================== 玩家每局数据 ====================
            CREATE TABLE IF NOT EXISTS player_game_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT NOT NULL,
                player_id TEXT NOT NULL,
                player_name TEXT NOT NULL,
                role TEXT NOT NULL,
                team TEXT NOT NULL CHECK(team IN ('good', 'wolf')),
                is_alive INTEGER DEFAULT 1,
                is_mvp INTEGER DEFAULT 0,
                speech_count INTEGER DEFAULT 0,
                vote_target TEXT,
                death_round INTEGER,
                death_cause TEXT,
                model TEXT DEFAULT '',
                FOREIGN KEY (game_id) REFERENCES game_records(game_id)
            );

            CREATE INDEX IF NOT EXISTS idx_pgs_game_id ON player_game_stats(game_id);
            CREATE INDEX IF NOT EXISTS idx_pgs_player_name ON player_game_stats(player_name);
            CREATE INDEX IF NOT EXISTS idx_pgs_model ON player_game_stats(model);

            -- ==================== 成就定义 ====================
            CREATE TABLE IF NOT EXISTS achievements (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                icon TEXT DEFAULT '🏆',
                category TEXT DEFAULT 'general',
                points INTEGER DEFAULT 10,
                condition_type TEXT NOT NULL,
                condition_value TEXT DEFAULT '{}',
                sort_order INTEGER DEFAULT 0
            );

            -- ==================== 成就解锁记录 ====================
            CREATE TABLE IF NOT EXISTS achievement_unlocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                achievement_id TEXT NOT NULL,
                unlocked_at TEXT NOT NULL,
                game_id TEXT,
                FOREIGN KEY (achievement_id) REFERENCES achievements(id)
            );

            CREATE INDEX IF NOT EXISTS idx_au_achievement ON achievement_unlocks(achievement_id);

            -- ==================== 每日挑战进度 ====================
            CREATE TABLE IF NOT EXISTS daily_challenge_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                challenge_date TEXT NOT NULL,
                challenge_index INTEGER NOT NULL,
                challenge_title TEXT NOT NULL,
                challenge_desc TEXT NOT NULL,
                points INTEGER DEFAULT 10,
                completed INTEGER DEFAULT 0,
                completed_at TEXT,
                UNIQUE(challenge_date, challenge_index)
            );

            CREATE INDEX IF NOT EXISTS idx_dcp_date ON daily_challenge_progress(challenge_date);
        """)

        # 插入默认成就
        self._init_default_achievements(conn)
        conn.commit()

    def _init_default_achievements(self, conn: sqlite3.Connection):
        """插入默认成就定义（如果不存在）"""
        now = datetime.now().isoformat()
        achievements = [
            # (id, name, description, icon, category, points, condition_type, condition_value, sort_order)
            ("first_win", "初次胜利", "赢得第一场游戏", "🏆", "general", 10,
             "total_wins", '{"count": 1}', 1),
            ("ten_wins", "常胜将军", "累计赢得 10 场比赛", "👑", "general", 30,
             "total_wins", '{"count": 10}', 2),
            ("fifty_wins", "百战百胜", "累计赢得 50 场比赛", "💎", "general", 100,
             "total_wins", '{"count": 50}', 3),
            ("first_blood", "首杀", "在游戏中首次击杀对手", "⚔️", "combat", 10,
             "total_kills", '{"count": 1}', 10),
            ("wolf_king", "狼王", "作为狼人阵营赢得 5 场比赛", "🐺", "wolf", 30,
             "wolf_wins", '{"count": 5}', 20),
            ("guardian", "守护者", "作为好人阵营赢得 5 场比赛", "🛡️", "good", 30,
             "good_wins", '{"count": 5}', 21),
            ("role_master", "角色大师", "以所有不同角色身份至少获胜一次", "🎭", "general", 50,
             "unique_role_wins", '{"count": 6}', 30),
            ("mode_explorer", "模式探索者", "在 6/8/10 人局中各至少获胜一次", "🗺️", "general", 30,
             "unique_mode_wins", '{"count": 3}', 31),
            ("speed_demon", "速战速决", "在 5 轮以内赢得比赛", "⚡", "general", 20,
             "fast_win", '{"max_rounds": 5}', 40),
            ("mvp_star", "MVP 之星", "单场比赛获得 MVP", "⭐", "general", 15,
             "mvp_count", '{"count": 1}', 50),
            ("mvp_legend", "MVP 传奇", "累计获得 5 次 MVP", "🌟", "general", 50,
             "mvp_count", '{"count": 5}', 51),
            ("survivor", "幸存者", "在一局游戏中存活到最后且获胜", "🏅", "general", 15,
             "survive_win", '{"count": 1}', 60),
            ("perfect_game", "完美对局", "作为好人阵营且全员存活获胜", "✨", "general", 100,
             "perfect_good_win", '{"count": 1}', 70),
        ]

        for a in achievements:
            conn.execute("""
                INSERT OR IGNORE INTO achievements
                (id, name, description, icon, category, points, condition_type, condition_value, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, a)

    # ==================== 游戏记录操作 ====================

    def save_game_record(self, game_id: str, player_count: int, winner: str,
                         round_num: int, started_at: str, game_data: dict) -> int:
        """保存一局游戏的完整记录"""
        conn = self._get_conn()
        ended_at = datetime.now().isoformat()
        duration = 0
        try:
            start_dt = datetime.fromisoformat(started_at)
            end_dt = datetime.fromisoformat(ended_at)
            duration = (end_dt - start_dt).total_seconds()
        except (ValueError, TypeError):
            pass

        cursor = conn.execute("""
            INSERT INTO game_records (game_id, player_count, winner, round, started_at, ended_at, duration_seconds, game_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (game_id, player_count, winner, round_num, started_at, ended_at, duration, json.dumps(game_data, ensure_ascii=False)))
        conn.commit()
        return cursor.lastrowid

    def exec_in_transaction(self, operations: list):
        """在单个事务中执行多个数据库操作

        Args:
            operations: 列表，每个元素为 (sql, params) 元组

        Returns:
            list: 每个操作的 cursor 结果

        Raises:
            sqlite3.Error: 任一操作失败时回滚整个事务
        """
        conn = self._get_conn()
        results = []
        try:
            conn.execute("BEGIN")
            for sql, params in operations:
                cursor = conn.execute(sql, params)
                results.append(cursor)
            conn.commit()
            return results
        except Exception:
            conn.rollback()
            raise

    def save_player_stats(self, game_id: str, players: list):
        """保存一局游戏中每个玩家的详细数据（使用事务）"""
        operations = []
        for p in players:
            operations.append((
                """INSERT INTO player_game_stats
                (game_id, player_id, player_name, role, team, is_alive, is_mvp,
                 speech_count, vote_target, death_round, death_cause, model)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    game_id,
                    p.get("id", ""),
                    p.get("name", ""),
                    p.get("role", ""),
                    p.get("team", ""),
                    1 if p.get("is_alive", True) else 0,
                    1 if p.get("is_mvp", False) else 0,
                    p.get("speech_count", 0),
                    p.get("vote_target"),
                    p.get("death_round"),
                    p.get("death_cause"),
                    p.get("model", ""),
                )
            ))
        self.exec_in_transaction(operations)

    def get_game_history(self, limit: int = 50, offset: int = 0) -> list:
        """获取游戏历史记录"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT game_id, player_count, winner, round, started_at, ended_at, duration_seconds
            FROM game_records
            ORDER BY ended_at DESC
            LIMIT ? OFFSET ?
        """, (limit, offset)).fetchall()
        return [dict(r) for r in rows]

    def get_total_games(self) -> int:
        """获取总游戏数"""
        conn = self._get_conn()
        row = conn.execute("SELECT COUNT(*) as cnt FROM game_records").fetchone()
        return row["cnt"] if row else 0

    def get_wins_by_team(self) -> dict:
        """获取各阵营胜场数"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT winner, COUNT(*) as cnt
            FROM game_records
            GROUP BY winner
        """).fetchall()
        result = {"good": 0, "wolf": 0}
        for r in rows:
            result[r["winner"]] = r["cnt"]
        return result

    def get_wins_by_role(self) -> dict:
        """获取各角色胜场数"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT pgs.role, COUNT(*) as cnt
            FROM player_game_stats pgs
            JOIN game_records gr ON pgs.game_id = gr.game_id
            WHERE pgs.team = gr.winner AND pgs.is_alive = 1
            GROUP BY pgs.role
            ORDER BY cnt DESC
        """).fetchall()
        return {r["role"]: r["cnt"] for r in rows}

    def get_wins_by_mode(self) -> dict:
        """获取各模式胜场数（好人阵营）"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT player_count, COUNT(*) as cnt
            FROM game_records
            WHERE winner = 'good'
            GROUP BY player_count
        """).fetchall()
        return {str(r["player_count"]): r["cnt"] for r in rows}

    def get_win_streak(self) -> dict:
        """获取连胜数据（好人阵营）"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT winner, ended_at
            FROM game_records
            ORDER BY ended_at ASC
        """).fetchall()

        current_streak = 0
        best_streak = 0
        temp_streak = 0

        for r in rows:
            if r["winner"] == "good":
                temp_streak += 1
                best_streak = max(best_streak, temp_streak)
            else:
                temp_streak = 0

        # 当前连胜 = 最后连续的好人胜场
        current_streak = 0
        for r in reversed(rows):
            if r["winner"] == "good":
                current_streak += 1
            else:
                break

        return {"current_streak": current_streak, "best_streak": best_streak}

    def get_mvp_rankings(self, limit: int = 10) -> list:
        """获取 MVP 排行榜"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT player_name, COUNT(*) as cnt
            FROM player_game_stats
            WHERE is_mvp = 1
            GROUP BY player_name
            ORDER BY cnt DESC
            LIMIT ?
        """, (limit,)).fetchall()
        return [{"name": r["player_name"], "count": r["cnt"]} for r in rows]

    def get_model_stats(self, min_games: int = 3, limit: int = 10) -> list:
        """获取模型胜率统计"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT model,
                   COUNT(*) as total_games,
                   SUM(CASE WHEN pgs.team = gr.winner THEN 1 ELSE 0 END) as wins
            FROM player_game_stats pgs
            JOIN game_records gr ON pgs.game_id = gr.game_id
            WHERE model != ''
            GROUP BY model
            HAVING total_games >= ?
            ORDER BY CAST(wins AS FLOAT) / total_games DESC
            LIMIT ?
        """, (min_games, limit)).fetchall()
        result = []
        for r in rows:
            win_rate = f"{r['wins'] / r['total_games'] * 100:.1f}%"
            result.append({
                "model": r["model"],
                "games": r["total_games"],
                "wins": r["wins"],
                "winRate": win_rate,
            })
        return result

    def get_speech_stats(self) -> dict:
        """获取发言统计数据"""
        conn = self._get_conn()
        row = conn.execute("""
            SELECT SUM(speech_count) as total_speeches,
                   AVG(speech_count) as avg_speeches
            FROM player_game_stats
        """).fetchone()
        return {
            "total_speeches": row["total_speeches"] or 0,
            "avg_speeches_per_player": round(row["avg_speeches"] or 0, 1),
        }

    def get_kill_stats(self) -> dict:
        """获取击杀统计数据"""
        conn = self._get_conn()
        row = conn.execute("""
            SELECT COUNT(*) as total_deaths,
                   SUM(CASE WHEN death_cause = 'vote' THEN 1 ELSE 0 END) as vote_deaths,
                   SUM(CASE WHEN death_cause = 'kill' THEN 1 ELSE 0 END) as kill_deaths,
                   SUM(CASE WHEN death_cause = 'poison' THEN 1 ELSE 0 END) as poison_deaths,
                   SUM(CASE WHEN death_cause = 'shoot' THEN 1 ELSE 0 END) as shoot_deaths
            FROM player_game_stats
            WHERE is_alive = 0
        """).fetchone()
        total = row["total_deaths"] or 0
        return {
            "total_deaths": total,
            "vote_deaths": row["vote_deaths"] or 0,
            "kill_deaths": row["kill_deaths"] or 0,
            "poison_deaths": row["poison_deaths"] or 0,
            "shoot_deaths": row["shoot_deaths"] or 0,
        }

    def get_avg_game_duration(self) -> float:
        """获取平均游戏时长（秒）"""
        conn = self._get_conn()
        row = conn.execute("SELECT AVG(duration_seconds) as avg_dur FROM game_records").fetchone()
        return round(row["avg_dur"] or 0, 1)

    def get_fastest_win_round(self) -> int:
        """获取最快获胜轮数"""
        conn = self._get_conn()
        row = conn.execute("SELECT MIN(round) as min_round FROM game_records").fetchone()
        return row["min_round"] or 0

    # ==================== 成就操作 ====================

    def get_all_achievements(self) -> list:
        """获取所有成就及其解锁状态"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT a.id, a.name, a.description, a.icon, a.category, a.points,
                   a.condition_type, a.condition_value, a.sort_order,
                   CASE WHEN au.id IS NOT NULL THEN 1 ELSE 0 END as unlocked,
                   au.unlocked_at
            FROM achievements a
            LEFT JOIN achievement_unlocks au ON a.id = au.achievement_id
            ORDER BY a.sort_order ASC
        """).fetchall()
        return [dict(r) for r in rows]

    def unlock_achievement(self, achievement_id: str, game_id: str = None) -> bool:
        """解锁一个成就，返回是否为新解锁"""
        conn = self._get_conn()
        # 检查是否已解锁
        existing = conn.execute(
            "SELECT id FROM achievement_unlocks WHERE achievement_id = ?",
            (achievement_id,)
        ).fetchone()
        if existing:
            return False

        conn.execute("""
            INSERT INTO achievement_unlocks (achievement_id, unlocked_at, game_id)
            VALUES (?, ?, ?)
        """, (achievement_id, datetime.now().isoformat(), game_id))
        conn.commit()
        return True

    def get_unlocked_achievement_ids(self) -> set:
        """获取已解锁的成就 ID 集合"""
        conn = self._get_conn()
        rows = conn.execute("SELECT achievement_id FROM achievement_unlocks").fetchall()
        return {r["achievement_id"] for r in rows}

    def get_achievement_points(self) -> int:
        """获取累计成就点数"""
        conn = self._get_conn()
        row = conn.execute("""
            SELECT SUM(a.points) as total
            FROM achievement_unlocks au
            JOIN achievements a ON au.achievement_id = a.id
        """).fetchone()
        return row["total"] or 0

    # ==================== 每日挑战操作 ====================

    def get_daily_challenges(self, challenge_date: str = None) -> list:
        """获取指定日期的每日挑战，不存在则生成"""
        if challenge_date is None:
            challenge_date = date.today().isoformat()

        conn = self._get_conn()
        rows = conn.execute("""
            SELECT challenge_date, challenge_index, challenge_title, challenge_desc,
                   points, completed, completed_at
            FROM daily_challenge_progress
            WHERE challenge_date = ?
            ORDER BY challenge_index
        """, (challenge_date,)).fetchall()

        if rows:
            return [dict(r) for r in rows]

        # 生成新的每日挑战
        return self._generate_daily_challenges(conn, challenge_date)

    def _generate_daily_challenges(self, conn: sqlite3.Connection, challenge_date: str) -> list:
        """基于日期种子生成每日挑战"""
        import hashlib

        # 12 个挑战模板
        templates = [
            {"title": "首胜之日", "desc": "今天赢得第一场游戏", "points": 10},
            {"title": "狼人之夜", "desc": "作为狼人阵营赢得一场游戏", "points": 15},
            {"title": "守护者之心", "desc": "作为好人阵营赢得一场游戏", "points": 15},
            {"title": "速战速决", "desc": "在 6 轮以内结束游戏", "points": 20},
            {"title": "幸存者", "desc": "在一局游戏中存活到最后", "points": 10},
            {"title": "话语权", "desc": "在一局游戏中发言 5 次以上", "points": 15},
            {"title": "探索者", "desc": "体验一次 8 人局", "points": 10},
            {"title": "大师之路", "desc": "体验一次 10 人局", "points": 15},
            {"title": "夜行者", "desc": "经历 3 个夜晚阶段", "points": 10},
            {"title": "投票达人", "desc": "参与 3 次投票环节", "points": 10},
            {"title": "连胜之路", "desc": "连续赢得 2 场比赛", "points": 25},
            {"title": "全能选手", "desc": "使用不同角色各赢得一场", "points": 30},
        ]

        # 用日期作为种子选择 3 个挑战
        seed = int(hashlib.md5(challenge_date.encode()).hexdigest(), 16)
        selected_indices = []
        temp_seed = seed
        for _ in range(3):
            temp_seed = (temp_seed * 1103515245 + 12345) & 0x7FFFFFFF
            idx = temp_seed % len(templates)
            while idx in selected_indices:
                idx = (idx + 1) % len(templates)
            selected_indices.append(idx)

        challenges = []
        for i, idx in enumerate(selected_indices):
            t = templates[idx]
            conn.execute("""
                INSERT INTO daily_challenge_progress
                (challenge_date, challenge_index, challenge_title, challenge_desc, points)
                VALUES (?, ?, ?, ?, ?)
            """, (challenge_date, i, t["title"], t["desc"], t["points"]))
            challenges.append({
                "challenge_date": challenge_date,
                "challenge_index": i,
                "challenge_title": t["title"],
                "challenge_desc": t["desc"],
                "points": t["points"],
                "completed": 0,
                "completed_at": None,
            })

        conn.commit()
        return challenges

    def complete_challenge(self, challenge_date: str, challenge_index: int) -> bool:
        """完成一个每日挑战，返回是否成功"""
        conn = self._get_conn()
        existing = conn.execute("""
            SELECT completed FROM daily_challenge_progress
            WHERE challenge_date = ? AND challenge_index = ?
        """, (challenge_date, challenge_index)).fetchone()

        if not existing:
            return False
        if existing["completed"]:
            return False

        conn.execute("""
            UPDATE daily_challenge_progress
            SET completed = 1, completed_at = ?
            WHERE challenge_date = ? AND challenge_index = ?
        """, (datetime.now().isoformat(), challenge_date, challenge_index))
        conn.commit()
        return True

    def get_challenge_points(self, challenge_date: str = None) -> int:
        """获取某日已完成的挑战积分"""
        if challenge_date is None:
            challenge_date = date.today().isoformat()
        conn = self._get_conn()
        row = conn.execute("""
            SELECT SUM(points) as total
            FROM daily_challenge_progress
            WHERE challenge_date = ? AND completed = 1
        """, (challenge_date,)).fetchone()
        return row["total"] or 0

    def get_total_challenge_points(self) -> int:
        """获取累计挑战积分"""
        conn = self._get_conn()
        row = conn.execute("""
            SELECT SUM(points) as total
            FROM daily_challenge_progress
            WHERE completed = 1
        """).fetchone()
        return row["total"] or 0

    def cleanup_old_records(self, days_to_keep: int = 90) -> dict:
        """清理过期游戏记录，保留最近 N 天的数据

        Args:
            days_to_keep: 保留天数，默认 90 天

        Returns:
            清理统计信息
        """
        from datetime import timedelta
        conn = self._get_conn()
        cutoff_date = (datetime.now() - timedelta(days=days_to_keep)).isoformat()

        # 获取要清理的游戏 ID
        old_games = conn.execute("""
            SELECT game_id FROM game_records WHERE ended_at < ?
        """, (cutoff_date,)).fetchall()

        if not old_games:
            return {"cleaned_games": 0, "cleaned_stats": 0}

        game_ids = [g["game_id"] for g in old_games]
        placeholders = ",".join(["?"] * len(game_ids))

        # 删除玩家统计数据
        cursor = conn.execute(f"""
            DELETE FROM player_game_stats WHERE game_id IN ({placeholders})
        """, game_ids)
        cleaned_stats = cursor.rowcount

        # 删除游戏记录
        cursor = conn.execute(f"""
            DELETE FROM game_records WHERE game_id IN ({placeholders})
        """, game_ids)
        cleaned_games = cursor.rowcount

        conn.commit()

        # 执行 VACUUM 回收空间
        conn.execute("VACUUM")

        return {"cleaned_games": cleaned_games, "cleaned_stats": cleaned_stats}

    def get_database_size(self) -> dict:
        """获取数据库大小信息"""
        import os
        db_size = self.db_path.stat().st_size if self.db_path.exists() else 0
        return {
            "size_bytes": db_size,
            "size_mb": round(db_size / (1024 * 1024), 2)
        }


# 全局数据库实例
db = Database()
