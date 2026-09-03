# dsh-mini-utility-dock

DSH 插件共享的 utility dock：提供一个 canonical classic-script 片段，并在构建时嵌入插件的 `client.js`。

## 使用

在目标文件中放置标记：

```js
  // <dsh-mini-utility-dock>
  // </dsh-mini-utility-dock>
```

然后运行：

```sh
npx dsh-mini-utility-dock sync path/to/client.js
npx dsh-mini-utility-dock check path/to/client.js
```

`sync` 保留标记及其缩进；`check` 在内容漂移时以非零状态退出。内嵌脚本通过 global protocol v1 在页面内去重，插件仍可单独运行。

也可用本仓库脚本同步（不硬编码任何消费仓路径，目标由调用方传入）：

```sh
npm run dock:embed -- check path/to/client.js  # 仅校验，漂移时非零退出
npm run dock:embed -- sync path/to/client.js   # 写入标记之间
```

注册时若 `label` 缺省、空白或非字符串，会回退为 `id` 作为可访问名称，避免 `aria-label="undefined"`。
