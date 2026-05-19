# openpcb-dsl

`openpcb-dsl` 是 OpenPCB 项目的独立 TypeScript 编译核心，负责把面向用户的电路 DSL 降级为结构化中间表示，供上层工具做解析、校验、转换和导出。

当前编译链路：

`OpenPCB DSL -> AST -> OpenPCB Circuit IR -> 初步 tscircuit / Circuit JSON emitter`

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

- `examples/dsl/`：DSL 输入示例
- `examples/ast/`：当前编译器可直接消费的 AST 示例
- `examples/ir/`：IR 示例或快照
- `examples/emitters/`：emitter 输出示例

## 当前限制

- `parseOpenPcbDsl()` 当前只支持 pin-centered instance DSL
- `compileOpenPcbDsl()` 会把 `.opcb` 文本直接解析并编译到 `CircuitIR`
- 元件引脚建模当前只覆盖 `R1.1`、`R1.2` 这类简单自动生成端子
- diff pair 目前只有 AST / IR 占位结构，还没有真正展开
- TSX emitter 仍是 draft 版本
- Circuit JSON 输出仍是概念性占位输出

## 文档

- [架构说明](docs/architecture.md)
- [语法设计](docs/syntax.md)
- [AST 设计](docs/ast.md)
- [IR 设计](docs/ir.md)
- [CLI 使用说明](docs/cli.md)
- [tscircuit 映射](docs/tscircuit-mapping.md)
- [路线图](docs/roadmap.md)
