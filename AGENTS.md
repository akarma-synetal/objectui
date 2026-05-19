# Agent Rules

- 截图/trace 一律存 `/tmp/`,任务尾清理。禁止写入仓库根。
- `.gitignore` 已锚定 `/*.png` 等防兜底,但仍要主动清。
- 任务结束:停后台服务(`lsof -i :PORT -t`)、清 `.playwright-mcp/`。

## Important

do not make big edits of more than ~20000 bytes or so. If it fails, break one edit down to multiple smaller ones.
