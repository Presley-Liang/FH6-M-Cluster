# 上游来源与本地整理

整理日期：2026-09-08

## 工作项目基底

- 上游：<https://github.com/viunow/fh6-telemetry>
- 本地下载源：`C:\Users\liang\Downloads\fh6-telemetry-main`
- 整理位置：项目根目录
- 许可证：MIT，Copyright 2026 Vinícius Neto

已复制 `src/`、`assets/`、包管理与构建文件、README、LICENSE 和环境配置。没有导入 `dist/` 中可重新生成的 EXE、ZIP、SEA blob。

## 地图实现参考

- 上游：<https://github.com/TheBanHammer/fh6-tel>
- 本地下载源：`C:\Users\liang\Downloads\fh6-tel-main`
- 整理位置：`references/fh6-tel/`
- 许可证：MIT，Copyright 2025 BanHammer

关键参考文件：`mapCrs.ts`、`mapDefaults.ts`、`MapPanel.svelte`、`MapCalibrator.svelte`。

## 离线瓦片及稳定性参考

- 上游：<https://github.com/potchin/fh6-web>
- 本地下载源：`C:\Users\liang\Downloads\fh6-web-main`
- 整理位置：`references/fh6-web/`
- 许可证：仓库根目录没有 LICENSE

`fh6-web` 代码仅用于本地行为审计，不直接复制到发布实现。两个地图下载包各带一套相同规模的瓦片：5,461 个文件、53,169,881 字节。项目只保留一份共享副本：`reference-assets/maptiles/`，目录协议为 `{z}/{y}/{x}.jpg`。

瓦片源自第三方地图服务，其再分发权没有随代码许可证明确授予。内部开发可使用本地副本，正式发布前必须核对素材许可。

三个下载目录均无 `.git` 元数据，无法从本地包确定 commit SHA。实施前需核对远端 HEAD 或 release tag。

## Event / Route / SQLite 成熟方案参考

- 上游：<https://github.com/darcane/LapScope>
- 本地下载源：`C:\Users\liang\Downloads\LapScope-main`
- 整理位置：`references/LapScope/`
- 许可证：MIT，Copyright 2026 Erdem Darcan
- 整理日期：2026-09-09

完整源码、测试和文档作为行为证据保留，但不运行其 Python 服务，也不复制其 Dashboard UI。重点参考 `app/recorder/laps.py`、`app/recorder/store.py`、`app/tracks.py`、`app/track_catalog.json`、`docs/wiki/Event-Detection.md`、`tests/test_scenarios.py` 与 `tests/test_tracks.py`。当前项目继续使用 Node、既有324-byte parser、JSONL/JSON记录和BMW UI，只按模块职责移植已验证的事件/路线思想。

下载包同样没有 `.git` 元数据，因此无法从本地证明精确commit。正式移植代码前需记录远端commit或固定release；任何实质性移植均保留MIT声明和来源注释。
