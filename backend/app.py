"""
后端主服务模块 (app.py)
职责：整合数据校验、算法执行、WebSocket通信三大功能，
      提供HTTP接口接收前端请求，通过WebSocket实时推送算法步骤数据。
      支持多用户会话隔离、暂停/继续/重置等交互控制。

运行方式：python app.py
"""

import json
import threading
import uuid
import time
from flask import Flask, request, jsonify
from flask_sock import Sock
from flask_cors import CORS

from validator import validate_input
from algorithms import build_heap_steps, quicksort_steps

# ── Flask 应用初始化 ────────────────────────────────────────────
app = Flask(__name__)
CORS(app)                                    # 跨域支持
sock = Sock(app)                             # WebSocket 扩展集成

# ── 全局会话存储 ────────────────────────────────────────────────
# 结构: { session_id: { "steps": [...], "algorithm": str,
#         "pause_event": threading.Event, "stop_event": threading.Event } }
sessions = {}
sessions_lock = threading.Lock()


# ═══════════════════════════════════════════════════════════════
#  HTTP 接口层
# ═══════════════════════════════════════════════════════════════

@app.route("/api/submit", methods=["POST"])
def submit_data():
    """
    接收前端提交的输入数据及算法类型
    流程：校验数据 -> 生成步骤数据 -> 创建会话 -> 返回session_id
    """
    try:
        body = request.get_json(silent=True)
        if not body:
            return jsonify({"success": False, "error": "请求体不能为空"}), 400

        raw_data = body.get("data")
        algorithm = body.get("algorithm", "heap_create")

        # 调用校验模块
        is_valid, result = validate_input(raw_data, algorithm)
        if not is_valid:
            return jsonify({"success": False, "error": result}), 400

        # 根据算法类型调用对应的算法执行器
        if algorithm == "heap_create":
            steps = build_heap_steps(result)
        elif algorithm == "quicksort":
            steps = quicksort_steps(result)
        else:
            return jsonify({"success": False, "error": f"不支持的算法: {algorithm}"}), 400

        # 创建会话，存储步骤数据
        session_id = str(uuid.uuid4())
        with sessions_lock:
            sessions[session_id] = {
                "steps": steps,
                "algorithm": algorithm,
                "pause_event": threading.Event(),
                "stop_event": threading.Event(),
            }
            sessions[session_id]["pause_event"].set()  # 初始为非暂停状态

        return jsonify({
            "success": True,
            "session_id": session_id,
            "total_steps": len(steps),
            "algorithm": algorithm,
        })

    except Exception as e:
        return jsonify({"success": False, "error": f"服务器内部错误: {str(e)}"}), 500


# ═══════════════════════════════════════════════════════════════
#  WebSocket 通信层
# ═══════════════════════════════════════════════════════════════

@sock.route("/ws")
def ws_handler(ws):
    """
    WebSocket 连接处理函数
    每个客户端连接会进入独立的实例，实现多用户会话隔离。
    主循环负责接收前端指令（start/pause/resume/reset/speed），
    推送由独立线程完成。
    """
    current_session_id = None
    push_thread = None

    try:
        # 连接确认
        ws.send(json.dumps({
            "type": "connected",
            "message": "WebSocket连接已建立"
        }))

        # 主消息循环：持续接收前端指令
        while True:
            raw = ws.receive()
            if raw is None:
                break

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                ws.send(json.dumps({
                    "type": "error",
                    "message": "消息格式错误，需要JSON格式"
                }))
                continue

            action = msg.get("action", "")

            if action == "start":
                # 根据session_id查找对应会话，启动推送线程
                session_id = msg.get("session_id")
                if not session_id or session_id not in sessions:
                    ws.send(json.dumps({
                        "type": "error",
                        "message": "无效的会话ID，请重新提交数据"
                    }))
                    continue

                current_session_id = session_id
                interval = msg.get("interval", 1.0)

                # 在独立线程中推送步骤数据
                push_thread = threading.Thread(
                    target=_push_steps,
                    args=(ws, session_id, interval),
                    daemon=True
                )
                push_thread.start()

            elif action == "pause":
                if current_session_id and current_session_id in sessions:
                    sessions[current_session_id]["pause_event"].clear()

            elif action == "resume":
                if current_session_id and current_session_id in sessions:
                    sessions[current_session_id]["pause_event"].set()

            elif action == "reset":
                _cleanup_session(current_session_id)
                current_session_id = None
                ws.send(json.dumps({
                    "type": "reset_done",
                    "message": "已重置"
                }))

            elif action == "speed":
                # 前端速度调节（在start后调整推送间隔）
                pass  # 速度由前端控制，后端只响应前端要求的间隔

    except Exception as e:
        print(f"[WebSocket] 连接异常: {e}")
    finally:
        # 连接断开时清理会话
        _cleanup_session(current_session_id)


def _push_steps(ws, session_id, interval):
    """
    在独立线程中逐步骤推送算法数据
    :param ws: WebSocket连接对象
    :param session_id: 当前会话ID
    :param interval: 步骤间推送间隔（秒）
    """
    try:
        session = sessions.get(session_id)
        if not session:
            ws.send(json.dumps({
                "type": "error",
                "message": "会话已失效"
            }))
            return

        steps = session["steps"]
        pause_event = session["pause_event"]
        stop_event = session["stop_event"]

        for i, step in enumerate(steps):
            # 检查是否需要停止
            if stop_event.is_set():
                break

            # 等待暂停恢复
            pause_event.wait()

            if stop_event.is_set():
                break

            # 推送当前步骤
            step["current_step"] = i + 1
            ws.send(json.dumps(step))

            # 等待指定间隔（期间仍可响应暂停/停止）
            elapsed = 0
            tick = 0.1
            while elapsed < interval:
                if stop_event.is_set():
                    break
                if not pause_event.is_set():
                    # 暂停期间不消耗时间
                    pause_event.wait()
                time.sleep(tick)
                elapsed += tick

        # 推送完成
        if not stop_event.is_set():
            ws.send(json.dumps({
                "type": "completed",
                "step_id": -1,
                "algorithm": session.get("algorithm", ""),
                "description": "演示完成",
                "status": "completed"
            }))

    except Exception as e:
        print(f"[推送线程] 异常: {e}")
        try:
            ws.send(json.dumps({
                "type": "error",
                "message": f"推送异常: {str(e)}"
            }))
        except Exception:
            pass


def _cleanup_session(session_id):
    """清理指定会话的资源"""
    if session_id and session_id in sessions:
        with sessions_lock:
            session = sessions.pop(session_id, None)
            if session:
                session["stop_event"].set()
                session["pause_event"].set()


# ═══════════════════════════════════════════════════════════════
#  应用启动入口
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  数据结构与算法可视化演示系统 - 后端服务")
    print("  HTTP API:  http://localhost:5000/api/submit")
    print("  WebSocket: ws://localhost:5000/ws")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
