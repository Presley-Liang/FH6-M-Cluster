# P8 路线识别第一轮

日期：2026-09-09

## 已完成

- 从完成Race归档按归一化DistanceTraveled每25单位抽样，原始JSONL/JSON包不降采样。
- Rewind按race time移除失效未来；含teleport的圈拒绝用于识别；未完成圈、样本不足和非有限坐标均闭锁。
- 输出起点、DistanceTraveled范围、X/Z跨度和样本数；DistanceTraveled明确只作归一化签名，不解释为米。
- 按LapScope阈值匹配77条目录：起点半径120m、距离签名±5%、X/Z跨度各自允许`max(15%, 50m)`。
- 唯一候选写`matched`，多候选写`ambiguous`且不猜，无候选写`unknown`；结果、候选和置信度进入SQLite。

## 尚未完成

- 已知路线的完整outline缓存和提前显示。
- Best/Ghost/Delta按route和车辆关联。
- 真实FH6多车辆、多走线和共享起点赛事验证。

以上属于P8第一段完成，不代表P8整体完成。

## 第二段：Outline / Best / Ghost / Delta

- 完成圈可生成`0..1000`屏幕坐标轮廓：空间距离抽样、Z轴翻转、首尾保留、最多600点；Rewind沿用有效时间线，teleport和异常圈拒绝缓存。
- 唯一匹配路线将轮廓写入SQLite的`outline_json`；目录重新灌入时不会覆盖已有轮廓。
- SQLite支持路线总榜与可选同车Best查询，按圈时、Session和圈号稳定决胜。
- `/route-best?routeId=&carOrdinal=`返回最佳圈索引；`/ghost?routeId=&carOrdinal=`从原始归档生成有界Ghost及Delta timing points。
- `LiveDeltaTracker`支持二分插值、ahead/behind/even、换圈回绕、stale、样本缺口、Rewind/teleport/倒退闭锁，不外推也不猜测。

第二段后端与纯计算层已完成。

## 第三段：实时Runtime与现有UI接入

- Race热路径使用独立有界识别器，达到最小样本/进度后才调用纯匹配器；只发布唯一匹配，状态字段为`activeRoute`。
- catalog key由可选SQLite索引解析为route id；SQLite失效时保持unknown，不阻断UDP、SSE、Session或JSON。
- MAP标题显示路线名；归一化outline使用容器SVG显示，Ghost真实X/Z才经标定投影到Leaflet，二者不会混用坐标系。
- Delta在MAP左下角显示，并复用DRIVE现有副标题；请求按Session/route/car key去重并用序号丢弃过期响应。
- 同车Best缺失时回退路线全局Best；无参考、stale、ambiguous、unknown和Free Roam均明确降级。

P8开发态代码集成完成。剩余真实FH6多车辆、多走线、共享起点赛事和长时间稳定性验证移入P11；在真机证据完成前不宣称P8真实驾驶终验通过。
