import copy


def quicksort_steps(arr):
    steps = []
    arr = copy.deepcopy(arr)
    n = len(arr)

    steps.append({
        "step_id": len(steps),
        "algorithm": "quicksort",
        "description": f"初始数组: [{', '.join(map(str, arr))}]，开始快速排序",
        "array": arr.copy(),
        "highlight": [],
        "compare": [],
        "pivot_idx": None,
        "left_ptr": None,
        "right_ptr": None,
        "swap": None,
        "status": "running"
    })

    _quicksort_recursive(arr, 0, n - 1, steps)

    steps.append({
        "step_id": len(steps),
        "algorithm": "quicksort",
        "description": f"排序完成！最终结果: [{', '.join(map(str, arr))}]",
        "array": arr.copy(),
        "highlight": [],
        "compare": [],
        "pivot_idx": None,
        "left_ptr": None,
        "right_ptr": None,
        "swap": None,
        "status": "completed"
    })

    for s in steps:
        s["total_steps"] = len(steps)

    return steps


def _quicksort_recursive(arr, low, high, steps):
    if low < high:
        sub_arr = arr[low:high + 1]
        steps.append({
            "step_id": len(steps),
            "algorithm": "quicksort",
            "description": f"处理区间[{low}..{high}]: [{', '.join(map(str, sub_arr))}]，选择pivot={arr[high]}",
            "array": arr.copy(),
            "highlight": list(range(low, high + 1)),
            "compare": [],
            "pivot_idx": high,
            "left_ptr": None,
            "right_ptr": None,
            "swap": None,
            "status": "running"
        })

        pivot_idx = _partition(arr, low, high, steps)
        _quicksort_recursive(arr, low, pivot_idx - 1, steps)
        _quicksort_recursive(arr, pivot_idx + 1, high, steps)
    elif low == high:
        steps.append({
            "step_id": len(steps),
            "algorithm": "quicksort",
            "description": f"区间[{low}..{high}]只有一个元素（值={arr[low]}），已就位",
            "array": arr.copy(),
            "highlight": [low],
            "compare": [],
            "pivot_idx": None,
            "left_ptr": None,
            "right_ptr": None,
            "swap": None,
            "status": "running"
        })


def _partition(arr, low, high, steps):
    pivot = arr[high]
    i = low - 1

    for j in range(low, high):
        steps.append({
            "step_id": len(steps),
            "algorithm": "quicksort",
            "description": f"比较arr[{j}]={arr[j]} 与 pivot={pivot}：{'≤' if arr[j] <= pivot else '>'} pivot",
            "array": arr.copy(),
            "highlight": [j],
            "compare": [high],
            "pivot_idx": high,
            "left_ptr": max(0, i),
            "right_ptr": j,
            "swap": None,
            "status": "running"
        })

        if arr[j] <= pivot:
            i += 1
            if i != j:
                steps.append({
                    "step_id": len(steps),
                    "algorithm": "quicksort",
                    "description": f"arr[{j}]={arr[j]} ≤ pivot，交换arr[{i}]={arr[i]}与arr[{j}]={arr[j]}",
                    "array": arr.copy(),
                    "highlight": [],
                    "compare": [],
                    "pivot_idx": high,
                    "left_ptr": i,
                    "right_ptr": j,
                    "swap": [i, j],
                    "status": "running"
                })
                arr[i], arr[j] = arr[j], arr[i]
            else:
                steps.append({
                    "step_id": len(steps),
                    "algorithm": "quicksort",
                    "description": f"arr[{j}]={arr[j]} ≤ pivot，i和j重合，无需交换",
                    "array": arr.copy(),
                    "highlight": [i],
                    "compare": [],
                    "pivot_idx": high,
                    "left_ptr": i,
                    "right_ptr": j,
                    "swap": None,
                    "status": "running"
                })

    pivot_final = i + 1
    if pivot_final != high:
        steps.append({
            "step_id": len(steps),
            "algorithm": "quicksort",
            "description": f"分区完成，将pivot={pivot}放到正确位置，交换arr[{pivot_final}]与arr[{high}]",
            "array": arr.copy(),
            "highlight": [],
            "compare": [],
            "pivot_idx": high,
            "left_ptr": None,
            "right_ptr": None,
            "swap": [pivot_final, high],
            "status": "running"
        })
        arr[pivot_final], arr[high] = arr[high], arr[pivot_final]
    else:
        steps.append({
            "step_id": len(steps),
            "algorithm": "quicksort",
            "description": f"分区完成，pivot={pivot}已在正确位置（索引{pivot_final}）",
            "array": arr.copy(),
            "highlight": [pivot_final],
            "compare": [],
            "pivot_idx": pivot_final,
            "left_ptr": None,
            "right_ptr": None,
            "swap": None,
            "status": "running"
        })

    return pivot_final
