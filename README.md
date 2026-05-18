# openpcb-dsl

`openpcb-dsl` 是 OpenPCB 项目的独立 TypeScript 编译核心库，负责将面向用户的电路 DSL 降级为结构化中间表示，供上层工具进行检查、验证、转换和导出。

当前编译链路：

`OpenPCB DSL -> AST -> OpenPCB Circuit IR -> 初步 tscircuit / Circuit JSON emitter`

## 为什么需要这个库

OpenPCB 需要一个统一的编译层，供以下模块共享：

- AI 辅助电路生成 agent
- GUI 编辑器和预览工具
- VSCode 插件
- KiCad 及其他下游导出器

把编译核心独立成库，有利于让数据模型更明确、更可测试，也更方便在不同运行环境之间复用。

## 当前 MVP 范围

MVP-0 的重点是项目骨架和语义分层，不是完整文本 parser。

当前已包含：

- 面向 pin-centered DSL 的第一版 AST 类型
- 规范化的电路 IR 类型
- 基础 pin operation 的 AST -> IR 编译
- IR 校验与 diagnostics
- 初步 TSX emitter
- 占位式 Circuit JSON emitter
- 示例和测试

当前未包含：

- 真正的 `.opcb` 文本 parser
- diff pair 展开逻辑
- CLI
- 可直接用于生产的 tscircuit / Circuit JSON 映射

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

## 最小示例

当前 parser 还未实现，因此 MVP-0 主要从 AST 输入开始工作：

```ts
import { compileAstToIr, emitTscircuitTsx, validateCircuitIr } from "openpcb-dsl";

const ast = {
  kind: "program",
  instances: [
    {
      kind: "instance",
      ref: "U1",
      componentType: "MCU",
      pins: [
        {
          kind: "pin_expr",
          pin: "NRST",
          node: "RESET",
          operations: [
            {
              kind: "pullup",
              component: {
                ref: "R1",
                type: "Resistor",
                params: { value: "10k" },
              },
              to: "3V3",
            },
          ],
        },
      ],
    },
  ],
  diffPairs: [],
};

const ir = compileAstToIr(ast);
const diagnostics = validateCircuitIr(ir);
const tsx = emitTscircuitTsx(ir);
```

## 当前限制

- `parseOpenPcbDsl()` 会明确抛出“尚未实现”的错误。
- 元件引脚建模当前仅覆盖 `R1.1`、`R1.2` 这类简单自动生成端子。
- diff pair 只有 AST/IR 占位类型，还没有真正的展开逻辑。
- TSX emitter 目前是 draft 版本，不承诺与真实 tscircuit API 完全兼容。
- Circuit JSON 导出目前仍是概念性占位输出。

## 文档

- [架构说明](docs/architecture.md)
- [语法设计](docs/syntax.md)
- [IR 设计](docs/ir.md)
- [tscircuit 映射](docs/tscircuit-mapping.md)
- [路线图](docs/roadmap.md)

## Roadmap

- `MVP-0`：项目骨架、IR、AST、编译、校验、draft emitter
- `MVP-1`：真实 parser、更完整的 emitter、更多元件映射、CLI
- `MVP-2`：diff pair 展开、endpoint-local 操作、LVDS 相关流程
- `MVP-3`：Circuit JSON emitter、tscircuit 集成测试、原理图预览工作流
