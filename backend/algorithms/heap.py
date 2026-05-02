"""
堆创建算法步骤拆解模块 (heap.py)
职责：将"建堆"过程拆解为可被前端渲染的标准化步骤数据，
      记录每一步的比较、交换操作，返回步骤数据列表。

建堆原理：
  从最后一个非叶子节点（索引 n//2 - 1）开始，逐一对每个非叶子节点
  执行"下沉"（sift-down）操作，最终将无序数组转换为最大堆。
"""

import copy


def build_heap_steps(arr):
    """
    生成建堆过程的步骤数据列表
    :param arr: 原始整数数组
    :return: list[dict] 标准化步骤数据
    """
    steps = []
    arr = copy.deepcopy(arr)
    n = len(arr)

    # 记录初始状态
    steps.append({
        "step_id": len(steps),
        "algorithm": "heap_create",
        "description": f"初始数组: [{', '.join(map(str, arr))}]，共{n}个元素，开始建堆",
        "array": arr.copy(),
        "highlight": [],
        "compare": [],
        "swap": None,
        "status": "running"
    })

    step_counter = [1]

    # 从最后一个非叶子节点开始，向上到根节点
    start = n // 2 - 1
    for i in range(start, -1, -1):
        _sift_down_with_steps(arr, n, i, steps, step_counter)

    # 记录完成状态
    steps.append({
        "step_id": len(steps),
        "algorithm": "heap_create",
        "description": f"堆创建完成！最终堆: [{', '.join(map(str, arr))}]",
        "array": arr.copy(),
        "highlight": [],
        "compare": [],
        "swap": None,
        "status": "completed"
    })

    # 回填 total_steps
    for s in steps:
        s["total_steps"] = len(steps)

    return steps


def _sift_down_with_steps(arr, heap_size, root, steps, step_counter):
    """
    对以root为根的子树执行下沉操作，并记录每一步的详细数据
    :param arr: 当前数组（原地修改）
    :param heap_size: 堆的有效大小
    :param root: 当前根节点索引
    :param steps: 步骤数据列表（累积）
    :param step_counter: 步骤计数器（可变，用于step_id）
    """
    largest = root
    left = 2 * root + 1
    right = 2 * root + 2

    # 记录：开始调整当前节点
    steps.append({
        "step_id": len(steps),
        "algorithm": "heap_create",
        "description": f"开始调整节点{root}（值={arr[root]}），检查是否需要下沉",
        "array": arr.copy(),
        "highlight": [root],
        "compare": [],
        "swap": None,
        "status": "running"
    })

    # 与左子节点比较
    if left < heap_size:
        steps.append({
            "step_id": len(steps),
            "algorithm": "heap_create",
            "description": f"比较节点{root}（值={arr[root]}）与左子节点{left}（值={arr[left]}）",
            "array": arr.copy(),
            "highlight": [root],
            "compare": [left],
            "swap": None,
            "status": "running"
        })
        if arr[left] > arr[largest]:
            largest = left

    # 与右子节点比较
    if right < heap_size:
        steps.append({
            "step_id": len(steps),
            "algorithm": "heap_create",
            "description": f"比较节点{root}（值={arr[root]}）与右子节点{right}（值={arr[right]}）",
            "array": arr.copy(),
            "highlight": [root],
            "compare": [right],
            "swap": None,
            "status": "running"
        })
        if arr[right] > arr[largest]:
            largest = right

    # 如果最大不是根，则交换，并继续下沉
    if largest != root:
        steps.append({
            "step_id": len(steps),
            "algorithm": "heap_create",
            "description": f"交换节点{root}（值={arr[root]}）与节点{largest}（值={arr[largest]}）",
            "array": arr.copy(),
            "highlight": [root],
            "compare": [largest],
            "swap": [root, largest],
            "status": "running"
        })
        arr[root], arr[largest] = arr[largest], arr[root]
        _sift_down_with_steps(arr, heap_size, largest, steps, step_counter)
    else:
        # 不需要下沉
        steps.append({
            "step_id": len(steps),
            "algorithm": "heap_create",
            "description": f"节点{root}已满足堆性质，无需下沉",
            "array": arr.copy(),
            "highlight": [root],
            "compare": [],
            "swap": None,
            "status": "running"
        })
