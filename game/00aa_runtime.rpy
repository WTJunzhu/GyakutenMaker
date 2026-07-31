# Ace Attorney Ren'Py — Data-Driven Flow Interpreter
#
# Phase 1 core: reads case.json and drives game flow using only
# valid Ren'Py public APIs (renpy.exports.say, renpy.exports.call_screen, etc.).
#
# Architecture:
#   aa_run_case(filepath, entry)  ← Ren'Py label — call this to start
#   _aa_rt.dispatch(node)         ← Python — routes by node["type"]
#   _aa_rt.exec_*                 ← Python — one handler per node type
#
# This file is the ONLY place that interprets case.json.
# It intentionally does NOT use renpy.execute() or block="script" tricks.

# ─── Runtime Python Layer ─────────────────────────────────────────

init -996 python in _aa_rt:

    import renpy.exports
    import renpy.revertable
    import store

    # ─── Character store lookup ────────────────────────────────────

    def _get_char(char_id):
        """Return the store-level Ren'Py Character for char_id, or None."""
        if char_id is None:
            return None
        return getattr(store, char_id, None)

    # ─── Dialogue helpers ──────────────────────────────────────────

    def _say_line(line):
        """
        Speak one dialogue line dict:
          { "character": "phoenix", "text": "..." }
          { "text": "..." }  (narrator)
        Uses renpy.exports.say() — a fully valid public API.
        """
        char_id = line.get("character")
        text = line.get("text", "")

        if char_id:
            char = _get_char(char_id)
            if char is not None:
                renpy.exports.say(char, text)
            else:
                # Fallback: show as narrator with name prefix
                renpy.exports.say(None, "[{}] {}".format(char_id, text))
        else:
            renpy.exports.say(None, text)

    def _say_lines(lines):
        """Speak a list of dialogue line dicts."""
        for line in (lines or []):
            _say_line(line)

    # ─── Scene helpers ─────────────────────────────────────────────

    def _apply_scene(node):
        """Apply scene/show/bgm directives from a node dict."""
        scene = node.get("scene")
        if scene:
            # e.g. "bg courtroom" → renpy.exports.scene() + show
            # We use renpy.exports.scene() with the image tag then show the bg.
            # Simplest cross-version approach: use the scene statement equivalent
            renpy.exports.scene(layer="master")
            # Show the background image by name
            parts = scene.split()
            if len(parts) == 2 and parts[0] == "bg":
                try:
                    renpy.exports.show(parts[1], tag="bg", layer="master")
                except Exception:
                    pass
            elif len(parts) == 1:
                try:
                    renpy.exports.show(parts[0], tag=parts[0], layer="master")
                except Exception:
                    pass

        bgm = node.get("bgm")
        if bgm:
            try:
                renpy.exports.music.play(bgm, channel="music")
            except Exception:
                pass

    # ─── Node dispatch ─────────────────────────────────────────────

    def dispatch(node, case_data):
        """
        Execute one case.json node dict.
        Returns the next node_id (str or None).
        """
        ntype = node.get("type")

        # Scene/BGM applied before content for all node types
        _apply_scene(node)

        if ntype == "dialogue":
            return exec_dialogue(node, case_data)
        elif ntype == "get_evidence":
            return exec_get_evidence(node, case_data)
        elif ntype == "set_flag":
            return exec_set_flag(node, case_data)
        elif ntype == "testimony":
            return exec_testimony(node, case_data)
        elif ntype == "investigation":
            return exec_investigation(node, case_data)
        elif ntype == "talk":
            return exec_talk(node, case_data)
        elif ntype == "choice":
            return exec_choice(node, case_data)
        elif ntype == "penalty":
            return exec_penalty(node, case_data)
        else:
            renpy.exports.say(None, "[AA Runtime] Unknown node type: {}".format(ntype))
            return node.get("next")

    # ─── dialogue ──────────────────────────────────────────────────

    def exec_dialogue(node, case_data):
        """
        { "type": "dialogue",
          "scene": "bg courtroom",        (optional)
          "show_health_bar": true,         (optional)
          "hide_health_bar": true,         (optional)
          "lines": [ { "character": "...", "text": "..." }, ... ],
          "next": "node_id" }
        """
        if node.get("show_health_bar"):
            renpy.exports.show_screen("aa_health_bar")

        _say_lines(node.get("lines", []))

        if node.get("hide_health_bar"):
            renpy.exports.hide_screen("aa_health_bar")

        return node.get("next")

    # ─── get_evidence ──────────────────────────────────────────────

    def exec_get_evidence(node, case_data):
        """
        { "type": "get_evidence",
          "evidence_ids": ["autopsy_report", "thinker"],
          "next": "node_id" }
        """
        for ev_id in node.get("evidence_ids", []):
            ev_data = store._aa._evidence_defs.get(ev_id)
            if ev_data is not None:
                store.court_record.add_evidence(ev_id, ev_data)
            else:
                renpy.exports.say(None, "[AA Runtime] Unknown evidence: {}".format(ev_id))
        return node.get("next")

    # ─── set_flag ──────────────────────────────────────────────────

    def exec_set_flag(node, case_data):
        """
        { "type": "set_flag", "key": "test_complete", "value": true, "next": "..." }
        """
        store.court_record.set_flag(node["key"], node.get("value", True))
        return node.get("next")

    # ─── penalty ───────────────────────────────────────────────────

    def exec_penalty(node, case_data):
        """
        { "type": "penalty", "amount": 2, "next": "..." }
        """
        store._aa.on_penalty(node.get("amount", 1))
        renpy.exports.restart_interaction()
        return node.get("next")

    # ─── testimony ─────────────────────────────────────────────────
    #
    # This replaces the broken begin_testimony block="script" mechanism.
    # All testimony data comes from case.json; interaction via call_screen.

    def exec_testimony(node, case_data):
        """
        { "type": "testimony",
          "title": "事件目击证言",
          "witness": "sahwit",
          "stmts": ["text1", "text2", ...],
          "press_handlers": {
              "2": { "lines": [...] }
          },
          "present_handlers": {
              "5": {
                  "correct_evidence": ["thinker"],
                  "on_correct": {
                      "lines": [...],
                      "penalty": 2,
                      "next": "override_next_node_id"   (optional)
                  }
              }
          },
          "next": "node_id"
        }
        """
        # Initialise testimony state (mirrors execute_begin_testimony)
        store._aa_testimony_title = node.get("title", "")
        stmts = list(node.get("stmts", []))
        store._aa_testimony_stmts = renpy.revertable.RevertableList(stmts)
        store._aa_testimony_index = 0
        store._aa_testimony_active = True

        press_handlers = node.get("press_handlers", {})
        present_handlers = node.get("present_handlers", {})

        # Build present correct_ids map for interaction loop
        # Key: stmt index (1-based int or "current"), Value: [evidence_ids]
        present_correct_map = {}
        for key, handler in present_handlers.items():
            present_correct_map[str(key)] = handler.get("correct_evidence", [])

        renpy.exports.show_screen("aa_testimony_panel")
        renpy.exports.show_screen("aa_press_present_bar")
        renpy.exports.show_screen("aa_courtroom_keys")

        override_next = None

        # Main testimony loop
        while True:
            # Update present_correct_ids for current stmt
            idx = store._aa_testimony_index
            idx_str = str(idx + 1)  # 1-based
            current_correct = present_correct_map.get(idx_str,
                              present_correct_map.get("current", []))
            store._aa_present_correct_ids = renpy.revertable.RevertableList(current_correct)

            # Wait for player action
            action = renpy.exports.call_screen("aa_testimony_interact")
            renpy.exports.hide_screen("aa_testimony_interact")

            if action is None:
                continue

            if action.startswith("present:"):
                stmt_idx_str = str(int(action.split(":")[1]) + 1)  # 1-based
                handler = present_handlers.get(stmt_idx_str) or \
                          present_handlers.get("current")

                # Always open evidence panel first (faithful UX)
                store._aa_evidence_panel_open = True
                store._aa_selected_evidence = None
                renpy.exports.show_screen("aa_evidence_panel")
                selected = renpy.exports.call_screen("aa_evidence_select")
                store._aa_evidence_panel_open = False
                renpy.exports.hide_screen("aa_evidence_panel")

                if selected is None:
                    continue

                # If no handler for this stmt, any evidence is wrong
                correct_ids = handler.get("correct_evidence", []) if handler else []
                if selected in correct_ids:
                    # Correct evidence presented
                    on_correct = handler.get("on_correct", {})
                    _say_lines(on_correct.get("lines", []))

                    penalty = on_correct.get("penalty", 0)
                    if penalty:
                        store._aa.on_penalty(penalty)
                        renpy.exports.restart_interaction()

                    # Testimony ends on successful present
                    override_next = on_correct.get("next")
                    break
                else:
                    # Wrong evidence
                    store._aa.on_wrong_present(selected, idx)
                    if store._aa_health <= 0:
                        store._aa.on_game_over()
                        store._aa_testimony_active = False
                        renpy.exports.hide_screen("aa_testimony_panel")
                        renpy.exports.hide_screen("aa_press_present_bar")
                        renpy.exports.hide_screen("aa_courtroom_keys")
                        return None
                    continue

            elif action.startswith("press:"):
                stmt_idx_str = str(int(action.split(":")[1]) + 1)  # 1-based
                handler = press_handlers.get(stmt_idx_str) or \
                          press_handlers.get("current")
                if handler:
                    _say_lines(handler.get("lines", []))
                # After press, continue testimony loop
                continue

        # Clean up testimony state
        store._aa_testimony_active = False
        store._aa_testimony_stmts = None
        store._aa_testimony_index = 0
        store._aa_testimony_title = ""
        renpy.exports.hide_screen("aa_testimony_panel")
        renpy.exports.hide_screen("aa_press_present_bar")
        renpy.exports.hide_screen("aa_courtroom_keys")
        store._aa.on_testimony_complete()
        renpy.exports.restart_interaction()

        return override_next if override_next is not None else node.get("next")

    # ─── investigation ─────────────────────────────────────────────

    def exec_investigation(node, case_data):
        """
        { "type": "investigation",
          "scene": "bg apartment",
          "location_id": "crime_scene",
          "intro_lines": [...],
          "hotspots": [
              { "id": "statue_spot", "name": "雕像底座",
                "x": 800, "y": 400, "size_w": 150, "size_h": 150, "radius": 120,
                "lines": [...],
                "get_evidence": "floor_plan"
              }, ...
          ],
          "next": "node_id"
        }
        """
        _say_lines(node.get("intro_lines", []))

        location_id = node.get("location_id")

        # Build hotspot_defs dict from JSON data (replaces parsed block nodes)
        hotspot_defs = {}
        hotspot_content = {}  # hotspot_id → { lines, get_evidence }
        for hs in node.get("hotspots", []):
            hid = hs["id"]
            hotspot_defs[hid] = {
                "hotspot_id": hid,
                "name": hs.get("name", hid),
                "x": hs.get("x", 0),
                "y": hs.get("y", 0),
                "size_w": hs.get("size_w", 100),
                "size_h": hs.get("size_h", 100),
                "radius": hs.get("radius", 100),
            }
            hotspot_content[hid] = {
                "lines": hs.get("lines", []),
                "get_evidence": hs.get("get_evidence"),
            }

        store._aa._hotspot_defs = hotspot_defs
        store._aa_investigation_active = True
        store._aa_investigation_location = location_id

        # Main investigation loop — identical contract to existing next_investigate,
        # but uses data from JSON instead of parse-time block nodes.
        while True:
            store._aa_investigation_active = True
            hotspot_id = renpy.exports.call_screen(
                "aa_investigation_scene",
                location_id=location_id,
                hotspot_defs=hotspot_defs,
            )

            if hotspot_id == "__exit__":
                break

            if hotspot_id is None:
                continue

            store.court_record.mark_examined(hotspot_id)
            store._aa.on_hotspot_examined(hotspot_id)

            content = hotspot_content.get(hotspot_id)
            if content:
                _say_lines(content.get("lines", []))

                ev_id = content.get("get_evidence")
                if ev_id:
                    ev_data = store._aa._evidence_defs.get(ev_id)
                    if ev_data is not None:
                        store.court_record.add_evidence(ev_id, ev_data)
                    else:
                        renpy.exports.say(None, "[AA Runtime] Unknown evidence: {}".format(ev_id))

            renpy.exports.restart_interaction()

        store._aa_investigation_active = False
        store._aa_investigation_location = None
        store._aa._hotspot_defs = {}
        renpy.exports.restart_interaction()

        return node.get("next")

    # ─── talk ──────────────────────────────────────────────────────

    def exec_talk(node, case_data):
        """
        { "type": "talk",
          "npc_id": "larry",
          "topics": [
              { "name": "事件当天", "lines": [...] },
              ...
          ],
          "present_handlers": [
              { "evidence_id": "thinker", "lines": [...] },
              ...
          ],
          "next": "node_id"
        }
        """
        npc_id = node.get("npc_id", "")

        # Build lookup maps from JSON data
        topic_map = {}     # name → lines list
        topic_order = []
        for t in node.get("topics", []):
            tname = t["name"]
            topic_map[tname] = t.get("lines", [])
            topic_order.append(tname)

        present_map = {}   # evidence_id → lines list
        for p in node.get("present_handlers", []):
            ev_id = p.get("evidence_id")
            if ev_id:
                present_map[ev_id] = p.get("lines", [])

        store._aa_talk_npc = npc_id

        # Talk loop — mirrors existing next_talk, but data from JSON
        while True:
            available = [t for t in topic_order
                         if not store.court_record.is_topic_talked(npc_id, t)]

            choice = renpy.exports.call_screen(
                "aa_talk_menu",
                npc_id=npc_id,
                topics=available,
                has_present=len(present_map) > 0,
            )

            if choice == "__exit__":
                break

            elif choice == "__present__":
                selected = renpy.exports.call_screen("aa_evidence_select")
                if selected is not None:
                    lines = present_map.get(selected)
                    if lines is not None:
                        store.court_record.mark_evidence_presented(npc_id, selected)
                        _say_lines(lines)
                    else:
                        renpy.exports.say(None, "这个不太相关吧……")
                renpy.exports.restart_interaction()

            elif choice in topic_map:
                store.court_record.mark_topic_talked(npc_id, choice)
                _say_lines(topic_map[choice])
                renpy.exports.restart_interaction()

        store._aa_talk_npc = None
        renpy.exports.restart_interaction()

        return node.get("next")

    # ─── choice ────────────────────────────────────────────────────

    def exec_choice(node, case_data):
        """
        { "type": "choice",
          "prompt": "请选择：",
          "options": [
              { "text": "选项A", "next": "node_a" },
              { "text": "选项B", "next": "node_b" }
          ]
        }
        Uses Ren'Py menu() equivalent via call_screen aa_choice_menu.
        """
        prompt = node.get("prompt", "")
        options = node.get("options", [])

        choice_idx = renpy.exports.call_screen("aa_choice_menu",
                                       prompt=prompt,
                                       options=[o["text"] for o in options])

        if choice_idx is not None and 0 <= choice_idx < len(options):
            return options[choice_idx].get("next")
        return node.get("next")


