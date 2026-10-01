# P5 / P6 第一轮实施记录

日期：2026-09-09

## 成熟方案输入

`C:\Users\liang\Downloads\LapScope-main`已整理到`references/LapScope/`。本项目只参考其事件状态机、路线指纹、catalog与迁移/回填测试思路，不运行其Python服务，也不复制其UI。下载包无`.git`，因此当前记录为未定版main快照，正式实质移植前仍要固定上游commit。

## P5 当前边界

新增EventDetector作为影子诊断层。`isRaceOn`不再单独构成Race证据；排名、有效且推进的圈时、圈数变化可形成事件证据，并分别执行进入/退出防抖。检测结果随runtime state和telemetry输出，但手动模式仍是权威源，AUTO接管必须等待真实FH6抓包回放通过后才开启。

## P6 已完成

- Race：采集并显示当前圈轨迹；换圈清空当前线段但保留Session累计范围；相机按完整bounds节流fit。
- Free Roam：默认跟车；用户拖动地图后暂停；FOLLOW执行一次平滑追车后回到低成本更新；轨迹显示可独立开关。
- 地图页：沿用同一Leaflet实例，并提供Free Roam的FOLLOW、TRACE、Rec/Stop入口。
- 稳定性：轨迹点有数量上限、最小采样距离及跳点/倒时/长间隔断点；地图订阅异常不影响仪表、SSE或Session。

## UI反馈修正

MAP画面经截图复核最终设为中央区域约34%宽、48%高，并下移到24%：比初版略大，同时避开左右仪表内侧刻度和底部圈速托盘。XYZ和HEADING文字行已移除，但positionX/positionZ/yaw仍保留在内部数据层，用于画轨迹、定位和车辆标记旋转。

## 验证

Node自动化65/65通过。浏览器验证本地瓦片加载、放大布局以及合成324-byte UDP车辆落点。尚未完成：真实FH6长驾、AUTO有效模式切换、SQLite存储、路线catalog识别、Best/Ghost/Delta。
