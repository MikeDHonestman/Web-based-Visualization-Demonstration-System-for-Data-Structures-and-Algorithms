var Visualizer = (function () {
    'use strict';

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.getElementById('mainSvg');
    var currentAlgorithm = null;

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

    function getHeapPosition(index) {
        var level = Math.floor(Math.log2(index + 1));
        var firstInLevel = Math.pow(2, level) - 1;
        var posInLevel = index - firstInLevel;
        var nodesInLevel = Math.pow(2, level);
        var x = 800 * (posInLevel + 0.5) / nodesInLevel;
        var y = 38 + level * 104;
        return [x, y];
    }

    var NODE_RADIUS = 22;

    var BAR_CHART_X = 40;
    var BAR_CHART_Y = 40;
    var BAR_CHART_MAX_WIDTH = 720;
    var BAR_CHART_MAX_HEIGHT = 200;
    var BAR_MIN_HEIGHT = 20;

    function initHeap(arr) {
        currentAlgorithm = 'heap_create';
        clearSvg();

        var n = arr.length;

        for (var i = 0; i < n; i++) {
            var leftChild = 2 * i + 1;
            var rightChild = 2 * i + 2;
            if (leftChild < n) drawEdge(getHeapPosition(i), getHeapPosition(leftChild));
            if (rightChild < n) drawEdge(getHeapPosition(i), getHeapPosition(rightChild));
        }

        for (var i = 0; i < n; i++) {
            drawHeapNode(getHeapPosition(i), arr[i], i);
        }
    }

    function initQuickSort(arr) {
        currentAlgorithm = 'quicksort';
        clearSvg();

        var n = arr.length;
        if (n === 0) return;

        var barWidth = Math.min(BAR_CHART_MAX_WIDTH / n - 4, 50);
        var maxVal = Math.max.apply(null, arr.map(Math.abs)) || 1;
        var scaleY = BAR_CHART_MAX_HEIGHT / maxVal;

        for (var i = 0; i < n; i++) {
            var x = BAR_CHART_X + i * (barWidth + 4);
            var barH = Math.max(BAR_MIN_HEIGHT, Math.abs(arr[i]) * scaleY);
            var y = BAR_CHART_Y + BAR_CHART_MAX_HEIGHT - barH;

            drawBar(x, y, barWidth, barH, arr[i], i, 'default');
        }
    }

    function renderStep(step) {
        if (!step || step.type === 'completed') {
            animAllDone();
            return;
        }

        if (currentAlgorithm === 'heap_create') {
            renderHeapStep(step);
        } else if (currentAlgorithm === 'quicksort') {
            renderQuickSortStep(step);
        }
    }

    function reset() {
        currentAlgorithm = null;
        clearSvg();
    }

    function renderHeapStep(step) {
        var arr = step.array || [];
        var highlight = step.highlight || [];
        var compare = step.compare || [];
        var swap = step.swap;
        var n = arr.length;

        var oldNodes = svg.querySelectorAll('g.heap-node');
        oldNodes.forEach(function (g) { g.remove(); });

        for (var i = 0; i < n; i++) {
            var color = 'default';
            if (highlight.indexOf(i) !== -1) color = 'highlight';
            else if (compare.indexOf(i) !== -1) color = 'compare';
            drawHeapNode(getHeapPosition(i), arr[i], i, color);
        }

        if (swap && swap.length === 2) {
            var p1 = getHeapPosition(swap[0]);
            var p2 = getHeapPosition(swap[1]);
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

        setTimeout(function () {
            if (line.parentNode) line.parentNode.removeChild(line);
        }, 800);
    }

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

        clearSvg();

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
