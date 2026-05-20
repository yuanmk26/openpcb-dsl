# CLI 使用说明

`openpcb-dsl` 提供一个很薄的调试 CLI，主要用于：

- 查看 AST
- 查看 IR
- 跑基础校验

它支持 legacy 与 vNext 两套文本语法。

## 命令

### `openpcb-dsl parse <file>`

读取 `.opcb` 文件并输出 `ProgramAst` JSON。

适合场景：

- 调试 parser
- 查看 `component/package/device/inst/diff_pair` 是否按预期入 AST
- 对比 legacy 与 vNext 两套文本入口

```bash
openpcb-dsl parse examples/dsl/vnext-device.opcb --pretty
```

### `openpcb-dsl compile <file>`

读取 `.opcb` 文件并输出 `CircuitIR` JSON。

这是更接近实际集成的主命令。

```bash
openpcb-dsl compile examples/dsl/vnext-diff-pair.opcb --pretty
```

### `openpcb-dsl validate <file>`

读取 `.opcb` 文件，先编译成 `CircuitIR`，再输出 diagnostics JSON。

```bash
openpcb-dsl validate examples/dsl/mcu-reset.opcb --pretty
```

## 可选参数

### `--pretty`

使用格式化 JSON 输出，便于人工阅读。

## 推荐用法

如果你的目标是普通调试或集成验证，优先使用：

```bash
openpcb-dsl compile <file> --pretty
openpcb-dsl validate <file> --pretty
```

如果你要观察 grammar 与 AST 的对应关系，再使用：

```bash
openpcb-dsl parse <file> --pretty
```

## 当前限制

- CLI 仍然是调试工具，不提供交互模式
- 还不支持 `stdin`
- 还不支持 `--out`
- emitter 子命令还没有接到 CLI
