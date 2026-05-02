"""
快速排序算法步骤拆解模块 (quicksort.py)
职责：将快速排序的执行过程拆解为可被前端渲染的标准化步骤数据，
      记录每一次分区、比较、交换操作，返回步骤数据列表。

算法：使用Lomuto分区方案，选择最右侧元素为pivot。
"""

import copy


def quicksort_steps(arr):
    """
    生成快速排序过程的步骤数据列表
    :param arr: 原始整数数组
    :return: list[dict] 标准化步骤数据
    """
    steps = []
    arr = copy.deepcopy(arr)
    n = len(arr)

    # 记录初始状态
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

    # 记录完成状态
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

    # 回填 total_steps
    for s in steps:
        s["total_steps"] = len(steps)

    return steps


def _quicksort_recursive(arr, low, high, steps):
    """
    递归执行快速排序并记录步骤
    :param arr: 当前数组（原地修改）
    :param low: 子数组起始索引
    :param high: 子数组结束索引
    :param steps: 步骤数据列表（累积）
    """
    if low < high:
        # 记录：开始处理当前区间
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

        # Lomuto分区
        pivot_idx = _partition(arr, low, high, steps)

        # 递归排序左半部分
        _quicksort_recursive(arr, low, pivot_idx - 1, steps)

        # 递归排序右半部分
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
    """
    Lomuto分区：以arr[high]为pivot，将小于pivot的元素移到左侧
    :param arr: 数组（原地修改）
    :param low: 起始索引
    :param high: 结束索引（pivot所在位置）
    :param steps: 步骤数据列表
    :return: pivot最终位置
    """
    pivot = arr[high]
    i = low - 1

    for j in range(low, high):
        # 记录：比较 arr[j] 与 pivot
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
                # 记录：交换 arr[i] 与 arr[j]
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

    # 将pivot放到正确位置
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
