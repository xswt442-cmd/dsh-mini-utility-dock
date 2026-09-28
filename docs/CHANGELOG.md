# 更新日志

Release Notes 由对应版本段生成；最新版本在前。
英文版见 [CHANGELOG.en.md](CHANGELOG.en.md)。

## 0.7.0 - 2026-09-29

### 变更

- `dsh-plugin-docs` 不再预设文档名。检查哪些文档对、各自的路径与比较形状由调用仓的 `--config <module>` 提供，该模块导出 `{ name, zh, en, shape? }` 数组；`shape` 缺省为 `markdown`（比标题层级序列与代码围栏语言），`changelog` 比版本段、分类段与小节条目数。未在配置中声明的文档不参与比较，因此调用方的 `docs:check` 需要带上 `--config`。
- 本包的 `CHANGELOG.md`、`CHANGELOG.en.md`、`RELEASING.md` 移入 `docs/`，仓库根目录只留两份 README、`LICENSE` 与 `AGENTS.md`；npm 包内的两份 CHANGELOG 随新路径发布。

## 0.6.0 - 2026-09-28

- 新增 `dist/host-http.js`（标记 `dsh-host-http`）：宿主半的响应胶水收成一块——`sendJson`（一律带 `no-store`）、POST 门、浏览器授权器、`optionalSessionId`，回复策略自此只有一份定义。已发布的词汇（`need_post`、中文文案、回带 `action`）由 `policy` 覆盖，公开标识符不变。
- `createBrowserAuthorizer` 收访问器而非值：宿主半的 Connection 会被服务重载置空再赋新值，捕获值的那一版会一直把请求交给一个已销毁的 Connection。
- launcher 与 host-http 片段随片段逐字进入消费者的注释改为直陈事实：不再有误述其余副本行为的句子，host-http 把引用守卫块名字的类比写明其来源。
- `dsh-mini-utility-dock` 的 `sync`/`check` 遇到标记区间交叠（`<A> <B> </A> </B>`）的文件直接拒绝且不写出，杜绝此前可能产生的损坏。
- `dsh-plugin-parity` 把 `dsh-host-http` 块纳入逐块比对，块落点顺序的断言同时覆盖三个 host 块。
- `dsh-plugin-parity` 的「块外私有实现」扫描只匹配代码形状：Fetch Metadata 的方括号取头与解构取头都算、`LOOPBACK_HOSTNAMES` 只认赋值不认比较，并删去会误伤合理仓库的复合启发式，讲清了理由的注释与散文不再被误判成漂移。
- `dsh-plugin-parity` 的逐块比对改为剥离块的公共缩进，按 4 空格或 Tab 缩进标记的消费者不再被误判为漂移；`--fleet` 点名不在成员表中的仓即判 FAIL 并非零退出，不再把「未测」报成「跳过」。
- `dsh-plugin-docs --base` 收到全 0 SHA（新建分支或强推时 `github.event.before` 的值）不再崩在 `git diff`，改为按「无可比前态」给提示并跑完结构校验。
- `dsh-plugin-docs` 把 `Unreleased` 段纳入版本段/分类段/条目数比较——它是每轮改动最多的段落，此前完全不在检查范围内。
- 补齐测试：两个诊断 bin 的进程级行为、`dist/loopback.js` / `dist/guard.js` 与新片段的判定行为、一条 `FRAGMENTS` 完整性断言，并为上述行为各补对照用例。
- 维护：CI 改 `npm ci --ignore-scripts` 并启用缓存、两处都跑 `docs:check`，语法检查覆盖 `bin` 与 `dist`，`publish.yml` 加「tag 必须是 `main` 的祖先」闸门，补齐 `homepage`、`bugs`、`author`；本包零依赖，故开始跟踪 `package-lock.json` 以满足 `npm ci` 与缓存（理由见 `.gitignore`）。

## 0.5.1 - 2026-09-25

- 修复 launcher 热重载后消失：归属从一次性闩锁改为可释放的认领，owner 被销毁时唤醒其余副本重新注册，不再需要刷新整页。

## 0.5.0 - 2026-09-24

- 新增 `dist/launcher.js`（标记 `dsh-utility-launcher`）：左下角一个图标，点开一个列出各插件面板的菜单，走宿主的槽位而不是页面级协议。每页只有一份装配（先加载的一方赢得 `window` 互斥并声明菜单座位 `createhelper.utility.item`），其余副本各往那个座位投一行；消费方用 `launcher:sync` / `launcher:check` 维护。

## 0.4.0 - 2026-09-24

