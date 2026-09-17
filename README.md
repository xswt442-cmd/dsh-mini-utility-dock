# dsh-mini-utility-dock

DSH 插件共享的源码片段与嵌入 CLI。

## 片段

| 片段 | 标记 | 目标文件 | 导出 |
| --- | --- | --- | --- |
| dock 引导 | `dsh-mini-utility-dock` | `lib/client.js` | — |
| loopback 判定 | `dsh-loopback-helpers` | `lib/shared.js` | `LOOPBACK_HOSTNAMES`、`normalizeHostValue`、`hostHostname`、`isLoopbackName`、`isLoopbackAddress` |
| host 请求守卫 | `dsh-host-guard` | `lib/shared.js` | `portOf`、`GUARD_REASONS`、`DEFAULT_GUARD_POLICY` |

## 使用

在目标文件中写入标记，然后运行 CLI。

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
```

CLI 处理文件中所有已标记的片段，按 `FRAGMENTS` 顺序自下而上应用；`sync` 保留标记缩进，`check` 在漂移时非零退出。

本仓库等价入口（目标由调用方传入）：

```sh
npm run dock:embed -- check path/to/client.js
npm run dock:embed -- sync path/to/client.js
```

消费插件以 `loopback:sync` / `guard:sync` 调用同一 CLI，目标固定为自身 `lib/shared.js`。

## 约束

- `dist/` 是唯一来源。改片段后运行 `npm test`，并让消费插件重新 `sync`。
- `lib/shared.js` 中两个片段顺序固定，`dsh-loopback-helpers` 在前：`dsh-host-guard` 直接使用前一片段导出的模块级名字，既不重新声明也不 import。
- 片段不得包含 `import` 或 `require`；消费插件必须能独立发布。
- `bindGuard` 不从片段导出——消费插件在同一文件中声明自己的 guard 导出。各插件通过 `policy` 传入自身错误码与文案，判定逻辑共用。
- `label` 缺省、空白或非字符串时回退为 `id`。

## 跨仓一致性

消费仓的 `npm test` 用 `loopback:check` / `guard:check` 把本仓两个片段与所 pin 的 dock 版本逐字节比对。dock 版本不可变且消费仓 pin 精确版本，故「pin 一致」即「片段一致」。

`scripts/guard-parity.mjs`（位于各消费仓）直接检这条跨仓性质，含 pin 一致性断言。它是人工诊断工具，**不在 CI 中运行**：peer 处于不同分支时该性质本就不成立。请在三个检出同分支时运行。
