/**
 * 可视化渲染模块 (visualizer.js)
 * 职责：将后端推送的标准化步骤数据转化为SVG可视化动画。
 *       支持堆创建（树形节点）和快速排序（数组条形图）两种渲染模式。
 *       提供初始化、分步渲染、重置等核心方法。
 */
var Visualizer = (function () {
    'use strict';

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.getElementById('mainSvg');
    var currentAlgorithm = null;

    // 颜色定义（统一管理，便于调整）
    var COLORS = {
        defaultFill   : '#e8f0fe',
        defaultStroke : '#1a73e8',
        highlightFill : '#fce8e6',
        highlightStroke: '#f44336',
        compareFill   : '#fef7e0',
        compareStroke : '#ff9800',
        doneFill      : '#e6f4ea',
        doneStroke    : '#4caf50',
        pivotFill     : '#f3e8fd',
        pivotStroke   : '#9c27b0',
        textFill      : '#333',
        edgeStroke    : '#999',
    };

    /* ═══════ 堆创建的树形布局坐标 ═══════
     * 9个节点（最多4层）在800×450画布上的预定义坐标
     * 使用索引映射（数组索引 -> 树中位置）
     */
    var HEAP_POSITIONS = [
        [400, 50],           // 索引0，根节点
        [220, 150], [580, 150],  // 索引1,2
        [100, 270], [340, 270], [460, 270], [700, 270],  // 索引3,4,5,6
        [160, 400], [400, 400],  // 索引7,8
        // 以下为10-14的扩展位置（可选）
        [560, 400], [700, 400], [60, 490], [220, 490], [340, 490],
    ];

    var NODE_RADIUS = 22;

    /* ═══════ 快速排序条形图布局 ═══════ */
    var BAR_CHART_X = 40;
    var BAR_CHART_Y = 40;
    var BAR_CHART_MAX_WIDTH = 720;
    var BAR_CHART_MAX_HEIGHT = 200;
    var BAR_MIN_HEIGHT = 20;

    /**
     * 初始化堆可视化（绘制静态的树形框架）
     * @param {number[]} arr 数组数据
     */
    function initHeap(arr) {
        currentAlgorithm = 'heap_create';
        clearSvg();

        var n = arr.length;
        var usedIndices = HEAP_POSITIONS.slice(0, n);

        // 绘制边（父节点 -> 子节点连接线）
        for (var i = 0; i < n; i++) {
            var leftChild = 2 * i + 1;
            var rightChild = 2 * i + 2;
            if (leftChild < n) drawEdge(usedIndices[i], usedIndices[leftChild]);
            if (rightChild < n) drawEdge(usedIndices[i], usedIndices[rightChild]);
        }

        // 绘制节点（圆形+数值文字）
        for (var i = 0; i < n; i++) {
            drawHeapNode(usedIndices[i], arr[i], i);
        }
    }

    /**
     * 初始化快速排序可视化（绘制条形图框架）
     * @param {number[]} arr 数组数据
     */
    function initQuickSort(arr) {
        currentAlgorithm = 'quicksort';
        clearSvg();

        var n = arr.length;
        if (n === 0) return;

        var barWidth = Math.min(BAR_CHART_MAX_WIDTH / n - 4, 50);
        var maxVal = Math.max.apply(null, arr.map(Math.abs)) || 1;
        var scaleY = BAR_CHART_MAX_HEIGHT / maxVal;

        // 绘制数值标签
        for (var i = 0; i < n; i++) {
            var x = BAR_CHART_X + i * (barWidth + 4);
            var barH = Math.max(BAR_MIN_HEIGHT, Math.abs(arr[i]) * scaleY);
            var y = BAR_CHART_Y + BAR_CHART_MAX_HEIGHT - barH;

            drawBar(x, y, barWidth, barH, arr[i], i, 'default');
        }
    }

    /**
     * 根据算法步骤数据更新可视化
     * @param {Object} step 后端推送的标准化步骤数据
     */
    function renderStep(step) {
        if (!step || step.type === 'completed' || step.status === 'completed') {
            animAllDone();
            return;
        }

        if (currentAlgorithm === 'heap_create') {
            renderHeapStep(step);
        } else if (currentAlgorithm === 'quicksort') {
            renderQuickSortStep(step);
        }
    }

    /**
     * 重置可视化：清空SVG，恢复初始状态
     */
    function reset() {
        currentAlgorithm = null;
        clearSvg();
    }

    /* ──────────── 堆渲染详细实现 ──────────── */

    function renderHeapStep(step) {
        var arr = step.array || [];
        var highlight = step.highlight || [];
        var compare = step.compare || [];
        var swap = step.swap;
        var n = arr.length;
        var positions = HEAP_POSITIONS.slice(0, n);

        // 清除旧节点（保留边）
        var oldNodes = svg.querySelectorAll('g.heap-node');
        oldNodes.forEach(function (g) { g.remove(); });

        // 重新绘制所有节点
        for (var i = 0; i < n; i++) {
            var color = 'default';
            if (highlight.indexOf(i) !== -1) color = 'highlight';
            else if (compare.indexOf(i) !== -1) color = 'compare';
            drawHeapNode(positions[i], arr[i], i, color);
        }

        // 交换动画：在交换的两个节点之间添加临时的动画指示
        if (swap && swap.length === 2) {
            var p1 = positions[swap[0]];
            var p2 = positions[swap[1]];
            drawSwapIndicator(p1, p2);
        }
    }

    function drawHeapNode(pos, value, index, color) {
        color = color || 'default';
        var col = COLORS[color + 'Fill'] || COLORS['defaultFill'];
        var strokeCol = COLORS[color + 'Stroke'] || COLORS['defaultStroke'];
        var group = document.createElementNS(svgNS, 'g');
        group.setAttribute('class', 'heap-node');
        group.setAttribute('data-index', index);
        group.setAttribute('transform', 'translate(' + pos[0] + ',' + pos[1] + ')');

        var circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('r', NODE_RADIUS);
        circle.setAttribute('fill', col);
        circle.setAttribute('stroke', strokeCol);
        circle.setAttribute('stroke-width', '2.5');
        circle.style.transition = 'fill 0.4s, stroke 0.4s';

        // 高亮节点添加脉冲动画
        if (color === 'highlight' || color === 'compare') {
            circle.style.animation = 'nodePulse 0.6s ease-in-out';
        }

        var text = document.createElementNS(svgNS, 'text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dy', '5');
        text.setAttribute('fill', COLORS.textFill);
        text.setAttribute('font-size', '13');
        text.setAttribute('font-weight', '600');
        text.textContent = value;

        group.appendChild(circle);
        group.appendChild(text);
        svg.appendChild(group);
    }

    function drawEdge(from, to) {
        var line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', from[0]);
        line.setAttribute('y1', from[1] + NODE_RADIUS);
        line.setAttribute('x2', to[0]);
        line.setAttribute('y2', to[1] - NODE_RADIUS);
        line.setAttribute('stroke', COLORS.edgeStroke);
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('class', 'heap-edge');
        svg.appendChild(line);
    }

    function drawSwapIndicator(p1, p2) {
        var line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', p1[0]);
        line.setAttribute('y1', p1[1]);
        line.setAttribute('x2', p2[0]);
        line.setAttribute('y2', p2[1]);
        line.setAttribute('stroke', COLORS.highlightStroke);
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-dasharray', '6,3');
        line.setAttribute('class', 'swap-indicator');
        line.style.animation = 'fadeIn 0.3s ease-out';
        svg.appendChild(line);

        // 0.8秒后自动移除
        setTimeout(function () {
            if (line.parentNode) line.parentNode.removeChild(line);
        }, 800);
    }

    /* ──────────── 快速排序渲染详细实现 ──────────── */

    function renderQuickSortStep(step) {
        var arr = step.array || [];
        var highlight = step.highlight || [];
        var compare = step.compare || [];
        var pivotIdx = step.pivot_idx;
        var leftPtr = step.left_ptr;
        var rightPtr = step.right_ptr;
        var swap = step.swap;
        var n = arr.length;
        if (n === 0) return;

        var barWidth = Math.min(BAR_CHART_MAX_WIDTH / n - 4, 50);
        var maxVal = Math.max.apply(null, arr.map(Math.abs)) || 1;
        var scaleY = BAR_CHART_MAX_HEIGHT / maxVal;

        // 清除旧元素
        clearSvg();

        // 重绘所有条形
        for (var i = 0; i < n; i++) {
            var x = BAR_CHART_X + i * (barWidth + 4);
            var barH = Math.max(BAR_MIN_HEIGHT, Math.abs(arr[i]) * scaleY);
            var y = BAR_CHART_Y + BAR_CHART_MAX_HEIGHT - barH;

            var color = 'default';
            if (pivotIdx === i) color = 'pivot';
            else if (highlight.indexOf(i) !== -1) color = 'highlight';
            else if (compare.indexOf(i) !== -1) color = 'compare';

            drawBar(x, y, barWidth, barH, arr[i], i, color);
        }

        // 绘制指针标记（left/right指针）
        if (leftPtr !== null && leftPtr !== undefined) {
            drawPointer(leftPtr, barWidth, 'L', COLORS.compareStroke, n);
        }
        if (rightPtr !== null && rightPtr !== undefined) {
            drawPointer(rightPtr, barWidth, 'R', COLORS.highlightStroke, n);
        }
    }

    function drawBar(x, y, w, h, value, index, color) {
        color = color || 'default';
        var fill = COLORS[color + 'Fill'] || COLORS['defaultFill'];
        var stroke = COLORS[color + 'Stroke'] || COLORS['defaultStroke'];

        var group = document.createElementNS(svgNS, 'g');

        var rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('rx', '3');
        rect.style.transition = 'fill 0.3s, x 0.4s, y 0.4s, height 0.4s';

        var text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', x + w / 2);
        text.setAttribute('y', y + h + 16);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', COLORS.textFill);
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '500');
        text.textContent = value;

        // 索引标签
        var idxText = document.createElementNS(svgNS, 'text');
        idxText.setAttribute('x', x + w / 2);
        idxText.setAttribute('y', y - 6);
        idxText.setAttribute('text-anchor', 'middle');
        idxText.setAttribute('fill', '#888');
        idxText.setAttribute('font-size', '10');
        idxText.textContent = index;

        group.appendChild(rect);
        group.appendChild(text);
        group.appendChild(idxText);
        svg.appendChild(group);
    }

    function drawPointer(index, barWidth, label, color, total) {
        var barW = Math.min(BAR_CHART_MAX_WIDTH / total - 4, 50);
        var x = BAR_CHART_X + index * (barW + 4) + barW / 2;
        var y = BAR_CHART_Y + BAR_CHART_MAX_HEIGHT + 10;

        var tri = document.createElementNS(svgNS, 'polygon');
        tri.setAttribute('points', (x - 8) + ',' + y + ' ' + (x + 8) + ',' + y + ' ' + x + ',' + (y + 12));
        tri.setAttribute('fill', color);

        var txt = document.createElementNS(svgNS, 'text');
        txt.setAttribute('x', x);
        txt.setAttribute('y', y + 26);
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('fill', color);
        txt.setAttribute('font-size', '11');
        txt.setAttribute('font-weight', '600');
        txt.textContent = label;

        svg.appendChild(tri);
        svg.appendChild(txt);
    }

    /* ──────────── 公共工具 ──────────── */

    function clearSvg() {
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
    }

    function animAllDone() {
        var nodes = svg.querySelectorAll('circle');
        nodes.forEach(function (c) {
            c.setAttribute('fill', COLORS.doneFill);
            c.setAttribute('stroke', COLORS.doneStroke);
        });
        var rects = svg.querySelectorAll('rect');
        rects.forEach(function (r) {
            r.setAttribute('fill', COLORS.doneFill);
            r.setAttribute('stroke', COLORS.doneStroke);
        });
    }

    return {
        initHeap: initHeap,
        initQuickSort: initQuickSort,
        renderStep: renderStep,
        reset: reset,
    };
})();
