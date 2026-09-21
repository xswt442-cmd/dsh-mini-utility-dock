# dsh-mini-utility-dock

[中文](./README.md) | [English](./README.en.md)

[![ci](https://github.com/xswt442-cmd/dsh-mini-utility-dock/actions/workflows/ci.yml/badge.svg)](https://github.com/xswt442-cmd/dsh-mini-utility-dock/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-mini-utility-dock?label=npm&color=4d6bfe)](https://www.npmjs.com/package/dsh-mini-utility-dock)
[![release](https://img.shields.io/github/v/release/xswt442-cmd/dsh-mini-utility-dock?label=release&color=16a3a3)](https://github.com/xswt442-cmd/dsh-mini-utility-dock/releases)
[![node](https://img.shields.io/static/v1?label=node&message=%3E%3D20&color=339933&logo=node.js&logoColor=white)](https://nodejs.org)
[![downloads](https://img.shields.io/npm/d18m/dsh-mini-utility-dock?label=downloads&logo=npm&color=cb3837)](https://www.npmjs.com/package/dsh-mini-utility-dock)
[![license](https://img.shields.io/badge/license-MIT-22c55e.svg)](./LICENSE)

DSH 插件族的共享资产：源码片段、嵌入 CLI，以及围绕它们的跨仓诊断与双语文档校验工具。

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

`dsh-plugin-parity`（本包提供的 bin）直接检这条跨仓性质，含 pin 一致性断言与行为级对比。它是人工诊断工具，**不在 CI 中运行**：peer 处于不同分支时该性质本就不成立。成员表由调用方经 `--member <repo>:<export>` 提供——守卫工厂的导出名按片段设计是各仓自定的，故本工具不预设任何成员；不带 `--member` 时只跑静态检查，自动发现所有嵌入了宿主守卫块的仓。

`dsh-plugin-docs`（同样是本包的 bin）校验双语文档的结构对齐：README 中英标题层级与代码围栏一致，CHANGELOG 中英版本段、分类段与条目数一致（分类标题经双语映射归一）；`--base <revision>` 额外要求双语对同改，单边改动即缺翻译。接入方式是各仓自己的 `docs:check` script 指向它——本包自身的双语文档也由此校验。
