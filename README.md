# openpcb-dsl

`openpcb-dsl` 是 OpenPCB 项目的 TypeScript 编译核心，负责把 `.opcb` 文本 DSL 解析为 `ProgramAst`，再进一步 lowering 为 `CircuitIR`，供校验器、导出器和上层工具使用。

当前编译链路：

`OpenPCB DSL -> ProgramAst -> CircuitIR -> tscircuit JSON emitter / validator`

## 当前能力

当前同时支持两套文本写法：

- legacy pin-centered 语法：`Ref Type(...)`
- vNext 定义层语法：`component / package / device / inst / diff_pair`

当前已实现：

- `component`、`package`、`device`、`inst`
- `diff_pair`
- `bridge`
- `endpoint ... near ...`
- 差分约束
- legacy 内联辅助元件语法糖，例如 `R1 Resistor(value=10k)`
- AST -> IR lowering
- IR 校验 diagnostics
- 基础 CLI
- 多文件定义层导入：`import "./defs.opcb"`

兼容策略：

- legacy 语法继续可用
- 新旧语法可以出现在同一个文件中
- `import` 只用于复用定义层，不用于拆分设计层

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

直接从文本编译：

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

如果需要观察中间 AST：

```ts
import { parseOpenPcbDsl, compileAstToIr } from "openpcb-dsl";

const ast = parseOpenPcbDsl(source);
const ir = compileAstToIr(ast);
```

如果需要从入口文件递归展开定义层导入：

```ts
import { compileOpenPcbDslFile, parseOpenPcbDslFile } from "openpcb-dsl";

const ast = parseOpenPcbDslFile("examples/dsl/imports/vnext-device-board.opcb");
const ir = compileOpenPcbDslFile("examples/dsl/imports/vnext-device-board.opcb");
```

## 多文件定义层导入

推荐把可复用定义放到独立文件：

```opcb
# libs/mcu.defs.opcb
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
```

设计入口文件通过 `import` 引入：

```opcb
import "./libs/mcu.defs.opcb"

inst U1 MCU_DEV {
  NRST.Node(RESET)
}
```

当前限制：

- `import` 只允许顶层使用
- 被导入文件只允许包含 `import / component / package / device`
- 不支持 `import as`、命名空间、远程路径、覆盖规则
- 同名 `component / package / device` 直接报错

## CLI

当前 CLI：

- `openpcb-dsl parse <file>`
- `openpcb-dsl compile <file>`
- `openpcb-dsl validate <file>`
- `--pretty`

示例：

```bash
openpcb-dsl parse examples/dsl/vnext-device.opcb --pretty
openpcb-dsl compile examples/dsl/imports/vnext-device-board.opcb --pretty
openpcb-dsl validate examples/dsl/vnext-diff-pair.opcb --pretty
```

CLI 以入口文件为单位工作，会递归展开 `import` 后再输出 AST / IR / diagnostics。

## 示例目录

```text
examples/
  dsl/
    *.opcb
    imports/
      *.opcb
  ast/
    *.ast.json
  ir/
    *.ir.json
```

- `examples/dsl/`：DSL 输入
- `examples/dsl/imports/`：多文件定义层导入示例
- `examples/ast/`：AST 快照
- `examples/ir/`：IR 快照

## 当前限制

- `CircuitIR` 已保留定义层字段，但当前到 tscircuit JSON 的映射仍处于早期阶段
- 内联辅助元件仍按 ad-hoc 方式直接降级为普通元件实例，不强制先进入 `deviceDefs`
- `endpoint ... near ...` 当前只进入 AST / IR 并校验 ref 是否存在，不额外做几何或布局语义处理
- 字符串 API `parseOpenPcbDsl(source)` / `compileOpenPcbDsl(source)` 不负责解析文件路径，也不会展开 `import`

## 文档

- [语法设计](docs/syntax.md)
- [AST 设计](docs/ast.md)
- [IR 设计](docs/ir.md)
- [CLI 使用说明](docs/cli.md)
- [架构说明](docs/architecture.md)
- [tscircuit 映射](docs/tscircuit-mapping.md)
- [路线图](docs/roadmap.md)
