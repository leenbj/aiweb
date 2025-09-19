# 服务器脚本

本目录收录部署及运维相关的实用脚本。

## merge-template-patches.ts

AI 流水线在生成模板时会输出 `package-patch.json`，其中包含：

- `addDependencies`：需要写入 `package.json` 的依赖列表；
- `existingConflicts`：当前项目中已存在但版本冲突的依赖；
- `stylePatch`：需要追加到前端样式文件的片段；
- `warnings`：合并时的注意事项。

`merge-template-patches.ts` 用于解析上述结果并合并到目标项目，默认只执行 **dry-run**。需要 Node.js ≥ 18，并建议通过 `npx ts-node` 运行。

```bash
# 预览变更（默认 dry-run）
npx ts-node server-scripts/merge-template-patches.ts \
  --input ./pipeline-output/2025-09-18 \
  --target ./frontend

# 实际落地变更
npx ts-node server-scripts/merge-template-patches.ts \
  --input ./pipeline-output/2025-09-18 \
  --target ./frontend \
  --apply
```

常用参数说明：

| 参数             | 说明                                                  |
| ---------------- | ----------------------------------------------------- |
| `-i, --input`    | 包含 `package-patch.json` 的目录，默认当前目录。      |
| `-t, --target`   | 需要合并的项目根目录（含 `package.json`）。           |
| `-p, --patch`    | 指定 patch 文件路径，默认 `<input>/package-patch.json` |
| `-a, --apply`    | 执行实际写入，未指定时仅打印建议（dry-run）。         |

执行 `--apply` 时脚本会：

1. 将缺失的依赖合并进 `package.json`（按名称排序）；
2. 将样式片段追加到对应文件（如文件不存在会自动创建）；
3. 输出冲突与告警，需手动处理的依赖版本不会自动覆盖。

合并后请务必手动执行 `npm install`、`npm run build` 或相关校验命令，确保依赖和样式变更可用。

