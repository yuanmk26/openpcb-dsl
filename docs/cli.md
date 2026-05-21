# CLI 使用说明

`openpcb-dsl` 提供一个面向调试与导出的 CLI，主要用于：

- 查看 AST
- 查看 IR
- 跑基础校验
- 导出 tscircuit schematic Circuit JSON
- 直接导出 schematic SVG

它同时支持 legacy 和 vNext 文本语法，并且支持以入口文件递归展开定义层 `import`。

## 命令

### `openpcb-dsl parse <file>`

读取 `.opcb` 入口文件并输出 `ProgramAst` JSON。

```bash
openpcb-dsl parse examples/dsl/imports/vnext-device-board.opcb --pretty
```

### `openpcb-dsl compile <file>`

读取 `.opcb` 入口文件并输出 `CircuitIR` JSON。

```bash
openpcb-dsl compile examples/dsl/vnext-diff-pair.opcb --pretty
```

### `openpcb-dsl validate <file>`

读取 `.opcb` 入口文件，先编译为 `CircuitIR`，再输出 diagnostics JSON。

```bash
openpcb-dsl validate examples/dsl/imports/vnext-device-board.opcb --pretty
```

### `openpcb-dsl emit-schematic-json <file>`

读取 `.opcb` 入口文件，经过 `CircuitIR -> SchematicIR -> tscircuit schematic Circuit JSON` 后输出 JSON。

```bash
openpcb-dsl emit-schematic-json examples/dsl/simple-pin-ops.opcb --pretty
```

### `openpcb-dsl emit-schematic-svg <file>`

读取 `.opcb` 入口文件，经过 `CircuitIR -> SchematicIR -> tscircuit schematic Circuit JSON -> SVG` 后输出 SVG。

```bash
openpcb-dsl emit-schematic-svg examples/dsl/simple-pin-ops.opcb
```

## 选项

### `--pretty`

用于格式化 JSON 输出。对 `parse`、`compile`、`validate`、`emit-schematic-json` 生效。

### `--out <file>`

将命令结果写入指定文件，而不是输出到 stdout。

示例：

```bash
openpcb-dsl emit-schematic-json examples/dsl/simple-pin-ops.opcb --pretty --out examples/emitters/circuit-json/simple-pin-ops.schematic.circuit.json

openpcb-dsl emit-schematic-svg examples/dsl/simple-pin-ops.opcb --out examples/emitters/svg/simple-pin-ops.schematic.svg
```

## viewer 使用方式

如果你想交互查看导出的 tscircuit schematic Circuit JSON，可以：

1. 先导出 JSON 文件
2. 打开 `circuit-json-viewer`
3. 将导出的 `.json` 文件拖进去，或直接粘贴 JSON 内容

推荐先用以下命令生成文件：

```bash
openpcb-dsl emit-schematic-json examples/dsl/simple-pin-ops.opcb --pretty --out out/simple-pin-ops.schematic.circuit.json
```

## 何时使用 JSON，何时使用 SVG

- `emit-schematic-json`
  适合调试 emitter、对照快照、丢给 viewer、保留结构化产物
- `emit-schematic-svg`
  适合快速肉眼检查、放进文档、直接在浏览器或 IDE 中打开

通常建议：

1. 先保留 JSON 作为主产物
2. 再导出 SVG 作为可视化结果

## 多文件行为

CLI 以入口文件为单位工作：

- 相对入口文件和被导入文件目录解析 `import`
- 递归展开定义层依赖
- 检测循环导入
- 合并多个文件中的 `component / package / device`
- 对重复定义直接报错

被导入文件当前只允许包含：

- `import`
- `component`
- `package`
- `device`

## 当前限制

- CLI 仍然是调试工具，不提供交互模式
- 还不支持 `stdin`
- 当前 SVG 导出依赖 `circuit-to-svg`
- 当前 tscircuit schematic emitter 仍是第一版实现，通用器件符号映射还比较保守
