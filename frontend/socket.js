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
        };

        ws.onmessage = function (event) {
            try {
                var data = JSON.parse(event.data);

                if (data.type === 'connected') {
                    return;
                }

                if (data.type === 'error') {
                    notifyStatus('error', data.message);
                    return;
                }

                if (data.type === 'steps_batch') {
                    messageHandlers.forEach(function (handler) {
                        handler(data);
                    });
                    return;
                }

                if (data.type === 'completed' || data.status === 'completed') {
                    notifyStatus('completed', '演示完成');
                    data.type = 'completed';
                }

                if (data.type === 'reset_done') {
                    notifyStatus('ready', '已重置');
                    return;
                }

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

    function send(msg) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
            return true;
        } else {
            notifyStatus('error', 'WebSocket未连接，请确保后端服务已启动');
            return false;
        }
    }

    function onMessage(handler) {
        messageHandlers.push(handler);
    }

    function onStatusChange(handler) {
        statusHandlers.push(handler);
    }

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

    function getState() {
        return ws ? ws.readyState : WebSocket.CLOSED;
    }

    function notifyStatus(status, message) {
        statusHandlers.forEach(function (handler) {
            handler(status, message);
        });
    }

    function attemptReconnect() {
        if (reconnectAttempts >= maxReconnectAttempts) return;
        reconnectAttempts++;
        var delay = Math.min(1000 * reconnectAttempts, 5000);
        reconnectTimer = setTimeout(function () {
            notifyStatus('error', '正在尝试重新连接... (' + reconnectAttempts + '/' + maxReconnectAttempts + ')');
            connect();
        }, delay);
    }

    return {
        connect: connect,
        send: send,
        onMessage: onMessage,
        onStatusChange: onStatusChange,
        close: close,
        getState: getState,
    };
})();
