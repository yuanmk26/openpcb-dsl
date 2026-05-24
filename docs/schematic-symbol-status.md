# Schematic Symbol 当前状态

本文档补充说明当前 schematic symbol 系统的实现状态，重点记录最近已经落地的 connector 绘图修正，以及下一步应优先推进的工作。

## 适用范围

当前说明覆盖以下链路：

- `CircuitIR -> SchematicIR`
- `SchematicIR -> tscircuit schematic circuit json`
- `circuit json -> SVG`

## 已经完成的修正

### 1. `connector_header_1x4` 已有独立几何模板

`connector_header_1x4` 不再只是最小占位符号。当前已经在 `SymbolSpec` 中定义了独立的几何参数，包括：

- body 尺寸
- pin 相对偏移
- `ref/value` 文本偏移

这意味着 connector 的本体大小、pin 间距和文字位置已经有稳定基线，不再完全依赖通用 fallback。

### 2. 单点 net label 会按 pin 朝向向外放置

对于只连接一个 pin 的 net，label 不再固定朝一个方向偏移，而是会根据 pin 所在边决定放置方向：

- pin 在左侧时，label 向左放
- pin 在右侧时，label 向右放
- pin 在上侧时，label 向上放
- pin 在下侧时，label 向下放

这样可以减少 net label 与 connector、本体符号或 pin stub 的重叠。

### 3. `schematic_port` 的几何语义已与下游对齐

此前 SVG 中出现过 pin 穿过元件本体的现象，根因是 `schematic_port.center` 与 `distance_from_component_edge` 的组合语义没有和下游渲染器对齐。

当前已经修正为：

- `schematic_port.center` 与引脚外端位置保持一致
- `distance_from_component_edge` 按符号 body 和 pin offset 推导

修正后，rect/box 类符号不会再因为导出语义错误而出现明显穿框。

## 当前仍然存在的限制

### 1. 常用器件库仍然不完整

虽然 `connector_header_1x4` 已经有专用模板，但整体上仍缺少一批常用 `SymbolSpec`：

- `connector_header_1xN`
- `connector_header_2xN`
- `resistor`
- `capacitor`
- `inductor`
- `diode`
- `led`
- `switch`

目前很多器件仍然会退化到 `generic_component` 或 `generic_ic`。

### 2. 通用器件仍主要依赖启发式 pin 布局

以下场景仍然主要依赖 `lower.ts` 中的启发式分配：

- 多 pin 通用器件左右拆分
- 没有专用 symbol 模板的 IC
- 没有专用 connector family 定义的器件

因此当前 schematic 输出已经具备“可显示、可导出、可验证”的基础，但还没有达到稳定的工程化原理图符号质量。

## 下一步建议

建议下一阶段优先做“常用器件符号库”而不是继续叠加单点修补。

优先级建议如下：

1. `connector_header_1xN` / `connector_header_2xN`
2. `resistor` / `capacitor` / `inductor`
3. `diode` / `led` / `switch`
4. `generic_ic_dual_side` 这类更稳定的通用模板

这样可以先把 schematic 的视觉基线和 pin 语义基线建立起来，再继续优化自动布局。

## 与现有文档的关系

仓库里已有以下相关文档：

- [symbol-system.md](./symbol-system.md)
- [tscircuit-mapping.md](./tscircuit-mapping.md)

其中部分描述写于 connector 几何修正之前，因此阅读时应以本文档的当前状态说明为准。
