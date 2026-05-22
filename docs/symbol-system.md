# Symbol 体系设计

## 目标

当前 OpenPCB 的原理图输出已经不再只是“把元件和网络导出出去”，而是开始建立自己的 symbol 语义层。

这套设计的目标是：

- 在 OpenPCB 内部稳定表达“一个元件应该画成什么符号”
- 将符号语义与具体后端渲染解耦
- 第一阶段先复用 `tscircuit` / `circuit-to-svg` 的现有能力
- 后续逐步收敛到仓库内可维护的 symbol 定义文件

当前采用的是“混合方案”：

- OpenPCB 维护自己的 `symbolKind`
- OpenPCB 维护自己的 `SymbolSpec`
- emitter 负责把 `SymbolSpec` 映射到 `tscircuit schematic Circuit JSON`
- 对可复用的后端 symbol 继续复用
- 对没有合适后端 symbol 的矩形类元件，直接输出 `box with pins` 与附加 primitive

## 当前分层

### 1. `CircuitIR`

`CircuitIR` 负责表达：

- 元件实例
- `component / package / device` 定义层事实
- 电气连接关系

它不直接承担“该画成什么符号”的职责。

### 2. `symbolKind`

`symbolKind` 是 OpenPCB 内部的符号语义名，不等于下游 symbol 名。

当前已经引入的类型包括：

- `passive_resistor`
- `passive_capacitor`
- `connector_header_1x4`
- `connector_header_2x4`
- `generic_ic`
- `generic_component`

这层的职责是回答：

- 这是电阻、电容、连接器，还是通用 IC
- 它应该落到哪类符号，而不是直接落到哪个 SVG 或哪个 `tscircuit symbol_name`

### 3. `SymbolSpec`

`SymbolSpec` 是 OpenPCB 自己的符号定义层。当前第一阶段先用代码注册表承载。

它至少包含：

- `id`
- `kind`
- `body`
- `pins`
- `labels`
- `backendMappings`

其中：

- `body` 表达符号主体尺寸与基础形态
- `pins` 表达 pin 的 side、offset、direction、电气类型
- `labels` 表达 `ref` / `value` 的文字锚点
- `backendMappings` 表达后端适配信息

### 4. emitter 层

当前 emitter 分两类处理：

1. 对已有合适外部 symbol 的器件：
   - 继续使用 `symbol_name`
   - 例如电阻、电容

2. 对没有合适外部 symbol、但可由矩形盒体表达的器件：
   - 不再伪造 `symbol_name`
   - 直接输出 `schematic_component.is_box_with_pins`
   - 同时输出 `schematic_text`
   - 让 `circuit-to-svg` 按 box-with-pins 路径绘制

这条路径已经用于：

- `connector_header_1x4`
- `generic_ic`
- `generic_component`

## 当前数据流

当前实现的数据流如下：

`ComponentIR -> inferSymbolKind() -> resolveSymbolSpec() -> SchematicSymbolInstance -> emitTscircuitSchematicCircuitJson()`

具体步骤：

1. 在 lowering 阶段，根据 `ComponentIR` 推导 `symbolKind`
2. 根据 `symbolKind` 查找 `SymbolSpec`
3. 根据 `SymbolSpec.pins` 生成 `SchematicPinAnchor`
4. 将 `symbolSpecId` 回填到 `SchematicSymbolInstance`
5. emitter 读取 `SymbolSpec`
6. 如果 `body.shape` 是矩形类，则输出 box-with-pins
7. 如果存在合适的 `backendMappings.tscircuit.symbolName`，则输出对应 symbol

## 当前实现形态

### 1. 代码注册表

当前 `SymbolSpec` 放在：

- `src/schematic/symbol-registry.ts`

这是第一阶段的折中方案，目的不是长期把 symbol 写死在代码里，而是先稳定接口与数据边界。

### 2. resolver

当前 symbol 解析入口在：

- `src/schematic/symbol-resolver.ts`

它负责：

- `inferSymbolKind(component)`
- `resolveSymbolSpec(symbolKind, component)`
- `mapSymbolSpecToTscircuit(spec)`

### 3. `SchematicIR` 扩展

当前 `SchematicSymbolInstance` 已经增加：

- `symbolSpecId`

这意味着 emitter 不需要再重新猜一次 symbol 规则，而是可以直接消费 lowering 阶段已经解析好的符号定义。

### 4. 示例验证

当前已经有首个完整 symbol 示例：

- `examples/dsl/connector-header-1x4.opcb`

