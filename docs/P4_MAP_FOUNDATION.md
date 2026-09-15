# P4 Leaflet 离线地图基础

## 已完成

- 保留现有 BMW 仪表壳与四页结构，只替换 MAP 页内部的旧预览画布。
- 引入本地 Leaflet 1.9.4（BSD-2-Clause），不依赖 CDN。
- 服务器提供 `/vendor/leaflet/*` 与 `/maptiles/{z}/{y}/{x}.jpg`；瓦片仍只保留一份，不复制 53 MB 资产。
- 使用 `CRS.Simple` 和 Y 向下变换；按 fh6-tel 的两个实测点建立 `positionX/positionZ` 到地图坐标的独立轴标定。
- 地图实例只创建一次，切页仅 `invalidateSize`；每包更新车辆位置与 yaw 朝向。地图异常由单独订阅边界隔离，不中断仪表数据。
- P4 只建立地图底座。Free Roam 跟车镜头、可选漫游轨迹、Race 全赛道镜头与当前圈轨迹分别在 P5/P6 接入。

## 自动化与浏览器证据

- 50/50 测试通过，包括标定端点/中点、无效输入、航向环绕、Leaflet 单例适配器、JS/CSS/真实 JPEG 瓦片 HTTP 返回。
- 浏览器 MAP 页显示 `OFFLINE MAP READY`，Leaflet CSS/JS 均来自 localhost，视口内产生 4 个瓦片元素；四页切换不重建仪表壳。
- 当前浏览器验证使用合成预览，不等同于 FH6 真车数据验证。

## 尚未通过的门槛

- 尚未用 FH6 实际 324-byte UDP 包校验车辆落点、yaw 正负方向和持续驾驶抖动。
- 当前 SEA/EXE 构建没有完整静态资产复制/定位流程；开发服务器通过不代表打包版通过。
- 地图图像源自 MapGenie/FH6 相关素材，目前未找到明确的再分发许可。内部本地使用风险较低，但公开发布包含瓦片的仓库或二进制前必须取得授权，或改为用户自备/获准素材。

## 资产审计

- `reference-assets/maptiles` 与两个下载目录中的瓦片逐文件 SHA-256 一致：5,461 张，53,169,881 字节。
- 实际缩放层级为 z8–z14；运行时目前使用 z9–z14，路径顺序严格为 `{z}/{y}/{x}.jpg`。
- Leaflet 只需 JS、CSS、LICENSE；车辆图标使用 CSS `divIcon`，不依赖默认 marker 图片。
