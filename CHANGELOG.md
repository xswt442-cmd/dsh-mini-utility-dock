# Changelog

## Unreleased

- 修正 README 的 `npm run dock:embed` 示例：补上 `package.json` 缺失的 `dock:embed` 脚本，用法改为 `npm run dock:embed -- check|sync path/to/client.js`（npm 传参需要 `--` 分隔符，CLI 接受 `sync|check` 子命令而非 `--check`）。新增从双语 README 提取命令逐条执行的 smoke test，防止文档与脚本漂移。

## 0.1.1 - 2026-09-04

- 归一化 `register()` 的 `label`：缺省、空白或非字符串的 `label` 回退为 `id`，避免渲染出 `aria-label="undefined"`。

## 0.1.0

- Add the Mini Utility Dock protocol v1 bootstrap.
- Add `sync` and `check` commands for self-contained DSH client bundles.
- Validate icons, registration ownership, placement, and load-order behavior.
