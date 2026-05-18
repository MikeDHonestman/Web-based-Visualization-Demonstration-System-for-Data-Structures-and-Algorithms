import json
import threading
import uuid
from flask import Flask, request, jsonify
from flask_sock import Sock
from flask_cors import CORS

from validator import validate_input
from algorithms import build_heap_steps, quicksort_steps

app = Flask(__name__)
CORS(app)
sock = Sock(app)

sessions = {}
sessions_lock = threading.Lock()


@app.route("/api/submit", methods=["POST"])
def submit_data():
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


@sock.route("/ws")
def ws_handler(ws):
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

        for i, s in enumerate(steps):
            s["current_step"] = i + 1

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
    if session_id and session_id in sessions:
        with sessions_lock:
            sessions.pop(session_id, None)


if __name__ == "__main__":
    print("=" * 60)
    print("  数据结构与算法可视化演示系统 - 后端服务")
    print("  HTTP API:  http://localhost:5000/api/submit")
    print("  WebSocket: ws://localhost:5000/ws")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
