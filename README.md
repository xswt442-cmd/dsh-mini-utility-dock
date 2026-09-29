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
| loopback 判定 | `dsh-loopback-helpers` | `lib/shared.js` | `LOOPBACK_HOSTNAMES`、`normalizeHostValue`、`hostHostname`、`isLoopbackName`、`isLoopbackAddress` |
| host 请求守卫 | `dsh-host-guard` | `lib/shared.js` | `portOf`、`GUARD_REASONS`、`DEFAULT_GUARD_POLICY` |
| host HTTP 胶水 | `dsh-host-http` | `lib/shared.js` | `sendJson`、`CONNECTION_UNAVAILABLE`、`connectionUnavailable`、`REQUIRE_POST_REASONS`、`DEFAULT_REQUIRE_POST_POLICY`、`createRequirePost`、`createBrowserAuthorizer`、`optionalSessionId` |
| utility 入口 | `dsh-utility-launcher` | `lib/client.js` | `registerUtilityLauncher`、`UTILITY_ITEM_SLOT` |

## 使用

在目标文件中写入标记，然后运行 CLI。一条命令维护文件里所有已标记的块；`sync` 写入并保留标记缩进，`check` 在块内容与 `dist/` 不一致时以非零退出。

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
npm run dock:embed -- check path/to/shared.js   # 本仓内的等价入口，目标由调用方传入
```

## 约束

- `dist/` 是唯一来源；改动片段后消费方重新 `sync`。
- `lib/shared.js` 的三个块落点固定为 `dsh-loopback-helpers` → `dsh-host-guard` → `dsh-host-http`，即 `FRAGMENTS` 顺序。
- `dsh-host-guard` 使用 `dsh-loopback-helpers` 在同一文件中声明的名字；`dsh-host-http` 与前两块没有依赖，可单独嵌入。
- `sync` 自下而上替换块；标记区间彼此交叠的文件被拒绝且不写出。
- 片段不含 `import` 或 `require`，消费插件独立发布。
- `bindGuard` 不从片段导出，消费插件在同一文件中声明自己的 guard 导出名。
- 各插件的错误码与文案由 `policy` 传入，判定逻辑共用，未知 key 抛错。
- `createRequirePost({ respond, policy })` 的默认 code 是 `method`，`policy.method_not_allowed` 覆盖 code、文案与是否回带 `action`。
- `dsh-utility-launcher` 落在 client 半，每页只运行一份该装配，先加载的一方赢得 `window` 互斥并声明菜单座位。
- `createBrowserAuthorizer({ getConnection, getConnectionSeen, guard, respond })` 的入参是访问器，判定顺序固定：
  - Connection 抛异常 → 503 `connection_unavailable`。
  - Connection 给出 rejection → 401 回 `unauthorized`，其余码回 `forbidden`。
  - 见过 Connection 而当下没有 → 503，不退回 `guard`。
  - 从未有过 Connection → 由 `guard` 判定。

## 跨仓一致性

- 消费插件的 `npm test` 把自己 `lib/shared.js` 里的块与所 pin 的 dock 版本逐字节比对；发布版本不可变、pin 是精确版本，故 pin 一致即片段一致。
- 新增片段后，消费方重跑四个 `sync` 并把 pin 一起抬到发布版本，未抬 pin 的一侧不比对新增的块。
- `dsh-plugin-parity` 是人工诊断工具，不在 CI 中运行。
  - 比对前先剥离块的公共缩进。检查四项：三个宿主块逐字节相同且按依赖顺序落位；dock pin 只有一个且是精确版本；块外没有私有的判定副本；各仓的 allow/deny 结果一致，错误码与文案可以不同。
  - `--root <dir>`：各仓 checkout 所在的父目录。
  - `--member <repo>:<export>`：一个参与者与它导出的守卫工厂名，按参与者逐个给出，工具不预设成员。
  - `--fleet <repo>`：点名启用 fleet 模式的成员，只对它检查放宽有边界，点名不在成员表中的仓即 FAIL 并以非零退出。
  - 不带 `--member`：只跑静态检查，自动发现所有嵌入了宿主守卫块的仓。
  - `--self-test`：用内联样例检验块提取与剥离块，不需要任何 checkout。
- `dsh-plugin-docs` 校验双语文档对的结构，由各仓的 `docs:check` 调用。
  - `--config <module>`：配置模块导出 `{ name, zh, en, shape? }` 数组，检查哪些文档对、位于哪个目录、按什么形状比较都由它决定。
  - `shape` 缺省为 `markdown`，比较标题层级序列与代码围栏语言，围栏内的内容豁免。
  - `shape: 'changelog'` 比较版本段（含 `Unreleased` 段）、分类段与小节条目数。
  - `--base <revision>`：每一对文件都要在该 revision 之后一起改动，单边改动即缺翻译。
  - revision 为全 0 的 null OID 时没有可比的前态，这一项跳过并给出提示，结构校验照常。

## 开发与验证

本仓的完整校验（发布步骤见 `docs/RELEASING.md`）：

```sh
npm test
node bin/dsh-plugin-docs.js --config docs.config.mjs
for f in bin/*.js dist/*.js; do node --check "$f"; done
node bin/dsh-plugin-parity.js --self-test
npm pack --dry-run
```
