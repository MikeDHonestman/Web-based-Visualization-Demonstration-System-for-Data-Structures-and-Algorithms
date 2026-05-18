(function () {
    'use strict';

    var dataInput      = document.getElementById('dataInput');
    var algoSelect     = document.getElementById('algoSelect');
    var speedSelect    = document.getElementById('speedSelect');
    var btnSubmit      = document.getElementById('btnSubmit');
    var btnPause       = document.getElementById('btnPause');
    var btnContinue    = document.getElementById('btnContinue');
    var btnStepPrev    = document.getElementById('btnStepPrev');
    var btnStepNext    = document.getElementById('btnStepNext');
    var btnReset       = document.getElementById('btnReset');
    var stepDesc       = document.getElementById('stepDescription');
    var hintText       = document.getElementById('hintText');
    var statusBadge    = document.getElementById('statusBadge');

    var currentSessionId = null;
    var currentAlgorithm = null;
    var isPaused = false;
    var isRunning = false;
    var parsedInputData = null;
    var totalSteps = 0;

    var stepHistory = [];
    var currentStepIdx = -1;
    var autoPlayTimer = null;

    function init() {
        WSManager.connect();

        WSManager.onMessage(function (data) {
            handleMessage(data);
        });

        WSManager.onStatusChange(function (status, message) {
            updateStatus(status, message);
        });

        btnSubmit.addEventListener('click', onSubmit);
        btnPause.addEventListener('click', onPause);
        btnContinue.addEventListener('click', onResume);
        btnStepPrev.addEventListener('click', onStepPrev);
        btnStepNext.addEventListener('click', onStepNext);
        btnReset.addEventListener('click', onReset);

        algoSelect.addEventListener('change', updateInputHint);
        updateInputHint();
    }

    function handleMessage(data) {
        if (data.type === 'connected') return;
        if (data.type === 'error') {
            setHint(data.message, 'error');
            return;
        }
        if (data.type === 'completed') {
            onCompleted();
            return;
        }
        if (data.type === 'reset_done') return;

        if (data.type === 'steps_batch' && data.steps) {
            stepHistory = data.steps;
            totalSteps = data.total_steps || data.steps.length;
            currentStepIdx = -1;
            startAutoPlay();
            return;
        }

        if (data.step_id !== undefined || data.description) {
            stepHistory.push(data);
            totalSteps = stepHistory.length;
            currentStepIdx = stepHistory.length - 1;
            if (!isPaused && isRunning) {
                renderCurrentStep();
            }
        }
    }

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

        if (currentAlgorithm === 'heap_create' && arr.length < 2) {
            setHint('堆创建至少需要2个整数', 'error');
            return;
        }
        if (currentAlgorithm === 'quicksort' && arr.length < 2) {
            setHint('快速排序至少需要2个整数', 'error');
            return;
        }

        setHint('正在提交数据...', 'info');
        btnSubmit.disabled = true;

        fetch('http://' + location.hostname + ':5000/api/submit', {
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

                currentSessionId = result.session_id;
                totalSteps = result.total_steps;

                initVisualization(arr);

                var sent = WSManager.send({
                    action: 'start',
                    session_id: currentSessionId,
                });

                if (sent) {
                    isRunning = true;
                    isPaused = false;
                    stepHistory = [];
                    currentStepIdx = -1;
                    setHint('数据提交成功，演示开始（共' + totalSteps + '步）', 'info');
                    btnPause.disabled = false;
                    btnStepPrev.disabled = false;
                    btnStepNext.disabled = false;
                    btnSubmit.disabled = true;
                    btnContinue.disabled = true;
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

    function startAutoPlay() {
        var interval = parseFloat(speedSelect.value) * 1000 || 1000;
        updateStatus('running', '演示中...');

        advanceStep();

        autoPlayTimer = setInterval(function () {
            if (isPaused) return;
            if (currentStepIdx >= stepHistory.length - 1) {
                stopAutoPlay();
                onCompleted();
                return;
            }
            advanceStep();
        }, interval);
    }

    function stopAutoPlay() {
        if (autoPlayTimer) {
            clearInterval(autoPlayTimer);
            autoPlayTimer = null;
        }
    }

    function advanceStep() {
        if (currentStepIdx < stepHistory.length - 1) {
            currentStepIdx++;
            renderCurrentStep();
        }
    }

    function retreatStep() {
        if (currentStepIdx > 0) {
            currentStepIdx--;
            renderCurrentStep();
        }
    }

    function renderCurrentStep() {
        if (currentStepIdx < 0 || currentStepIdx >= stepHistory.length) return;
        var step = stepHistory[currentStepIdx];

        btnStepPrev.disabled = (currentStepIdx <= 0);
        btnStepNext.disabled = (currentStepIdx >= totalSteps - 1);

        if (step.description) {
            var stepNum = currentStepIdx + 1;
            stepDesc.innerHTML = '<strong>步骤 ' + stepNum + '/' + totalSteps + '：</strong>' + step.description;
        }

        Visualizer.renderStep(step);
    }

    function onPause() {
        if (!isRunning || isPaused) return;
        isPaused = true;
        btnPause.disabled = true;
        btnContinue.disabled = false;
        updateStatus('running', '已暂停');
        setHint('演示已暂停，点击"继续"恢复自动演示，或使用"上一步/下一步"手动查看', 'info');
    }

    function onResume() {
        if (!isRunning || !isPaused) return;
        isPaused = false;
        btnPause.disabled = false;
        btnContinue.disabled = true;
        updateStatus('running', '演示中...');
        setHint('演示继续...', 'info');
    }

    function onStepPrev() {
        if (!isRunning) return;
        if (!isPaused) {
            isPaused = true;
            btnPause.disabled = true;
            btnContinue.disabled = false;
            updateStatus('running', '已暂停（手动步进）');
        }
        retreatStep();
    }

    function onStepNext() {
        if (!isRunning) return;
        if (!isPaused) {
            isPaused = true;
            btnPause.disabled = true;
            btnContinue.disabled = false;
            updateStatus('running', '已暂停（手动步进）');
        }
        if (currentStepIdx >= stepHistory.length - 1) {
            onCompleted();
            return;
        }
        advanceStep();
    }

    function onCompleted() {
        stopAutoPlay();
        isRunning = false;
        isPaused = false;
        btnPause.disabled = true;
        btnContinue.disabled = true;
        btnStepPrev.disabled = true;
        btnStepNext.disabled = true;
        btnSubmit.disabled = true;
        updateStatus('completed', '演示完成');
        setHint('演示已完成。可点击"重置"重新开始。', 'info');
        Visualizer.renderStep({ type: 'completed' });
    }

    function onReset() {
        stopAutoPlay();
        WSManager.send({ action: 'reset' });

        currentSessionId = null;
        currentAlgorithm = null;
        isPaused = false;
        isRunning = false;
        parsedInputData = null;
        totalSteps = 0;
        stepHistory = [];
        currentStepIdx = -1;

        dataInput.value = '';
        stepDesc.innerHTML = '请输入数据并点击"提交"开始演示...';
        setHint('提示：请输入整数并用逗号分隔后点击"提交"', 'info');
        updateStatus('ready', '就绪');

        btnSubmit.disabled = false;
        btnPause.disabled = true;
        btnContinue.disabled = true;
        btnStepPrev.disabled = true;
        btnStepNext.disabled = true;

        Visualizer.reset();
    }

    function initVisualization(arr) {
        if (currentAlgorithm === 'heap_create') {
            Visualizer.initHeap(arr);
        } else if (currentAlgorithm === 'quicksort') {
            Visualizer.initQuickSort(arr);
        }
    }

    function updateStatus(status, message) {
        statusBadge.textContent = message;
        statusBadge.className = 'status-badge';
        if (status === 'error') statusBadge.classList.add('error');
        if (status === 'running') statusBadge.classList.add('running');
    }

    function setHint(message, type) {
        hintText.textContent = message;
        hintText.style.color = '';
        if (type === 'error') hintText.style.color = '#f44336';
        else if (type === 'info') hintText.style.color = '#1a73e8';
    }

    function updateInputHint() {
        var algo = algoSelect.value;
        if (algo === 'heap_create') {
            dataInput.placeholder = '请输入整数（如9个），用逗号分隔，如 4,10,3,5,1,8,6,2,7';
        } else if (algo === 'quicksort') {
            dataInput.placeholder = '请输入整数，用逗号分隔，如 5,3,8,4,2,7,1,6';
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