- 移除 `dist/bootstrap.js`（页面级 dock 引导片段）与其 `FRAGMENTS` 条目：它给每个消费插件在 `document.body` 上挂一个自量位置的 `position:fixed` 容器，必然浮在页面之上、压住 composer 自己的控件。消费方改为注册宿主的 `sidebar.footer.action` 座位，`lib/client.js` 不再嵌片段，各仓的 `dock:sync` / `dock:check` 随之删除。
- 两个 host 侧片段（loopback 判定、host 守卫）字节未变，消费方仍可 pin `0.3.0`，`loopback:check` / `guard:check` 继续按该版本比对。

## 0.3.0 - 2026-09-22

- 新增 `dsh-plugin-docs`：双语文档结构校验，收编自插件仓里各自维护的 `check-docs.mjs`。接口不变：无参数查 README 与 CHANGELOG 的中英结构对齐，`--base <revision>` 检查双语对同改。本包自身的双语文档也由此接入校验。
- README 补上 badges 与包定位说明；两个诊断 bin（`dsh-plugin-parity`、`dsh-plugin-docs`）的用途与接入方式补进文档；包描述同步「族级共享资产」的定位。

## 0.2.0 - 2026-09-21

- 新增 `dsh-plugin-parity`：跨仓漂移诊断，收编自插件仓里各自维护的那份脚本。成员表由调用方通过 `--member <repo>:<export>` 提供，本包不点名任何仓；不带 `--member` 时只跑静态检查，自动发现所有嵌入了宿主守卫块的仓。
- 插件仓里的该脚本由此删除；`docs:check` 的双语结构校验仍归各仓。

## 0.1.8 - 2026-09-21

- 两个 host 侧片段的注释去掉 `sibling`，改为直接陈述设计目标：插件独立发布，不依赖同级安装。

## 0.1.7 - 2026-09-20

- 两个 host 侧片段的注释不再声明消费方数量（「all three plugins」「diverged three times」等改为不指名、不计数的说法）：片段逐字嵌入消费者的仓库，那里的读者无从得知有几个消费方。

## 0.1.6 - 2026-09-20

- 修正 `dist/guard.js` 里 `allowRemoteHost` 的行内注释：原文写作「不再被放行」，与代码相反——该模式是跳过这两项检查，即放行。

## 0.1.5 - 2026-09-17

- 文档维护：README 与 CHANGELOG 的整理，片段与命令行为不变，故无需改动消费仓的 pin。

## 0.1.4 - 2026-09-16

- README 新增「跨仓一致性」一节：本地由消费仓 `npm test` 的 `loopback:check` / `guard:check` 逐字节比对，跨仓由消费仓 pin 精确版本保证。
- 该节记录 `scripts/guard-parity.mjs` 是人工诊断工具而非 CI 门禁。
- LICENSE 版权署名统一为 `xswt442-cmd`。

## 0.1.3 - 2026-09-14

- 新增两个 host 侧片段：`dist/loopback.js`（`dsh-loopback-helpers`）导出回环判定谓词；`dist/guard.js`（`dsh-host-guard`）导出 `portOf`、`GUARD_REASONS`、`DEFAULT_GUARD_POLICY` 与内部的 `bindGuard()` 工厂，调用方以 `policy` 传入自己的错误码与文案。
- `sync` / `check` 处理目标文件中所有已标记的片段，按 `FRAGMENTS` 顺序自下而上应用。
- 修正 README 与包描述：说明两个 host 侧片段的职责、固定顺序与 `bindGuard` 不导出的原因。
- 新增测试：多块同步与幂等 `check`、块顺序、片段不引入 `import`/`require`、判据不被重复声明。

## 0.1.2 - 2026-09-06

- 修正 README 的 `npm run dock:embed` 示例：补上 `package.json` 缺失的 `dock:embed` 脚本，用法改为 `npm run dock:embed -- check|sync path/to/client.js`（npm 传参需要 `--` 分隔符，CLI 接受 `sync|check` 子命令而非 `--check`）。新增从双语 README 提取命令逐条执行的 smoke test，防止文档与脚本漂移。

## 0.1.1 - 2026-09-04

- 归一化 `register()` 的 `label`：缺省、空白或非字符串的 `label` 回退为 `id`，避免渲染出 `aria-label="undefined"`。

## 0.1.0

- Add the Mini Utility Dock protocol v1 bootstrap.
- Add `sync` and `check` commands for self-contained DSH client bundles.
- Validate icons, registration ownership, placement, and load-order behavior.
