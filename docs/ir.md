# IR 设计

## 目的

`CircuitIR` 是 AST lowering 后的规范化语义表示。

它同时保留两类信息：

- 定义层事实：`componentDefs / packageDefs / deviceDefs`
- 设计层事实：`components / nets / patterns / diffPairs / constraints`

这样既能承接 vNext 定义层，也不会丢掉下游更依赖的 netlist / pattern 视角。

## 顶层结构

```ts
interface CircuitIR {
  componentDefs: Record<string, ComponentDefIR>;
  packageDefs: Record<string, PackageDefIR>;
  deviceDefs: Record<string, DeviceDefIR>;
  components: Record<string, ComponentIR>;
  nets: Record<string, NetIR>;
  patterns: PatternIR[];
  diffPairs: Record<string, DiffPairIR>;
  constraints: ConstraintIR[];
}
```

## 定义层 IR

### `ComponentDefIR`

表示抽象电气接口定义。

- `name`
- `pins`
- `groups?`
- `attrs?`

### `PackageDefIR`

表示物理 pad 集合。

- `name`
- `pads`

### `DeviceDefIR`

表示可实例化具体器件。

- `name`
- `component`
- `package`
- `attrs?`
- `pinmap`

## `ComponentIR`

表示电路中的一个实例或内联辅助元件。

```ts
interface ComponentIR {
  ref: string;
  type: string;
  value?: string;
  footprint?: string;
  params?: Record<string, string>;
  device?: string;
  component?: string;
  package?: string;
  attrs?: Record<string, string>;
}
```

### lowering 规则

#### legacy 实例

`U1 MCU(...)` 会继续降级为：

- `ref = "U1"`
- `type = "MCU"`

#### vNext `inst`

`inst U1 STM32F103C8T6 { ... }` 会降级为：

- `type = "STM32F103C8T6"`
- `device = "STM32F103C8T6"`
- `component = deviceDefs[STM32F103C8T6].component`
- `package = deviceDefs[STM32F103C8T6].package`
- `attrs = inst attrs`

#### 内联辅助元件

`R1 Resistor(value=10k)` 仍直接降级为普通 `ComponentIR`，不强制先定义到 `deviceDefs`。

## `NetIR`

```ts
interface NetIR {
  name: string;
  pins: string[];
  kind?: NetKind;
}
```

`pins` 使用规范化 `REF.PIN` 形式，例如：

- `U1.NRST`
- `R1.1`
- `RT0.2`

## `PatternIR`

当前模式类型：

- `pullup`
- `pulldown`
- `series`
- `shunt`
- `decouple`
- `tap`
- `bridge`

这些 pattern 不替代 netlist，而是在连通事实之上补充设计意图。

## `DiffPairIR`

```ts
interface DiffPairIR {
  name: string;
  pNet: string;
  nNet: string;
  pPins: string[];
  nPins: string[];
  endpoints?: DiffEndpointIR[];
  constraints?: DiffPairConstraints;
}
```

当前 lowering 会：

- 把 `pPins/nPins` 加入各自 net
- 把端点 `bridge` 进入 `patterns`
- 把 `endpoint` 和 `near` 信息保留在 `DiffPairIR`

例如：

- `PatternIR.kind = "bridge"`
- `metadata.endpoint = "rx"`
- `metadata.near = "U_FPGA"`

## `ConstraintIR`

`ConstraintIR` 仍作为通用约束容器保留，用于：

- component conflict
- 后续扩展的通用编译约束

## 校验范围

`validateCircuitIr()` 当前会校验：

- net 是否为空
- pin ref 是否为 `REF.PIN`
- component ref 是否为空
- component 冲突
- `device` 是否引用存在的 `component/package`
- `device.pinmap` 是否引用存在的 pin/pad
- vNext 实例的 pin 是否在对应 `component` 中声明
- diff pair 的 p/n net 是否存在
- diff pair 的 `PinRef` 是否合法
- `endpoint ... near ...` 的 ref 是否存在

可参考快照：

- [examples/ir/simple-pin-ops.ir.json](../examples/ir/simple-pin-ops.ir.json)
- [examples/ir/vnext-device.ir.json](../examples/ir/vnext-device.ir.json)
- [examples/ir/vnext-diff-pair.ir.json](../examples/ir/vnext-diff-pair.ir.json)
