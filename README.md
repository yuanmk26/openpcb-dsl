# openpcb-dsl

`openpcb-dsl` 是 OpenPCB 项目的 TypeScript 编译核心，负责把 `.opcb` 文本 DSL 解析为 AST，并进一步降级为 `CircuitIR`，供校验器、导出器和上层工具使用。

当前编译链路：

`OpenPCB DSL -> ProgramAst -> CircuitIR -> emitter / validator`

## 当前能力

当前已支持两套文本写法并存：

- legacy pin-centered 语法：`Ref Type(...)`
- vNext 定义层语法：`component / package / device / inst / diff_pair`

当前已实现：

- `component`、`package`、`device`、`inst`
- `diff_pair`
- `bridge`
- `endpoint ... near ...`
- 差分约束
- legacy 内联辅助元件语法糖，如 `R1 Resistor(value=10k)`
- AST -> IR lowering
- IR 校验 diagnostics
- 测试用 CLI

兼容策略：

- legacy 语法继续可用
- 新旧语法可以出现在同一个文件中
- vNext 推荐统一使用空格分隔实例化语义，例如 `inst U1 STM32F103C8T6`

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

## 推荐使用方式

对大多数调用方，推荐直接把 `.opcb` 文本编译为 `CircuitIR`：

```ts
import { compileOpenPcbDsl, validateCircuitIr } from "openpcb-dsl";

const source = `
component MCU {
  pins {
    NRST: in
  }
}

package DIP1 {
  pads { 1 }
}

device MCU_DEV : MCU @ DIP1 {
  pinmap {
    NRST -> 1
  }
}

inst U1 MCU_DEV {
  NRST.Node(RESET)
}
`;

const ir = compileOpenPcbDsl(source);
const diagnostics = validateCircuitIr(ir);
```

如果你需要观察 parser 的中间结果，再使用 AST：

```ts
import { parseOpenPcbDsl, compileAstToIr } from "openpcb-dsl";

const ast = parseOpenPcbDsl(source);
const ir = compileAstToIr(ast);
```

## CLI

当前仓库提供一个很薄的调试 CLI：

- `openpcb-dsl parse <file>`
- `openpcb-dsl compile <file>`
- `openpcb-dsl validate <file>`
- `--pretty`

示例：

```bash
openpcb-dsl parse examples/dsl/vnext-device.opcb --pretty
openpcb-dsl compile examples/dsl/vnext-diff-pair.opcb --pretty
openpcb-dsl validate examples/dsl/mcu-reset.opcb
```

## 示例目录

```text
examples/
  dsl/
    *.opcb
  ast/
    *.ast.json
  ir/
    *.ir.json
```

- `examples/dsl/`：文本 DSL 输入
- `examples/ast/`：AST 快照
- `examples/ir/`：IR 快照

## 当前限制

- `CircuitIR` 已增加定义层字段，但 emitter 侧仍主要围绕 netlist/pattern 工作
- 内联辅助元件仍按 ad-hoc 方式直接降级为普通元件实例，不强制先进入 `deviceDefs`
- `endpoint ... near ...` 当前会进入 AST/IR，并在校验阶段检查 ref 是否存在；不会额外做几何或布局语义处理
- TSX / Circuit JSON emitter 仍是早期映射

## 文档

- [语法设计](docs/syntax.md)
- [AST 设计](docs/ast.md)
- [IR 设计](docs/ir.md)
- [CLI 使用说明](docs/cli.md)
- [架构说明](docs/architecture.md)
- [tscircuit 映射](docs/tscircuit-mapping.md)
- [路线图](docs/roadmap.md)
