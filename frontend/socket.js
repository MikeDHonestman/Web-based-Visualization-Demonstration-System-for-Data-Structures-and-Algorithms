/**
 * WebSocket 通信模块 (socket.js)
 * 职责：管理前后端WebSocket长连接，负责数据的接收与指令的发送。
 *       对外暴露接口供主逻辑调用，内部处理连接异常与重连。
 */
var WSManager = (function () {
    'use strict';

    var ws = null;
    var url = 'ws://' + location.hostname + ':5000/ws';
    var messageHandlers = [];
    var statusHandlers = [];
    var reconnectTimer = null;
    var reconnectAttempts = 0;
    var maxReconnectAttempts = 5;
    var isIntendedClose = false;

    /**
     * 建立WebSocket连接
     * 页面加载后自动调用，建立与后端的双向通信通道
     */
    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) return;

        isIntendedClose = false;
        try {
            ws = new WebSocket(url);
        } catch (e) {
            notifyStatus('error', 'WebSocket创建失败: ' + e.message);
            return;
        }

        ws.onopen = function () {
            reconnectAttempts = 0;
            notifyStatus('connected', 'WebSocket连接已建立');

            // 连接确认信息由后端通过onmessage发回
        };

        ws.onmessage = function (event) {
            try {
                var data = JSON.parse(event.data);

                // 后端连接确认
                if (data.type === 'connected') {
                    return;
                }

                // 错误消息
                if (data.type === 'error') {
                    notifyStatus('error', data.message);
                    return;
                }

                // 批量步骤数据（步进模式）
                if (data.type === 'steps_batch') {
                    messageHandlers.forEach(function (handler) {
                        handler(data);
                    });
                    return;
                }

                // 演示完成
                if (data.type === 'completed' || data.status === 'completed') {
                    notifyStatus('completed', '演示完成');
                    data.type = 'completed';
                }

                // 重置确认
                if (data.type === 'reset_done') {
                    notifyStatus('ready', '已重置');
                    return;
                }

                // 将步骤数据转发给所有注册的处理器
                messageHandlers.forEach(function (handler) {
                    handler(data);
                });
            } catch (e) {
                console.error('[WS] 消息解析失败:', e);
            }
        };

        ws.onclose = function (event) {
            if (!isIntendedClose) {
                notifyStatus('error', 'WebSocket连接已断开');
                attemptReconnect();
            }
        };

        ws.onerror = function () {
            notifyStatus('error', 'WebSocket连接错误，后端服务可能未启动');
        };
    }

    /**
     * 发送指令到后端
     * @param {Object} msg 要发送的消息对象（自动序列化为JSON）
     */
    function send(msg) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
            return true;
        } else {
            notifyStatus('error', 'WebSocket未连接，请确保后端服务已启动');
            return false;
        }
    }

    /**
     * 注册消息接收处理器
     * @param {Function} handler 接收步骤数据或状态消息的回调
     */
    function onMessage(handler) {
        messageHandlers.push(handler);
    }

    /**
     * 注册状态变更处理器
     * @param {Function} handler 接收状态变化的回调
     */
    function onStatusChange(handler) {
        statusHandlers.push(handler);
    }

    /**
     * 关闭WebSocket连接
     */
    function close() {
        isIntendedClose = true;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (ws) {
            ws.close();
            ws = null;
        }
    }

    /**
     * 获取当前连接状态
     */
    function getState() {
        return ws ? ws.readyState : WebSocket.CLOSED;
    }

    /**
     * 内部：通知所有状态监听器
     */
    function notifyStatus(status, message) {
        statusHandlers.forEach(function (handler) {
            handler(status, message);
        });
    }

    /**
     * 尝试重新连接（断线后自动触发）
     * 采用递增间隔重连策略，避免频繁重连
     */
    function attemptReconnect() {
        if (reconnectAttempts >= maxReconnectAttempts) return;
        reconnectAttempts++;
        var delay = Math.min(1000 * reconnectAttempts, 5000);
        reconnectTimer = setTimeout(function () {
            notifyStatus('error', '正在尝试重新连接... (' + reconnectAttempts + '/' + maxReconnectAttempts + ')');
            connect();
        }, delay);
    }

    // 暴露公共接口
    return {
        connect: connect,
        send: send,
        onMessage: onMessage,
        onStatusChange: onStatusChange,
        close: close,
        getState: getState,
    };
})();
