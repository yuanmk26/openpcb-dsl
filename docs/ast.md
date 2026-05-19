# AST 设计

## 目的

`ProgramAst` 是 OpenPCB DSL 在进入 IR 之前的结构化语义层。

在当前 MVP-0 阶段，它有两个明确职责：

- 作为 `AST -> IR` 编译器的直接输入
- 作为文本 DSL 与规范化 `CircuitIR` 之间的中间表达

需要注意的是，当前仓库里的 AST 不是由 `.opcb` parser 自动生成的，因为文本 parser 仍未实现。现阶段 AST 主要用于固定编译输入形状、验证 lowering 规则，并支撑测试与示例。

## 设计原则

当前 AST 不是为了完整保留文本语法细节，而是为了让后续 lowering 过程简单、稳定、可测试。

设计重点：

- 以 `pin-centered` 方式组织连接语义
- 让每个引脚先绑定一个明确的 `node`
- 把链式操作表示成显式 `operations[]`
- 为差分对保留独立结构，而不是强行塞进单 pin 表达式

这意味着 AST 更接近“语义化输入对象”，而不是“保真语法树”。

## 顶层结构

顶层类型是 `ProgramAst`：

```ts
interface ProgramAst {
  kind: "program";
  instances: InstanceAst[];
  diffPairs: DiffPairAst[];
}
```

含义：

- `instances`：普通元件实例及其 pin 级连接语义
- `diffPairs`：差分对声明与约束

## InstanceAst

`InstanceAst` 表示一个元件实例：

```ts
interface InstanceAst {
  kind: "instance";
  ref: string;
  componentType: string;
  params?: Record<string, string>;
  pins: PinExprAst[];
}
```

字段说明：

- `ref`：实例标识，例如 `U1`、`R3`
- `componentType`：语义层元件类型，例如 `MCU`、`Resistor`
- `params`：可选参数，保留源语义中的附加信息
- `pins`：该实例下的 pin 表达式

这里的 `pins` 不是元件符号库意义上的“引脚定义”，而是“对若干引脚写下的连接和附加操作”。

## PinExprAst

`PinExprAst` 是当前 AST 设计的核心：

```ts
interface PinExprAst {
  kind: "pin_expr";
  pin: string;
  node: string;
  operations: PinOperationAst[];
}
```

含义：

- `pin`：实例上的引脚名
- `node`：该引脚首先绑定到的逻辑网络
- `operations`：围绕当前 `node` 继续展开的附加操作

这个结构直接对应当前 DSL 的链式表达方式，例如：

```opcb
NRST.Node(RESET)
  .PullUp(R1: Resistor(value=10k), to=3V3)
  .Shunt(C1: Capacitor(value=100nF), to=GND)
```

对应的 AST 含义是：

1. 把 `NRST` 连接到 `RESET`
2. 在 `RESET` 与 `3V3` 之间添加一个 `pullup`
3. 在 `RESET` 与 `GND` 之间添加一个 `shunt`

## ComponentExprAst

许多 pin 操作会内联携带一个辅助元件定义：

```ts
interface ComponentExprAst {
  ref: string;
  type: string;
  value?: string;
  footprint?: string;
  params?: Record<string, string>;
}
```

它的目标不是表达完整器件库模型，而是为 lowering 提供足够的元件信息。当前编译器会把它进一步归一化为 `ComponentIR`。

## PinOperationAst

当前支持的 pin 操作包括：

- `pullup`
- `pulldown`
- `series`
- `shunt`
- `decouple`
- `tap`
- `bridge`

大多数操作都具有类似结构：

```ts
{
  kind: "...",
  component: { ... },
  to: "targetNet",
  metadata?: { ... }
}
```

其中：

- `component`：参与该操作的辅助元件
- `to`：目标网络
- `metadata`：为后续流程保留的附加语义

`tap` 是例外。它只有 `component`，没有 `to`，因为它代表挂接在当前网络上的单端或测试点类结构。

## DiffPairAst

差分对使用独立的数据结构：

```ts
interface DiffPairAst {
  kind: "diff_pair";
  name: string;
  pNet: string;
  nNet: string;
  pPins: string[];
  nPins: string[];
  operations?: PinOperationAst[];
  constraints?: Record<string, string | boolean>;
}
```

这样设计的原因是差分对天然涉及：

- p/n 两侧网络
- 成对的端点集合
- 成对约束
- 可能跨两侧的语义操作

这些内容并不适合硬塞回单个 `PinExprAst` 的链式模型里。

当前 MVP-0 只定义了差分对 AST/IR 结构，真正的展开逻辑仍未实现。

## 与 IR 的关系

AST 到 IR 的 lowering 重点是把语义化的 pin 表达式展开成规范化的网表和 pattern 信息。

例如一个 `PinExprAst`：

```json
{
  "kind": "pin_expr",
  "pin": "P1",
  "node": "node1",
  "operations": [
    {
      "kind": "pullup",
      "component": {
        "ref": "R1",
        "type": "Resistor",
        "params": { "value": "10k" }
      },
      "to": "VCC"
    }
  ]
}
```

在当前编译器中会被展开为：

- `Inst_U1.P1` 接到 `node1`
- 新增元件 `R1`
- `R1.1` 接到 `node1`
- `R1.2` 接到 `VCC`
- 记录一条 `pullup` pattern

因此 AST 的主要价值在于：

- 保留用户写法中的设计意图
- 为 lowering 提供稳定的结构
- 避免后续 IR 层再去反推“这个连接原本是 pullup 还是 series”

## 当前限制

- 文本 `.opcb` parser 尚未实现，AST 目前需要手工构造
- AST 只覆盖 MVP-0 关注的 pin-centered 核心语义
- 差分对只有结构定义，缺少真实展开逻辑
- 还没有更完整的元件属性、封装、方向性和库引用建模

## 示例

可以参考：

- [examples/ast/simple-pin-ops.ast.json](../examples/ast/simple-pin-ops.ast.json)
- [examples/dsl/simple-pin-ops.opcb](../examples/dsl/simple-pin-ops.opcb)

这两个文件表达的是同一个最小案例的两种视图：

- `.opcb`：面向用户的 DSL 表达
- `.ast.json`：当前编译器直接消费的结构化输入
