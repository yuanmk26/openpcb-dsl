# openpcb-dsl

`openpcb-dsl` 是 OpenPCB 项目的独立 TypeScript 编译核心，负责把面向用户的电路 DSL 降级为结构化中间表示，供上层工具做解析、校验、转换和导出。

当前编译链路：

`OpenPCB DSL -> AST -> OpenPCB Circuit IR -> 初步 tscircuit / Circuit JSON emitter`

## 推荐使用方式

对大多数调用方，推荐把 `.opcb` 文本 DSL 作为主输入，并直接使用以下入口：

- `compileOpenPcbDsl(source)`：文本 DSL -> `CircuitIR`
- `parseOpenPcbDsl(source)`：文本 DSL -> `ProgramAst`
- `openpcb-dsl` CLI：直接查看 AST、IR 和 diagnostics

如果你的目标是集成、调试或测试，优先使用：

- 库入口：`compileOpenPcbDsl()`
- 命令行入口：`openpcb-dsl compile <file>`

## AST 的定位

AST 现在仍然保留，但它的定位需要明确区分：

- 不是大多数用户的主入口
- 主要作为 parser 和 IR lowering 之间的中间层
- 主要服务于编译器开发、测试、调试和高级集成场景

也就是说，AST 当前更像“内部语义边界 + 高级接口”，而不是面向普通用户的首选使用方式。

以下场景仍然适合直接使用 AST：

- 单独测试 `AST -> IR` 逻辑
- 调试 parser 输出
- GUI / agent / 编辑器直接生成结构化输入
- 对编译器做分阶段验证

## 当前能力

当前已具备：

- pin-centered DSL 的 AST 类型
- 规范化的 Circuit IR 类型
- `.opcb` 文本 parser
- `AST -> IR` 编译
- IR 校验 diagnostics
- 初步 TSX emitter
- 占位性质的 Circuit JSON emitter
- 薄测试 CLI

当前还未完成：

- `diff_pair` 文本语法解析
- diff pair 真实展开逻辑
- 生产级 tscircuit / Circuit JSON 映射

## 安装

```bash
pnpm install
```

## 开发命令

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm dev
```

## Parser 状态

当前文本 parser 已支持：

- `parseOpenPcbDsl(source)`：把 pin-centered instance DSL 解析成 `ProgramAst`
- `compileOpenPcbDsl(source)`：把文本 DSL 直接解析并降级为 `CircuitIR`
- 顶层实例声明：`Ref Type(...)`
- pin 操作：`PullUp`、`PullDown`、`Series`、`Shunt`、`Decouple`、`Tap`
- 内联辅助元件：`R1 Resistor(value=10k)`
- 空行、尾逗号、`#` 注释、`//` 注释

当前仍不支持：

- `diff_pair` 文本语法
- `bridge` 文本解析
- `component / package / device / inst` 顶层定义语法

## CLI

当前仓库已提供一个很薄的测试用 CLI，命令名为 `openpcb-dsl`，主要用于 DSL 调试、集成和端到端测试。

支持的命令：

- `openpcb-dsl parse <file>`：输出 AST JSON
- `openpcb-dsl compile <file>`：输出 IR JSON
- `openpcb-dsl validate <file>`：输出 diagnostics JSON
- `--pretty`：格式化 JSON 输出

示例：

```bash
openpcb-dsl parse examples/dsl/mcu-reset.opcb --pretty
openpcb-dsl compile examples/dsl/simple-pin-ops.opcb
openpcb-dsl validate examples/dsl/mcu-reset.opcb
```

更多说明见 [docs/cli.md](docs/cli.md)。

## 最小示例

推荐从文本 DSL 直接进入 `CircuitIR`：

```ts
import { compileOpenPcbDsl, emitTscircuitTsx, validateCircuitIr } from "openpcb-dsl";

const source = `
U1 MCU(
  NRST.Node(RESET)
    .PullUp(R1 Resistor(value=10k), to=3V3)
    .Shunt(C1 Capacitor(value=100nF), to=GND)
);
`;

const ir = compileOpenPcbDsl(source);
const diagnostics = validateCircuitIr(ir);
const tsx = emitTscircuitTsx(ir);
```

如果你需要查看 parser 的分阶段产物，再使用：

```ts
import { parseOpenPcbDsl, compileAstToIr } from "openpcb-dsl";

const ast = parseOpenPcbDsl(source);
const ir = compileAstToIr(ast);
```

## 示例目录

```text
examples/
  dsl/
    *.opcb
  ast/
    *.ast.json
  ir/
  emitters/
    tscircuit-tsx/
    circuit-json/
```

- `examples/dsl/`：主要展示面，面向用户的 DSL 输入示例
- `examples/ast/`：辅助展示面，主要用于说明内部 AST 结构和编译测试
- `examples/ir/`：IR 示例或快照
- `examples/emitters/`：emitter 输出示例

如果你只是想了解语言怎么写、怎么跑，优先看 `examples/dsl/`。

## 当前限制

- `parseOpenPcbDsl()` 当前只支持 pin-centered instance DSL
- `compileOpenPcbDsl()` 会把 `.opcb` 文本直接解析并编译到 `CircuitIR`
- 元件引脚建模当前只覆盖 `R1.1`、`R1.2` 这类简单自动生成端子
- diff pair 目前只有 AST / IR 占位结构，还没有真正展开
- TSX emitter 仍是 draft 版本
- Circuit JSON 输出仍是概念性占位输出

## 文档

`docs/syntax.md` 当前同时包含两部分内容：一部分是已经实现的 pin-centered DSL 语法说明，另一部分是尚未实现的 vNext 语法草案。阅读时请注意区分“当前 parser 已支持能力”和“后续设计方向”。

- [架构说明](docs/architecture.md)
- [语法设计](docs/syntax.md)
- [AST 设计](docs/ast.md)
- [IR 设计](docs/ir.md)
- [CLI 使用说明](docs/cli.md)
- [tscircuit 映射](docs/tscircuit-mapping.md)
- [路线图](docs/roadmap.md)
