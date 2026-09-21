# 更新日志

Release Notes 由对应版本段生成；最新版本在前。
英文版见 [CHANGELOG.en.md](CHANGELOG.en.md)。

## 0.3.0 - 2026-09-22

- 新增 `dsh-plugin-docs`：双语文档结构校验，收编自插件仓里各自维护的 `check-docs.mjs`。接口不变：无参数查 README 与 CHANGELOG 的中英结构对齐，`--base <revision>` 检查双语对同改。本包自身的双语文档也由此接入校验。
- README 补上 badges 与包定位说明；两个诊断 bin（`dsh-plugin-parity`、`dsh-plugin-docs`）的用途与接入方式补进文档；包描述同步「族级共享资产」的定位。

## 0.2.0 - 2026-09-21

- 新增 `dsh-plugin-parity`：跨仓漂移诊断，收编自插件仓里各自维护的那份脚本。成员表由调用方通过 `--member <repo>:<export>` 提供，本包不点名任何仓；不带 `--member` 时只跑静态检查，自动发现所有嵌入了宿主守卫块的仓。
- 插件仓里的该脚本由此删除；`docs:check` 的双语结构校验仍归各仓。

## 0.1.8 - 2026-09-21

- 两个 host 侧片段的注释不再出现 `sibling`：三处改为陈述设计目标本身——插件独立运行，不依赖同级安装。片段会逐字嵌入消费仓，那个词在那里没有可指对象。
- 片段字节因此变化，消费仓需重新运行 `loopback:sync` / `guard:sync` 并把 pin 升到 0.1.8。

## 0.1.7 - 2026-09-20

- 两个 host 侧片段的注释不再带消费仓数量：「all three plugins」「the three disagree」「the three plugins / diverged three times」改为不指名、不计数的说法。片段会逐字嵌入消费仓，那里的读者无从得知存在几个消费方，计数是工作区知识而非该仓知识。
- 片段字节因此变化，消费仓需重新运行 `loopback:sync` / `guard:sync` 并把 pin 升到 0.1.7。

## 0.1.6 - 2026-09-20

- 修正 `dist/guard.js` 里 `allowRemoteHost` 的说明文字：原文写作「不再被放行」，与代码相反——开启该模式时这两项检查被跳过，即被放行。JSDoc 一直是对的，只有这处行内注释写反。
- 该片段的字节因此变化，消费仓需重新运行 `guard:sync` 并把 pin 升到 0.1.6。

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
