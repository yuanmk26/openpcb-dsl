# AST 设计

## AST 的角色

`ProgramAst` 是 OpenPCB DSL 在进入 `CircuitIR` 之前的结构化语义层。

当前阶段需要明确的是：AST 仍然有价值，但它不是大多数用户的推荐主入口。

更准确地说：

- 对普通调用方，推荐直接使用 `.opcb` 文本 DSL
- 对库调用，推荐优先使用 `compileOpenPcbDsl()` 直接得到 `CircuitIR`
- 对编译器开发、测试、调试和高级集成，AST 仍然是重要的中间层

也就是说，AST 当前的定位主要是：

- parser 和 IR lowering 之间的内部语义边界
- `AST -> IR` 编译逻辑的直接输入
- 分阶段测试和调试的手脚架
- 高级调用方可选使用的结构化接口

## 为什么保留 AST

保留 AST 的主要原因有：

- 让 parser 不直接耦合 IR 细节
- 让 `AST -> IR` 能被单独测试
- 让语法演进时仍保留稳定的中间契约
- 让上游工具在必要时可以直接生成结构化输入

因此，AST 不是面向普通用户的首选入口，但也不只是“临时废件”。

## 推荐使用方式

### 普通使用

推荐直接走文本 DSL：

```ts
import { compileOpenPcbDsl } from "openpcb-dsl";

const ir = compileOpenPcbDsl(source);
```

### 分阶段调试

如果你需要观察 parser 结果或单独验证 lowering，再使用 AST：

```ts
import { parseOpenPcbDsl, compileAstToIr } from "openpcb-dsl";

const ast = parseOpenPcbDsl(source);
const ir = compileAstToIr(ast);
```

## 顶层结构

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

## PinExprAst

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

对应 DSL 示例：

```opcb
NRST.Node(RESET)
  .PullUp(R1 Resistor(value=10k), to=3V3)
  .Shunt(C1 Capacitor(value=100nF), to=GND)
```

## ComponentExprAst

```ts
interface ComponentExprAst {
  ref: string;
  type: string;
  value?: string;
  footprint?: string;
  params?: Record<string, string>;
}
```

它的目标不是表达完整器件库模型，而是为 lowering 提供足够的元件信息。

## PinOperationAst

当前 AST 类型中定义的 pin 操作包括：

- `pullup`
- `pulldown`
- `series`
- `shunt`
- `decouple`
- `tap`
- `bridge`

需要注意：

- 当前文本 parser 已支持 `PullUp`、`PullDown`、`Series`、`Shunt`、`Decouple`、`Tap`
- 当前文本 parser 还不支持 `bridge`
- AST 类型保留 `bridge`，是为了后续语言能力扩展，而不是表示当前文本入口已经完整支持

## DiffPairAst

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

当前状态：

- AST / IR 层已有 `diff_pair` 占位结构
- 文本 parser 还不支持 `diff_pair`
- lowering 也还没有真正展开 `diff_pair`

## 与 IR 的关系

AST 到 IR 的 lowering 重点是把语义化的 pin 表达式展开为规范化 netlist 和 pattern 信息。

例如：

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

会被展开为：

- `Inst_U1.P1` 接到 `node1`
- 新增元件 `R1`
- `R1.1` 接到 `node1`
- `R1.2` 接到 `VCC`
- 记录一条 `pullup` pattern

## 当前限制

- AST 不是当前最推荐的主入口
- AST 当前主要覆盖 pin-centered 核心语义
- `diff_pair` 只有结构定义，没有真实展开
- 文本 parser 当前并不覆盖 AST 类型里的所有潜在变体

## 示例

可以参考：

- [examples/dsl/simple-pin-ops.opcb](../examples/dsl/simple-pin-ops.opcb)
- [examples/ast/simple-pin-ops.ast.json](../examples/ast/simple-pin-ops.ast.json)

它们表达的是同一个最小案例的两种视图：

- `.opcb`：面向用户的主输入形式
- `.ast.json`：面向编译器开发和调试的结构化中间表示
