"""
后端主服务模块 (app.py)
职责：整合数据校验、算法执行、WebSocket通信三大功能，
       提供HTTP接口接收前端请求，通过WebSocket批量推送算法步骤数据。
       前端负责所有播放控制（自动/手动步进/暂停/继续），后端仅负责数据生成与投递。
       支持多用户会话隔离和重置。

运行方式：python app.py
"""

import json
import threading
import uuid
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
# 结构: { session_id: { "steps": [...], "algorithm": str } }
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

        is_valid, result = validate_input(raw_data, algorithm)
        if not is_valid:
            return jsonify({"success": False, "error": result}), 400

        if algorithm == "heap_create":
            steps = build_heap_steps(result)
        elif algorithm == "quicksort":
            steps = quicksort_steps(result)
        else:
            return jsonify({"success": False, "error": f"不支持的算法: {algorithm}"}), 400

        session_id = str(uuid.uuid4())
        with sessions_lock:
            sessions[session_id] = {
                "steps": steps,
                "algorithm": algorithm,
            }

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
    主循环负责接收前端指令（start/reset），
    步骤数据以批量形式一次性推送，前端控制所有播放逻辑。
    """
    current_session_id = None

    try:
        ws.send(json.dumps({
            "type": "connected",
            "message": "WebSocket连接已建立"
        }))

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
                session_id = msg.get("session_id")
                if not session_id or session_id not in sessions:
                    ws.send(json.dumps({
                        "type": "error",
                        "message": "无效的会话ID，请重新提交数据"
                    }))
                    continue

                current_session_id = session_id
                _send_steps_batch(ws, session_id)

            elif action == "reset":
                _cleanup_session(current_session_id)
                current_session_id = None
                ws.send(json.dumps({
                    "type": "reset_done",
                    "message": "已重置"
                }))

    except Exception as e:
        print(f"[WebSocket] 连接异常: {e}")
    finally:
        _cleanup_session(current_session_id)


def _send_steps_batch(ws, session_id):
    """
    将指定会话的所有步骤一次性批量发送给前端
    :param ws: WebSocket连接对象
    :param session_id: 当前会话ID
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
        algorithm = session.get("algorithm", "")

        # 填充步骤编号
        for i, s in enumerate(steps):
            s["current_step"] = i + 1

        # 批量发送所有步骤数据
        ws.send(json.dumps({
            "type": "steps_batch",
            "steps": steps,
            "algorithm": algorithm,
            "total_steps": len(steps)
        }))

    except Exception as e:
        print(f"[推送] 异常: {e}")
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
            sessions.pop(session_id, None)


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
