# SchematicIR 设计

## 目标

`SchematicIR` 是 `CircuitIR` 之后的一层中间表示，用来承接 OpenPCB 自己的原理图表达语义。

目标链路为：

`OpenPCB DSL -> ProgramAst -> CircuitIR -> SchematicIR -> 后端 emitter`

其中：

- `CircuitIR` 负责表达电气连接事实、定义层事实与设计意图
- `SchematicIR` 负责表达原理图中的符号、连线、标签、分组与布局结果
- 后端 emitter 负责把 `SchematicIR` 转换为具体目标格式，例如 tscircuit 的 `schematic_*` 元素

引入这一层的核心目的不是增加一个额外抽象，而是把“原理图怎么画”这件事收回到 OpenPCB 自己的编译链路中，而不是依赖下游库决定。

## 为什么不直接输出 tscircuit schematic 元素

如果直接从 `CircuitIR` 输出到 tscircuit 的 `schematic_*` 元素，会出现两个问题：

- OpenPCB 自己的原理图语义会与某个后端格式耦合
- 后续如果替换 tscircuit，或同时支持多个原理图后端，迁移成本会很高

`SchematicIR` 的作用就是把“原理图语义”与“后端格式”分离开：

- `CircuitIR -> SchematicIR` 由 OpenPCB 控制
- `SchematicIR -> tscircuit schematic` 只是一个可替换 emitter

这样后续即使不再依赖 tscircuit，也只需要替换最后一段导出逻辑。

## 设计原则

### 1. 保持为 OpenPCB 自己的抽象

`SchematicIR` 应表达 OpenPCB 自己关心的原理图事实，例如：

- 元件符号实例
- 引脚锚点
- 网络在图上的表达方式
- 连线几何
- 标签与端口
- 分组与页面

它不应只是把 tscircuit 的字段换一个名字重新包一层。

### 2. 区分电气事实与图形事实

`CircuitIR` 中的一个 `net` 不一定在原理图上表现为一根连续导线。它可能被表达为：

- 一段或多段导线
- 一个或多个 net label
- 电源符号
- 端口符号
- 后续扩展中的 bus / diff pair 标记

因此 `SchematicIR` 应表达“图上怎么表示”，而不是简单复制“电气上怎么连接”。

### 3. 布局结果进入 IR，布局算法不进入 IR

`SchematicIR` 中可以保存元件坐标、朝向、线段路径等布局结果，但不应把完整布局算法本身编码进 IR。

可选地保留少量决策来源元数据，例如：

- `placementSource: "manual" | "auto" | "template"`
- `routingStyle: "direct" | "orthogonal" | "label-only"`

但这些字段只是帮助追踪决策来源，不应成为后端 emitter 的强耦合前提。

### 4. 先做最小可用集合

第一阶段不追求覆盖复杂原理图语义，而是先覆盖最基础的单页原理图表达：

- 符号实例
- 引脚锚点
- 直连或正交导线
- net label
- junction

后续再扩展：

- 电源地符号
- 层级页
- bus
- diff pair 图形语义
- 自动布局策略

## 与 tscircuit 的关系

tscircuit 的 `circuit-json` 将 `source_*`、`schematic_*`、`pcb_*` 等层分开建模，这一点值得参考。

参考资料：

