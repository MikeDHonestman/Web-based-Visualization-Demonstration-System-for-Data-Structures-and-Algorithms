/**
 * 前端主逻辑模块 (main.js)
 * 职责：整合前端所有模块，处理用户交互，协调输入解析、请求提交、
 *       WebSocket通信、可视化渲染的完整流程。
 */
(function () {
    'use strict';

    /* ── DOM元素引用 ── */
    var dataInput      = document.getElementById('dataInput');
    var algoSelect     = document.getElementById('algoSelect');
    var speedSelect    = document.getElementById('speedSelect');
    var btnSubmit      = document.getElementById('btnSubmit');
    var btnPause       = document.getElementById('btnPause');
    var btnContinue    = document.getElementById('btnContinue');
    var btnReset       = document.getElementById('btnReset');
    var stepDesc       = document.getElementById('stepDescription');
    var hintText       = document.getElementById('hintText');
    var statusBadge    = document.getElementById('statusBadge');

    /* ── 状态变量 ── */
    var currentSessionId = null;
    var currentAlgorithm = null;
    var isPaused = false;
    var isRunning = false;
    var parsedInputData = null;
    var totalSteps = 0;

    /* ═══════════════════════════════════════════════════════════
     *  页面初始化
     * ═══════════════════════════════════════════════════════════ */
    function init() {
        // 建立WebSocket连接
        WSManager.connect();

        // 注册WebSocket消息处理器（将步骤数据交给可视化模块）
        WSManager.onMessage(function (step) {
            handleStepData(step);
        });

        // 注册WebSocket状态监听器（更新页面状态提示）
        WSManager.onStatusChange(function (status, message) {
            updateStatus(status, message);
        });

        // 绑定按钮事件
        btnSubmit.addEventListener('click', onSubmit);
        btnPause.addEventListener('click', onPause);
        btnContinue.addEventListener('click', onResume);
        btnReset.addEventListener('click', onReset);

        // 算法切换时更新输入提示
        algoSelect.addEventListener('change', updateInputHint);

        // 初始提示
        updateInputHint();
    }

    /* ═══════════════════════════════════════════════════════════
     *  提交处理
     * ═══════════════════════════════════════════════════════════ */
    function onSubmit() {
        if (isRunning) {
            setHint('演示正在进行中，请先重置', 'error');
            return;
        }

        var rawInput = dataInput.value.trim();
        if (!rawInput) {
            setHint('请输入数据', 'error');
            return;
        }

        // 前端预校验：解析输入文本为整数数组
        var parts = rawInput.split(',');
        var arr = [];
        for (var i = 0; i < parts.length; i++) {
            var val = parts[i].trim();
            if (val === '') continue;
            var num = parseInt(val, 10);
            if (isNaN(num)) {
                setHint('"' + val + '" 不是有效的整数，请重新输入', 'error');
                return;
            }
            arr.push(num);
        }

        if (arr.length === 0) {
            setHint('输入数据为空，请输入至少一个整数', 'error');
            return;
        }

        parsedInputData = arr;
        currentAlgorithm = algoSelect.value;

        // 前端预校验：算法特定的长度检查
        if (currentAlgorithm === 'heap_create' && arr.length < 2) {
            setHint('堆创建至少需要2个整数', 'error');
            return;
        }
        if (currentAlgorithm === 'quicksort' && arr.length < 2) {
            setHint('快速排序至少需要2个整数', 'error');
            return;
        }

        // 通过HTTP POST提交数据到后端
        setHint('正在提交数据...', 'info');
        btnSubmit.disabled = true;

        fetch('http://localhost:5000/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: arr,
                algorithm: currentAlgorithm,
            }),
        })
            .then(function (resp) { return resp.json(); })
            .then(function (result) {
                btnSubmit.disabled = false;

                if (!result.success) {
                    setHint('提交失败：' + result.error, 'error');
                    return;
                }

                // 提交成功，保存session_id，开始演示
                currentSessionId = result.session_id;
                totalSteps = result.total_steps;
                updateStatus('running', '演示中...');

                // 初始化可视化画布
                initVisualization(arr);

                // 通过WebSocket发送开始演示指令
                var interval = parseFloat(speedSelect.value) || 1.0;
                var sent = WSManager.send({
                    action: 'start',
                    session_id: currentSessionId,
                    interval: interval,
                });

                if (sent) {
                    isRunning = true;
                    setHint('数据提交成功，演示开始（共' + totalSteps + '步）', 'info');
                    btnPause.disabled = false;
                    btnSubmit.disabled = true;
                } else {
                    setHint('WebSocket未连接，请确认后端服务已启动', 'error');
                }
            })
            .catch(function (err) {
                btnSubmit.disabled = false;
                setHint('请求失败：无法连接后端服务（请确认已启动 python app.py）', 'error');
                console.error(err);
            });
    }

    /* ═══════════════════════════════════════════════════════════
     *  步骤数据处理（来自WebSocket消息推送）
     * ═══════════════════════════════════════════════════════════ */
    function handleStepData(step) {
        // 更新步骤说明文字
        if (step.description) {
            var stepNum = step.current_step || step.step_id || '';
            stepDesc.innerHTML = '<strong>步骤 ' + stepNum + '：</strong>' + step.description;
        }

        // 调用可视化模块渲染
        Visualizer.renderStep(step);

        // 处理演示完成
        if (step.type === 'completed' || step.status === 'completed') {
            isRunning = false;
            btnPause.disabled = true;
            btnContinue.disabled = true;
            btnSubmit.disabled = true;
            updateStatus('completed', '演示完成');
            setHint('演示已完成。可点击"重置"重新开始。', 'info');
        }
    }

    /* ═══════════════════════════════════════════════════════════
     *  交互控制：暂停 / 继续 / 重置
     * ═══════════════════════════════════════════════════════════ */

    function onPause() {
        if (!isRunning || isPaused) return;

        WSManager.send({ action: 'pause' });
        isPaused = true;
        btnPause.disabled = true;
        btnContinue.disabled = false;
        updateStatus('running', '已暂停');
        setHint('演示已暂停，点击"继续"恢复演示', 'info');
    }

    function onResume() {
        if (!isRunning || !isPaused) return;

        WSManager.send({ action: 'resume' });
        isPaused = false;
        btnPause.disabled = false;
        btnContinue.disabled = true;
        updateStatus('running', '演示中...');
        setHint('演示继续...', 'info');
    }

    function onReset() {
        // 通知后端停止推送并清理会话
        WSManager.send({ action: 'reset' });

        // 重置前端状态
        currentSessionId = null;
        currentAlgorithm = null;
        isPaused = false;
        isRunning = false;
        parsedInputData = null;
        totalSteps = 0;

        dataInput.value = '';
        stepDesc.innerHTML = '请输入数据并点击"提交"开始演示...';
        setHint('提示：请输入整数并用逗号分隔后点击"提交"', 'info');
        updateStatus('ready', '就绪');

        btnSubmit.disabled = false;
        btnPause.disabled = true;
        btnContinue.disabled = true;

        Visualizer.reset();
    }

    /* ═══════════════════════════════════════════════════════════
     *  辅助函数
     * ═══════════════════════════════════════════════════════════ */

    /**
     * 根据当前选择的算法初始化对应的可视化画布
     */
    function initVisualization(arr) {
        if (currentAlgorithm === 'heap_create') {
            Visualizer.initHeap(arr);
        } else if (currentAlgorithm === 'quicksort') {
            Visualizer.initQuickSort(arr);
        }
    }

    /**
     * 更新状态徽章
     */
    function updateStatus(status, message) {
        statusBadge.textContent = message;
        statusBadge.className = 'status-badge';
        if (status === 'error') statusBadge.classList.add('error');
        if (status === 'running') statusBadge.classList.add('running');
    }

    /**
     * 更新底部提示文字
     */
    function setHint(message, type) {
        hintText.textContent = message;
        hintText.style.color = '';
        if (type === 'error') hintText.style.color = '#f44336';
        else if (type === 'info') hintText.style.color = '#1a73e8';
    }

    /**
     * 更新输入框提示文字（根据选中的算法）
     */
    function updateInputHint() {
        var algo = algoSelect.value;
        if (algo === 'heap_create') {
            dataInput.placeholder = '请输入整数（如9个），用逗号分隔，如 4,10,3,5,1,8,6,2,7';
        } else if (algo === 'quicksort') {
            dataInput.placeholder = '请输入整数，用逗号分隔，如 5,3,8,4,2,7,1,6';
        }
    }

    // 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', init);
})();
