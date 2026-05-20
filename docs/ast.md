# AST 设计

## AST 的角色

`ProgramAst` 是 `.opcb` 文本 DSL 的结构化语义层。

推荐入口仍然是：

- 普通调用：`compileOpenPcbDsl(source)`
- 分阶段调试：`parseOpenPcbDsl(source)` + `compileAstToIr(ast)`

AST 当前承担的主要职责：

- 承接 legacy 与 vNext 两套文本语法
- 作为 parser 和 IR lowering 之间的稳定边界
- 为测试、调试、编辑器或 agent 提供结构化中间表示

## 顶层结构

```ts
interface ProgramAst {
  kind: "program";
  components: ComponentDefAst[];
  packages: PackageDefAst[];
  devices: DeviceDefAst[];
  instances: InstanceAst[];
  diffPairs: DiffPairAst[];
}
```

含义：

- `components`：抽象电气接口定义
- `packages`：物理 pad 集合定义
- `devices`：可实例化具体器件定义
- `instances`：设计中的具体实例，兼容 legacy 与 vNext
- `diffPairs`：差分对结构

## 定义层 AST

### `ComponentDefAst`

```ts
interface ComponentDefAst {
  kind: "component_def";
  name: string;
  pins: PinDeclAst[];
  groups?: GroupDeclAst[];
  attrs?: Record<string, string>;
}
```

### `PackageDefAst`

```ts
interface PackageDefAst {
  kind: "package_def";
  name: string;
  pads: string[];
}
```

### `DeviceDefAst`

```ts
interface DeviceDefAst {
  kind: "device_def";
  name: string;
  component: string;
  package: string;
  attrs?: Record<string, string>;
  pinmap: PinmapDeclAst[];
}
```

## `InstanceAst`

```ts
interface InstanceAst {
  kind: "instance";
  ref: string;
  target: string;
  targetKind: "legacy_component" | "device";
  componentType?: string;
  params?: Record<string, string>;
  attrs?: Record<string, string>;
  pins: PinExprAst[];
}
```

说明：

- `target`：实例直接引用的目标
- `targetKind`：
  - `legacy_component` 表示旧语法 `Ref Type(...)`
  - `device` 表示 vNext `inst Ref Device { ... }`
- `componentType`：兼容字段；legacy 与 vNext 都会填入目标名
- `attrs`：vNext `inst { ... }` 内的属性

## `PinExprAst`

```ts
interface PinExprAst {
  kind: "pin_expr";
  pin: string;
  node: string;
  operations: PinOperationAst[];
}
```

对应文本：

```opcb
NRST.Node(RESET)
  .PullUp(R1 Resistor(value=10k), to=3V3)
```

## `ComponentExprAst`

```ts
interface ComponentExprAst {
  ref: string;
  type: string;
  value?: string;
  footprint?: string;
  params?: Record<string, string>;
}
```

它主要用于表达内联辅助元件，而不是完整器件库模型。

## `PinOperationAst`

当前 AST 已定义并由文本 parser 支持：

- `pullup`
- `pulldown`
- `series`
- `shunt`
- `decouple`
- `tap`
- `bridge`

## `DiffPairAst`

```ts
interface DiffPairAst {
  kind: "diff_pair";
  name: string;
  pNet: string;
  nNet: string;
  pPins: string[];
  nPins: string[];
  endpoints?: DiffEndpointAst[];
  constraints?: Record<string, string | boolean>;
}
```

### `DiffEndpointAst`

```ts
interface DiffEndpointAst {
  name: string;
  near?: string;
  bridges: DiffEndpointBridgeAst[];
}
```

这层结构把 `endpoint ... near ... { bridge ... }` 保留下来，避免只剩松散 pattern。

## 与 IR 的关系

lowering 的主要工作包括：

- 把 `component/package/device` 写入 IR 定义层
- 把 vNext `inst` 映射到 `ComponentIR`
- 把 pin 表达式展开为 net + pattern
- 把 `diff_pair` 写入 `DiffPairIR`
- 把端点 `bridge` 同时落到 `diffPairs` 和 `patterns`

如果你需要查看实际 AST 形状，可以参考：

- [examples/ast/simple-pin-ops.ast.json](../examples/ast/simple-pin-ops.ast.json)
- [examples/ast/vnext-device.ast.json](../examples/ast/vnext-device.ast.json)
- [examples/ast/vnext-diff-pair.ast.json](../examples/ast/vnext-diff-pair.ast.json)
