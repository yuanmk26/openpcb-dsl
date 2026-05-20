# AST 设计

## 目标

`ProgramAst` 是 `.opcb` 文本 DSL 的结构化语义层，位于 parser 与 IR lowering 之间。

推荐入口：

- 文本解析：`parseOpenPcbDsl(source)`
- 文件入口解析：`parseOpenPcbDslFile(entryFilePath)`
- 分阶段调试：`parseOpenPcbDsl(...) + compileAstToIr(ast)`

## 顶层结构

```ts
interface ProgramAst {
  kind: "program";
  imports: ImportAst[];
  components: ComponentDefAst[];
  packages: PackageDefAst[];
  devices: DeviceDefAst[];
  instances: InstanceAst[];
  diffPairs: DiffPairAst[];
}
```

含义：

- `imports`：当前文本里显式写出的顶层导入
- `components`：抽象电气接口定义
- `packages`：物理 pad 集合定义
- `devices`：可实例化具体器件定义
- `instances`：设计中的具体实例，兼容 legacy 与 vNext
- `diffPairs`：差分对结构

## `ImportAst`

```ts
interface ImportAst {
  kind: "import";
  path: string;
}
```

说明：

- 只表示语法层的导入声明
- `parseOpenPcbDsl(source)` 会保留原始 `imports`
- `parseOpenPcbDslFile(entryFilePath)` 会先展开依赖并合并 AST，返回结果中的 `imports` 为空数组

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

- `target`：实例直接引用的目标名
- `targetKind = "legacy_component"`：旧语法 `Ref Type(...)`
- `targetKind = "device"`：vNext `inst Ref Device { ... }`
- `componentType`：兼容字段；legacy 与 vNext 都会填入目标名

## `PinExprAst`

```ts
interface PinExprAst {
  kind: "pin_expr";
  pin: string;
  node: string;
  operations: PinOperationAst[];
}
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

主要用于表达内联辅助元件，而不是完整器件库模型。

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

## 与 IR 的关系

lowering 的主要工作包括：

- 把 `component / package / device` 写入 IR 定义层
- 把 vNext `inst` 映射到 `ComponentIR`
- 把 pin 表达式展开为 `net + pattern`
- 把 `diff_pair` 写入 `DiffPairIR`

`compileAstToIr()` 不负责解析 `import` 路径。多文件场景必须先通过 `parseOpenPcbDslFile()` 展开并合并 AST，再进入 lowering。

## 参考快照

- [examples/ast/simple-pin-ops.ast.json](../examples/ast/simple-pin-ops.ast.json)
- [examples/ast/vnext-device.ast.json](../examples/ast/vnext-device.ast.json)
- [examples/ast/vnext-device-imports.ast.json](../examples/ast/vnext-device-imports.ast.json)
- [examples/ast/vnext-diff-pair.ast.json](../examples/ast/vnext-diff-pair.ast.json)
