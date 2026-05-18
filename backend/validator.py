def validate_input(data, algorithm):
    if not isinstance(data, list):
        return False, "输入数据必须为数组格式（如 [1,2,3]）"

    if len(data) == 0:
        return False, "输入数组不能为空"

    for item in data:
        if not isinstance(item, int):
            return False, "数组元素必须全部为整数"

    if algorithm == "heap_create":
        if len(data) < 2:
            return False, "堆创建至少需要2个整数"
        if len(data) > 31:
            return False, "堆创建最多支持31个整数（便于可视化展示）"

    elif algorithm == "quicksort":
        if len(data) < 2:
            return False, "快速排序至少需要2个整数"
        if len(data) > 20:
            return False, "快速排序最多支持20个整数（便于可视化展示）"

    else:
        return False, f"不支持的算法类型：{algorithm}"

    return True, data
