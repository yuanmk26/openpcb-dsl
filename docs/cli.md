# CLI 使用说明

`openpcb-dsl` 现在提供一个很薄的测试用 CLI，主要用于 DSL 调试、集成验证和端到端测试。

## 命令定位

- 这是对现有 parser / compiler / validate API 的命令行封装。
- 当前目标是方便查看 AST、IR 和 diagnostics，不是完整生产工具。
- 当前仅支持 pin-centered instance DSL，`diff_pair` 文本语法仍不支持。

## 命令列表

### `openpcb-dsl parse <file>`

读取 `.opcb` 文件并输出 `ProgramAst` JSON。

```bash
openpcb-dsl parse examples/dsl/mcu-reset.opcb
```

### `openpcb-dsl compile <file>`

读取 `.opcb` 文件并输出 `CircuitIR` JSON。

```bash
openpcb-dsl compile examples/dsl/simple-pin-ops.opcb
```

### `openpcb-dsl validate <file>`

读取 `.opcb` 文件，先编译为 `CircuitIR`，再输出 diagnostics JSON 数组。

```bash
openpcb-dsl validate examples/dsl/mcu-reset.opcb
```

## 可选参数

### `--pretty`

使用格式化 JSON 输出，便于人工阅读。

```bash
openpcb-dsl parse examples/dsl/mcu-reset.opcb --pretty
```

## 当前限制

- 只支持 `Ref Type(...)` 形式的顶层实例声明
- 只支持 `Node`、`PullUp`、`PullDown`、`Series`、`Shunt`、`Decouple`、`Tap`
- 还不支持 `diff_pair`
- 还不支持 `bridge`
- 还不支持 `stdin`、`--out`、emitter 子命令和交互模式
