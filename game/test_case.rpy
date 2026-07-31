# ============================================================
# Ace Attorney Ren'Py — 数据驱动测试案件
#
# 阶段1 里程碑 M1 验证脚本：
#   "完全不碰 .rpy 代码，仅手改 case.json 即可改变游戏流程"
#
# 本文件只负责：
#   1. 加载素材定义 JSON（evidence / characters / locations）
#   2. 用 aa_make_character 在 store 注册角色（供 renpy.say 识别）
#   3. call aa_run_case 启动数据驱动解释器
#
# 游戏流程、台词、证言、搜证热点——全部来自 game/aa/case.json。
# ============================================================

# ─── 加载数据 ──────────────────────────────────────────────────

init python:
    aa_load_evidence("aa/evidence.json")
    aa_load_profiles("aa/characters.json")
    aa_load_locations("aa/locations.json")

# ─── 注册角色（store 级变量，供解释器通过名字查找）────────────────

define phoenix   = aa_make_character("phoenix")
define payne     = aa_make_character("payne")
define sahwit    = aa_make_character("sahwit")
define larry     = aa_make_character("larry")
define judge_aa  = aa_make_character("judge")

# ─── 入口 ─────────────────────────────────────────────────────

label start:
    call aa_run_case("aa/case.json")
    return