这个示例验证了：

- `component/device -> symbolKind`
- `symbolKind -> SymbolSpec`
- `SymbolSpec -> pin layout`
- `SymbolSpec -> schematic JSON / SVG`

## 当前已知限制

虽然 symbol 机制已经落地，但当前仍处于第一阶段，实现上还有明显保守之处。

### 1. `SymbolSpec` 仍是代码内置

当前 `SymbolSpec` 还没有迁移到仓库内 symbol 文件。

这意味着：

- 新增 symbol 仍需要改 TypeScript
- 还没有统一的 symbol schema 校验
- 还没有 symbol 资产目录与加载机制

### 2. `symbolKind` 覆盖范围仍然很小

当前只有少量类型进入了正式 symbol 管道：

- 电阻
- 电容
- `connector_header_1x4`
- 一些保底类型

复杂器件目前仍大量落入：

- `generic_ic`
- `generic_component`

### 3. 矩形类 symbol 仍然比较粗糙

当前矩形类 symbol 的绘制能力本质上还是：

- 一个 box
- 一组 pins
- `ref/value` 文本

它还不支持：

- 自定义图形 path
- 多单元器件
- 更复杂的引脚分组与分区
- 器件内部功能标识
- 精细的图形风格控制

### 4. `connector_header_1x4` 只是最小验证，不是最终连接器规范

当前这个 header 示例主要用于验证 symbol 管道本身。

还没有解决：

- `1xN` / `2xN` family 自动化
- 公母、卧式、双排等变体
- pin header 与 connector 在语义上的细分
- pin numbering 与方向规范的统一策略

### 5. `ref/value` 文本布局仍然比较初级

当前 `labels` 已经进入 `SymbolSpec`，但文字布局仍然只有最小锚点能力。

还没有解决：

- 不同 shape 的默认文字策略
- 文本与 pin/label 冲突规避
- 旋转后文字方向与可读性策略
- 多行值文本和长文本截断策略

### 6. emitter 仍然带有过渡期 fallback

当前 emitter 为了兼容旧示例，仍保留了少量 fallback 逻辑。

这意味着：

- symbol 体系尚未完全成为唯一入口
- 某些默认行为仍然混在 emitter 内
- 后续还需要继续压缩 emitter 内的“猜测式逻辑”

## 后续优先优化项

建议按下面顺序继续推进。

### 1. 文件化 `SymbolSpec`

优先级最高。

目标：

- 新增 `symbols/` 目录
- 将代码注册表逐步迁移到 JSON 文件
- 保持 `resolveSymbolSpec()` 作为统一入口

这样可以把“符号资产”和“编译逻辑”正式拆开。

### 2. 扩大 `symbolKind` 覆盖面

建议下一批补齐：

- `test_point`
- `power_symbol`
- `connector_header_2x4`
- `opamp_single`
- 更稳定的 `generic_ic` pin 分布策略

### 3. 引入更丰富的矩形类 primitive

当前矩形类器件已经能正确画出 box-with-pins，但还不够表达更多工程符号。

建议逐步支持：

- `schematic_rect`
- `schematic_line`
- `schematic_circle`
- `schematic_path`

并让这些 primitive 从 `SymbolSpec.body` / `SymbolSpec.primitives` 中导出。

### 4. 将 pin layout 从“静态定义”推进到“模板化定义”

当前 `pins` 是静态坐标。

后续可考虑：

- 支持按 pin count 自动展开
- 支持 side 内排序策略
- 支持 group / section 概念
- 支持同一 `symbolKind` 的多个 layout variant

### 5. 收敛 emitter fallback

长期目标应是：

- emitter 不再负责猜测 symbol
- emitter 只负责消费 resolved `SymbolSpec`
- 所有元件图形决策都在 symbol 解析层完成

## 当前结论

目前这套 symbol 设计已经完成了第一阶段最关键的一步：

- OpenPCB 已经开始拥有自己的 symbol 语义层
- 不再完全依赖下游 symbol 名称来描述元件
- 对没有现成下游 symbol 的矩形类器件，已经可以按 OpenPCB 自己的 `SymbolSpec` 正确绘制

但它仍然只是第一阶段。

当前最重要的后续工作不是继续堆更多 ad-hoc symbol 映射，而是：

1. 文件化 `SymbolSpec`
2. 扩大 `symbolKind` 覆盖
3. 提升矩形类 symbol 的 primitive 表达能力
4. 继续把 emitter 变成纯适配层
