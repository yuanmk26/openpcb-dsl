# tscircuit 映射

## 当前计划

当前阶段先把 `CircuitIR` / `SchematicIR` 映射到 tscircuit JSON，不再把 TSX 作为近期目标。

当前链路已经包括两类导出：

- `CircuitIR -> tscircuit schematic Circuit JSON`
- `CircuitIR -> SchematicIR -> tscircuit schematic Circuit JSON -> SVG`

其中，JSON 是结构化主产物，SVG 是方便人工查看的派生产物。

## 当前输出层次

当前第一版 schematic emitter 会输出一组最小可关联的 `source_* + schematic_*` 元素，包括：

- `source_project_metadata`
- `source_component`
- `source_port`
- `source_net`
- `source_trace`
- `schematic_component`
- `schematic_port`
- `schematic_trace`
- `schematic_net_label`

这样做的目标是先形成一条可检查、可测试、可导出 SVG 的完整链路，而不是一开始就追求最终的符号语义完整性。

## 当前已知问题

当前输出已经能生成 JSON 和 SVG，但仍存在一批结构性问题，需要在后续版本中专门解决。

### 1. 缺少正式的 component -> symbol 类型映射

目前还没有一套稳定的“OpenPCB 组件类型 / device 定义 -> 原理图符号类型”的正式机制。

当前实现仅对少数简单器件做了硬编码映射：

- `resistor` -> `boxresistor_right`
- `capacitor` -> `capacitor_right`
- 其余大多退化为通用 `box`

这意味着：

- 复杂器件符号不会按真实器件类别显示
- `device` 与 `component` 语义还没有真正进入符号层
- 当前图中很多器件只是占位方框，而不是目标原理图符号

### 2. `source_component.ftype` 仍是第一版保守映射

目前 emitter 对 tscircuit `source_component` 的 `ftype` 仅做了少量保守映射，例如：

- 电阻 -> `simple_resistor`
- 电容 -> `simple_capacitor`
- 其他 -> `simple_chip`

这使得：

- 输出能被下游消费
- 但器件类型语义仍然过粗
- 无法准确表达更丰富的符号选择和下游行为

### 3. pin 布局仍是启发式分配

当前 pin 锚点位置主要来自简单规则，而不是正式符号模板：

- 两脚器件按左右分配
- 多脚通用器件按左右拆分
- 并未依据真实符号定义、器件封装意图或已有符号库来布局

因此当前图中常见问题包括：

- 引脚顺序不够符合器件习惯
- 引脚分边不够符合真实符号
- MCU/IC 等复杂器件只是“通用引脚盒子”

### 4. pin direction / electrical type 仍不完整

虽然 `SchematicIR` 和 emitter 已经预留了 pin direction / electrical type 字段，但当前只有少量场景能准确带出。

这会影响：

- 原理图符号方向表达
- 后续符号优化
- 更严格的 schematic 规则校验

### 5. 当前 SVG 正确性更多是“链路级正确”，不是“符号级正确”

当前 SVG 导出成功说明以下链路已经打通：

- DSL 解析
- `CircuitIR` lowering
- `SchematicIR` lowering
- tscircuit schematic JSON emitter
- SVG 渲染

但这不等于“当前原理图已经具有稳定的工程符号质量”。目前更准确的状态是：

- 连接语义大体可见
- 结构化导出已经稳定
- 但器件符号和引脚布局仍是第一版占位实现

## 这些问题的根因

当前问题的根因不是单一 emitter bug，而是还缺少以下中间层能力：

- 正式的 `component/device -> symbolKind` 映射
- 正式的 `symbolKind -> tscircuit symbol_name / ftype` 映射
- 正式的符号 pin 布局模板
- 更清晰的器件类别与图形类别分离

也就是说，当前问题本质上属于“符号语义层尚未建立完成”，而不是单纯的 SVG 渲染错误。

## 当前结论

当前版本已经证明 OpenPCB 可以：

- 生成自己的 `SchematicIR`
- 将其导出为 tscircuit schematic Circuit JSON
- 再导出为可直接查看的 SVG

但当前图形结果仍应视为“第一版可视化验证输出”，而不是最终原理图质量目标。

后续工作的关键不是继续堆局部 emitter 细节，而是补齐：

1. `component/device -> symbolKind`
2. `symbolKind -> symbol template / pin layout`
3. `symbolKind -> tscircuit symbol_name / ftype`

只有这层建立起来，输出的图才会从“能看见连接”走向“符号正确、布局可信、可持续演进”。
