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

在目标文件中写入标记，然后运行 CLI。

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
```

CLI 处理文件中所有已标记的片段，按 `FRAGMENTS` 顺序自下而上应用；`sync` 保留标记缩进，`check` 在漂移时非零退出。

本仓库等价入口（目标由调用方传入）：

```sh
npm run dock:embed -- check path/to/shared.js
npm run dock:embed -- sync path/to/shared.js
```

消费插件以 `loopback:sync` / `guard:sync` / `http:sync` 调用同一 CLI，目标固定为自身 `lib/shared.js`；client 半以 `launcher:sync` 维护 `dsh-utility-launcher` 块，目标固定为自身 `lib/client.js`。宿主半的三个块由一条命令一并处理：标记存在即被选中，因此 `http:sync` 与 `loopback:sync` 写的是同一个文件里的不同块。

## 约束

- `dist/` 是唯一来源。修改片段后执行下面「开发与验证」列出的命令，并让消费插件重新 `sync`。
- `lib/shared.js` 中三个片段的落点固定：`dsh-loopback-helpers` → `dsh-host-guard` → `dsh-host-http`。守卫直接使用前一块声明的模块级名字，既不重新声明也不 import；`dsh-host-http` 不读上面两块、也不声明它们的名字，故可单独嵌入。落点顺序即 `FRAGMENTS` 顺序；`sync` 自下而上替换块，标记区间彼此交叠的文件会被直接拒绝、不写出任何内容。
- `dsh-utility-launcher` 落在 client 半：每页只运行一份该装配（先加载的一方赢得 `window` 互斥并声明菜单座位），其余副本只往座位里投一行。这是运行时事实，不是样式选择。
- 片段不得包含 `import` 或 `require`；消费插件必须能独立发布。
- `bindGuard` 不从片段导出——消费插件在同一文件中声明自己的 guard 导出。各插件通过 `policy` 传入自身错误码与文案，判定逻辑共用。
- `createRequirePost({ respond, policy })` 同上：默认 code 是 `method`，一个仓已发布的词汇（例如 `need_post`、中文文案、回带 `action`）由 `policy.method_not_allowed` 覆盖，行为不变；未知 key 抛错。
- `createBrowserAuthorizer({ getConnection, getConnectionSeen, guard, respond })` 收的是访问器而非值：宿主半的 Connection 会被服务重载置空，捕获值的那一版会一直放行给一个已销毁的 Connection。语义固定：Connection 抛异常 → 503 `connection_unavailable`；给出 rejection → 以该码回绝（401 → `unauthorized`，其余 → `forbidden`）；见过 Connection 而当下没有 → 503，且绝不退回更弱的 guard；从未见过 → 交给 `guard`。

## 跨仓一致性

消费插件的 `npm test` 用 `loopback:check` / `guard:check` / `http:check` 把自己 `lib/shared.js` 里的三个块与所 pin 的 dock 版本逐字节比对。dock 版本不可变且消费方 pin 精确版本，故「pin 一致」即「片段一致」。反向不成立：`check` 只按它能识别的标记选块，一个还没抬 pin 的消费方根本不比对新增的那个块，对它这一项是空过的。所以新增片段后，消费方要重跑四个 `sync`，并把 pin 一起抬到发布版本。

`dsh-plugin-parity`（本包提供的 bin）直接检这条跨仓性质：逐块（剥离块的公共缩进后）比对三个 host 块（含 `dsh-host-http`）、pin 一致性断言、块落点顺序断言与行为级对比。它是人工诊断工具，**不在 CI 中运行**：peer 处于不同分支时该性质本就不成立。成员表由调用方经 `--member <repo>:<export>` 提供——守卫工厂的导出名按片段设计是各仓自定的，故本工具不预设任何成员；`--fleet <repo>` 点名唯一启用 fleet 模式的成员，只对它检查「放宽有边界」，点名不在成员表中的仓即判 FAIL 并非零退出；不带 `--member` 时只跑静态检查，自动发现所有嵌入了宿主守卫块的仓。`--self-test` 不需要任何 checkout：它用内联样例检验块提取与「丢块」两步，改动这两个函数后先跑它。

`dsh-plugin-docs`（同样是本包的 bin）校验双语文档的结构一致性。它不预设文档名：检查哪些文档对、文件位于哪个目录、按什么形状比较，都由调用仓通过 `--config <module>` 提供一个 `{ name, zh, en, shape? }` 数组决定；本包用同一种方式声明自己的 `docs.config.mjs`。形状有两种。默认的 `markdown` 比较中英两侧的标题层级序列与代码围栏语言，围栏内的内容豁免，因为语言相关的示例写在那里。`changelog` 比较中英两侧的版本段（含 `Unreleased` 段）、分类段与小节条目数，分类标题经双语映射归一。`--base <revision>` 额外要求声明的每一对文件在该 revision 之后一起改动，单边改动即缺翻译；revision 为全 0 的 null OID（新建分支或强推时 `github.event.before` 即为此值）时没有可比的前态，这一项跳过并给出提示，其余结构校验照常。各仓的 `docs:check` script 调用它。

## 开发与验证

片段是唯一来源，所以一次改动要同时过片段行为、CLI 与文档这三层；下面是本仓的完整校验（与 `AGENTS.md` 的 Verify 块一致，发布步骤见 `docs/RELEASING.md`）：

```sh
npm test
node bin/dsh-plugin-docs.js
for f in bin/*.js dist/*.js; do node --check "$f"; done
node bin/dsh-plugin-parity.js --self-test
npm pack --dry-run
```