# ─── Main Runner Label ────────────────────────────────────────────
#
# Usage in .rpy:
#   call aa_run_case("aa/case.json")
#   call aa_run_case("aa/case.json", entry="testimony_main")
#
# This is a proper Ren'Py label — participates in save/load/rollback.
# The Python interpreter loop is a single label that loops via renpy.jump_out_of_context.

label aa_run_case(filepath="aa/case.json", entry=None):

    python:
        _aa_rt_case = aa_load_case(filepath)
        _aa_rt_entry = entry or _aa_rt_case.get("entry", "start")

    jump aa_run_node


label aa_run_node:

    python:
        _aa_rt_node = _aa_rt_case["nodes"].get(_aa_rt_entry)

    if _aa_rt_node is None:
        return

    python:
        _aa_rt_entry = _aa_rt.dispatch(_aa_rt_node, _aa_rt_case)

    if _aa_rt_entry is None:
        return

    jump aa_run_node


# ─── Choice Screen ────────────────────────────────────────────────
# Used by exec_choice. Returns the index of the chosen option.

screen aa_choice_menu(prompt="", options=[]):
    modal True
    zorder 100

    frame:
        xalign 0.5
        yalign 0.5
        xpadding 40
        ypadding 30
        background "#000000dd"

        vbox:
            spacing 15
            xalign 0.5

            if prompt:
                text prompt size 22 color "#ffcc00" xalign 0.5

            null height 5

            for i, opt_text in enumerate(options):
                textbutton opt_text:
                    xalign 0.5
                    text_size 20
                    action Return(i)