- [circuit-json 仓库](https://github.com/tscircuit/circuit-json)
- [tscircuit 文档](https://docs.tscircuit.com/)

但 `SchematicIR` 不应直接等同于 tscircuit 的 `schematic_*` 元素集合。更合理的关系是：

- `SchematicIR` 表达 OpenPCB 的原理图语义
- tscircuit emitter 再把这些语义转换为 `schematic_component`、`schematic_port`、`schematic_trace`、`schematic_net_label` 等具体元素

## 分层建议

为了避免把“逻辑原理图语义”和“最终图形坐标”混在一起，建议在概念上区分两个阶段：

- `LogicalSchematic`
- `PlacedSchematic`

第一阶段可以仍然放在同一个 `SchematicIR` 模块中实现，但设计上要保留这两个层次：

### `LogicalSchematic`

负责表达：

- 需要出现在图上的符号
- 每个符号暴露的引脚
- 网络在图上的表示策略
- 组件分组关系

它不要求一开始就有完整绝对坐标。

### `PlacedSchematic`

负责表达：

- 元件坐标
- 朝向
- 引脚锚点位置
- 线段路径
- 标签位置

这是后端 emitter 真正消费的布局结果层。

## 核心实体建议

以下是第一版建议保留的最小核心实体。

### `SchematicDocument`

表示一份原理图文档。

```ts
interface SchematicDocument {
  id: string;
  title?: string;
  sheets: SchematicSheet[];
  metadata?: Record<string, string>;
}
```

### `SchematicSheet`

表示单个图纸页面。

```ts
interface SchematicSheet {
  id: string;
  name: string;
  items: SchematicItem[];
  frame?: SchematicFrame;
}
```

第一阶段默认单页即可，但结构上预留多页能力。

### `SchematicSymbolInstance`

表示一个出现在图上的符号实例。

```ts
interface SchematicSymbolInstance {
  kind: "symbol";
  id: string;
  sourceRef: string;
  symbolKind: string;
  position?: Point;
  rotation?: number;
  pins: SchematicPinAnchor[];
  labels?: SchematicTextLabel[];
  properties?: Record<string, string>;
  placementSource?: "manual" | "auto" | "template";
}
```

说明：

- `sourceRef` 用于回溯到 `CircuitIR` 中的组件实例，例如 `U1`、`R1`
- `symbolKind` 表示 OpenPCB 自己的符号类型，例如 `resistor`、`capacitor`、`generic_ic`
- `position` 与 `rotation` 表示布局结果

### `SchematicPinAnchor`

表示符号上一个可连接的引脚锚点。

```ts
interface SchematicPinAnchor {
  id: string;
  name: string;
  direction?: "input" | "output" | "bidirectional" | "passive" | "power";
  side?: "left" | "right" | "top" | "bottom";
  offset?: Point;
  electricalType?: string;
}
```

说明：

- `offset` 表示相对于符号原点的位置
- `side` 便于符号布局和自动走线
- `direction` 可用于后续图形规则或检查

### `SchematicWire`

表示图上的一段或多段导线。

```ts
interface SchematicWire {
  kind: "wire";
  id: string;
  netName: string;
  points: Point[];
  routingStyle?: "direct" | "orthogonal";
}
```

说明：

- `points` 至少为两个点
- 同一个 `net` 可以拆成多条 `wire`

### `SchematicNetLabel`

表示网络标签。

```ts
interface SchematicNetLabel {
  kind: "net_label";
  id: string;
  netName: string;
  position: Point;
  orientation?: "left" | "right" | "up" | "down";
}
```

说明：

- `net label` 是网络连接的一种图形表达，不只是装饰文本
- 同一网络可以在多处出现多个 label

### `SchematicJunction`

表示导线连接节点。

```ts
interface SchematicJunction {
  kind: "junction";
  id: string;
  position: Point;
}
```

### `SchematicPort`

表示页内或页间连接端口，也可扩展为外部接口表达。

```ts
interface SchematicPort {
  kind: "port";
  id: string;
  name: string;
  portType?: string;
  position: Point;
  orientation?: "left" | "right" | "up" | "down";
}
```

### `SchematicGroup`

表示一组图元或逻辑模块。

```ts
interface SchematicGroup {
  kind: "group";
  id: string;
  name: string;
  itemIds: string[];
}
```

### 共享类型

```ts
interface Point {
  x: number;
  y: number;
}

interface SchematicFrame {
  width: number;
  height: number;
  title?: string;
}

interface SchematicTextLabel {
  text: string;
  position?: Point;
}

type SchematicItem =
  | SchematicSymbolInstance
  | SchematicWire
  | SchematicNetLabel
  | SchematicJunction
  | SchematicPort
  | SchematicGroup;
```

## 与 CircuitIR 的映射建议

第一阶段建议采用“先逻辑展开，再布局”的映射方式：

`CircuitIR -> LogicalSchematic -> PlacedSchematic`

### `ComponentIR -> SchematicSymbolInstance`

`CircuitIR.components` 中的组件实例映射为图上的符号实例。

建议规则：

- `ref` -> `sourceRef`
- `type` / `component` / `device` 决定 `symbolKind`
- `value` / `params` 进入 `properties`
- vNext `inst` 和 legacy inline 元件都统一落到 `symbol`

### `ComponentDefIR` / `DeviceDefIR` -> `SchematicPinAnchor`

引脚锚点来源优先级建议如下：

1. 如果组件实例关联到 `componentDefs`
   使用定义层 pin 名称生成 `pins`
2. 如果只有 legacy 元件且无定义层 pin
   使用约定 pin 名生成 `pins`
3. 如果未来引入符号库
   允许从符号模板中覆写锚点布局

### `NetIR -> SchematicWire` / `SchematicNetLabel`

`NetIR` 不应直接等价为单个图元，而是映射为一组网络表达。

建议规则：

- 对简单两端连接，可直接生成一条 `wire`
- 对跨区域连接，可拆成多条 `wire` 并辅以 `net_label`
- 对高频复用网络，可优先用 `net_label` 表达

也就是说，网络在 `SchematicIR` 中的表现是一种“绘图策略结果”，而不是单一实体。

### `PatternIR` -> 图形增强或布局约束

`PatternIR` 第一阶段不必直接生成独立图元，但可影响：

- 元件摆放相对关系
- 连线优先方向
- 标签命名或分组

例如：

- `series` 可提示两个元件在线性方向上相邻摆放
- `decouple` 可提示电容靠近主器件相关电源脚
- `bridge` 可作为后续差分桥接或端点语义的布局提示

### `DiffPairIR` -> 后续扩展点

`DiffPairIR` 第一阶段可先不生成专门图形元素，但应作为 `SchematicIR` 扩展点保留：

- 差分对成组信息
- `P/N` 网络成对布局提示
- `endpoint ... near ...` 对应的相对位置约束

后续可扩展为：

- 差分对标注
- 双线对称布局
- 成组端口表达

## 第一阶段建议支持范围

为了尽快形成可验证链路，第一阶段建议只支持以下能力：

- 单页原理图
- 通用符号实例
- 基础引脚锚点
- 正交导线
- net label
- junction
- 基础元件属性显示

暂不纳入第一阶段：

- 层级原理图
- 多页跨页连接
- bus
- 差分对专用图形语义
- 复杂自动布局
- 与具体渲染器强耦合的样式参数

## 与后端 emitter 的接口建议

推荐把 `SchematicIR` 作为后端 emitter 的唯一输入，而不是让 emitter 再回头读取 `CircuitIR`。

理想接口形态：

```ts
function emitTscircuitSchematic(schematic: SchematicDocument): unknown
```

这样可以保证：

- 原理图语义只在 `CircuitIR -> SchematicIR` 一处决定
- 任意后端共享同一份原理图事实层
- 后端差异只体现在导出阶段

## 最小验证路径

建议用 `examples/dsl/simple-pin-ops.opcb` 作为第一批验证样例，验证以下链路：

1. `compileOpenPcbDslFile()` 生成 `CircuitIR`
2. `CircuitIR` lowering 为 `SchematicIR`
3. `SchematicIR` 导出为目标后端格式
4. 使用快照或渲染结果验证图形语义是否符合预期

第一阶段的成功标准不是“布局已经很美观”，而是：

- 图上出现正确的符号实例
- 关键网络被正确表示
- 连接语义与 `CircuitIR` 一致
- 导出结构不依赖 tscircuit 反向补全核心原理图决策

## 后续演进方向

后续可按以下顺序扩展：

1. 建立 `src/schematic/` 模块与类型定义
2. 实现 `CircuitIR -> SchematicIR` 的最小 lowering
3. 增加 `SchematicIR` 快照测试
4. 实现 `SchematicIR -> tscircuit schematic` emitter
5. 引入基础自动布局策略
6. 逐步支持 diff pair、bus、sheet hierarchy 等高级语义

## 当前结论

`SchematicIR` 应被视为 OpenPCB 自己的原理图事实层，而不是 tscircuit schema 的别名。

只要这层抽象保持独立，后续无论是继续使用 tscircuit，还是替换为自研渲染器或其他后端，迁移成本都会显著降低。
