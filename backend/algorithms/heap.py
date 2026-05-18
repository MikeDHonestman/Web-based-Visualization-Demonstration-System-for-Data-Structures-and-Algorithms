import copy


def build_heap_steps(arr):
    steps = []
    arr = copy.deepcopy(arr)
    n = len(arr)

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

    start = n // 2 - 1
    for i in range(start, -1, -1):
        _sift_down_with_steps(arr, n, i, steps, step_counter)

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

    for s in steps:
        s["total_steps"] = len(steps)

    return steps


def _sift_down_with_steps(arr, heap_size, root, steps, step_counter):
    largest = root
    left = 2 * root + 1
    right = 2 * root + 2

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
