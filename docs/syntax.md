# 语法设计

## 状态说明

当前仓库已经同时支持：

- legacy pin-centered DSL
- vNext 定义层 DSL

推荐策略：

- 旧语法继续兼容
- 新语法作为推荐写法
- 所有“实例化”语义统一使用空格分隔，不使用 `:`

例如：

- legacy 顶层实例：`U1 MCU(...)`
- vNext 顶层实例：`inst U1 STM32F103C8T6 { ... }`
- 内联辅助元件：`R1 Resistor(value=10k)`

## legacy 语法

legacy 语法仍然保留，适合快速描述从某个 pin 出发的连接关系。

```opcb
U1 MCU(
  NRST.Node(RESET)
    .PullUp(R1 Resistor(value=10k), to=3V3)
    .Shunt(C1 Capacitor(value=100nF), to=GND)
);
```

已支持的 pin 操作：

- `PullUp`
- `PullDown`
- `Series`
- `Shunt`
- `Decouple`
- `Tap`
- `Bridge`

## vNext 语法

vNext 引入了定义层，把“电气接口”“物理封装”“具体器件”“设计实例”分开表达：

- `component`：定义 pin 接口
- `package`：定义 pad 集合
- `device`：绑定 `component + package + pinmap + attrs`
- `inst`：在设计中实例化具体 `device`
- `diff_pair`：定义差分对与端点规则

### `component / package / device / inst`

```opcb
component MCU {
  pins {
    NRST: in
    PA0: inout
    VDD: power_in
    GND: power_in
  }
}

package LQFP48 {
  pads { 1..48 }
}

device STM32F103C8T6 : MCU @ LQFP48 {
  attrs {
    mfr = ST
    mpn = STM32F103C8T6
  }

  pinmap {
    NRST -> 7
    PA0 -> 10
    VDD -> 24
    GND -> 23
  }
}

inst U1 STM32F103C8T6 {
  role = control

  NRST.Node(RESET)
    .PullUp(R1 Resistor(value=10k, package=R_0402), to=3V3)

  PA0.Node(ADC_IN)
}
```

语义边界：

- `MCU` 是抽象电气接口
- `LQFP48` 是物理 pad 集合
- `STM32F103C8T6` 是可实例化的具体器件
- `U1` 是设计中的实际实例

### `diff_pair`

```opcb
diff_pair ADC_D0 {
  p: U_ADC.DOUT0_P -> node ADC_D0_P -> U_FPGA.ADC_D0_P
  n: U_ADC.DOUT0_N -> node ADC_D0_N -> U_FPGA.ADC_D0_N

  endpoint rx near U_FPGA {
    bridge RT0 Resistor(value=100R, package=R_0402) between p, n
  }

  constraint {
    differential_impedance 100ohm
    intra_pair_length_match within_0p2mm
    route_together true
  }
}
```

当前实现会：

- 把 `pPins/nPins` 挂到各自 net
- 把 `bridge` 落为 `PatternIR.kind = "bridge"`
- 把 `endpoint` 与 `near` 信息保留在 AST / IR 中
- 把 snake_case 约束名规范化到内部 camelCase 字段

## 语法要点

### 1. 实例化统一使用空格

以下都使用空格分隔：

- `inst U1 STM32F103C8T6`
- `R1 Resistor(value=10k)`
- `bridge RT0 Resistor(value=100R) between p, n`

保留冒号的场景：

- `device STM32F103C8T6 : MCU @ LQFP48`
- `NRST: in`
- `p: U_ADC.DOUT0_P -> ...`

### 2. `Node()` 仍然是 pin 链入口

无论 legacy 还是 vNext `inst`，单 pin 连接表达仍从 `Pin.Node(net)` 开始。

### 3. 新旧语法可混写

下面这种文件是合法的：

```opcb
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

TP1 TestPoint(
  P1.Node(RESET)
);
```

## 当前支持范围

当前文本 parser 已支持：

- legacy 顶层实例：`Ref Type(...)`
- `component / package / device / inst / diff_pair`
- `Bridge` 与 `bridge`
- `endpoint ... near ...`
- `1..48` 这类 pad range
- `#` 注释和 `//` 注释

当前不打算在本轮实现的内容：

- 更复杂的字符串字面量系统
- 布局级几何语义
- 需要先定义辅助元件再引用的强制器件库流程
