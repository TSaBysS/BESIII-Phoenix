# BESIII Phoenix Quick Check

基于 [Phoenix Event Display](https://github.com/HSF/phoenix) 的 BESIII 探测器事例可视化工具。

---

## 目录结构

```
BESIII_PhoenixCheck/
├── scripts/                  # 数据准备脚本
│   ├── bes3_visualize.sh     # 总控脚本（几何准备 / 事例转换 / 启动服务）
│   ├── prepare_geometry.py   # GDML 几何预处理（近似化 + MDC 视图拆分）
│   ├── export_geometry.C     # ROOT 宏：GDML → ROOT JSON；MUC strip map 导出
│   ├── prepare_events.py     # REC 文件 → Phoenix 事例 JSON 转换
│   └── package_offline.sh    # 打包离线版本
│
├── web/                      # 前端页面
│   ├── index.html            # 主页面入口
│   ├── app.js                # 应用入口：协调各模块初始化与交互
│   ├── loader.js             # 探测器几何配置、Phoenix 加载、透明度控制、回退渲染器
│   ├── event-renderer.js     # Track / Hit / Shower 绘制与样式
│   ├── pid-interaction.js    # PID 鼠标交互（悬停提示、点选、信息面板）
│   ├── pid-tools.js          # PID 概率计算工具函数
│   ├── timeline.js           # 动画时间轴逻辑
│   ├── truth.js              # MC truth 轨迹匹配与动量估计
│   └── assets/               # 图标等静态资源
│
├── data/                     # 运行时数据（由脚本生成，不入版本库）
│   ├── views/                # 各子探测器几何 JSON 文件
│   └── events/               # 事例数据 JSON 文件
│
├── PROJECT_NOTES.md          # 技术细节：几何组件、数据字段、绘制逻辑等
└── README.md                 # 本文件
```

---

## 快速开始

### 1. 准备探测器几何（仅需运行一次）

```bash
bash scripts/bes3_visualize.sh prepare
```

此命令会依次完成：
1. 导出完整 Bes 几何（JSROOT 用）
2. 导出 TOF、MUC、CGEM 几何
3. 导出 MUC strip 位置图（用于 hit 定位）
4. 近似化 MDC 几何（twistedtubs → tube）并拆分内外室视图
5. 近似化 EMC 几何（irregBox → box）

**依赖**：ROOT（含 TGeoManager）、Python 3

---

### 2. 转换事例数据

将 BESIII REC ROOT 文件转换为 Phoenix 可读的 JSON 格式：

```bash
# 单个 REC 文件
bash scripts/bes3_visualize.sh prepare-event /path/to/run.rec

# 整个目录下所有 REC 文件
bash scripts/bes3_visualize.sh prepare-event /path/to/rec_dir/

```

输出到 `data/events/event.rec.json`。

也可以直接调用 Python 脚本（更多选项）：

```bash
python3 scripts/prepare_events.py --help
```

主要参数：
- `rec_file`：输入 REC 文件路径
- `output_json`：输出 JSON 文件路径
- `--rec-dir DIR`：从目录批量读取多个 REC 文件
- `--select FILE`：按 `(runId, eventId)` 对列表筛选指定事例

---

### 3. 启动本地 Web 服务

```bash
bash scripts/bes3_visualize.sh serve
# 或指定端口
bash scripts/bes3_visualize.sh serve 8080
```

然后在浏览器打开：`http://127.0.0.1:8010/web/`

---

### 4. 切换探测器视图（可选）

默认显示完整拼装几何（assembled_besiii）。切换到单个子探测器：

```bash
bash scripts/bes3_visualize.sh view mdc
bash scripts/bes3_visualize.sh view emc
bash scripts/bes3_visualize.sh view tof
bash scripts/bes3_visualize.sh view muc
bash scripts/bes3_visualize.sh view cgem
bash scripts/bes3_visualize.sh view assembled_besiii   # 恢复默认
bash scripts/bes3_visualize.sh list                    # 列出所有视图
```

---

### 5. 导入事例数据（网页端）

启动后网页初始化时**不会自动加载事例**，探测器几何加载完成后：

1. 点击左侧 **「导入事例」** 区域的 **「选择文件」** 按钮，选取本地 `*.json` 事例文件
2. 或直接将 JSON 文件**拖拽**到网页任意位置
3. 点击 **「清空事例」** 可清除当前事例数据，回到纯探测器几何视图

事例文件由 `scripts/prepare_events.py` 生成（格式为 Phoenix JSON）。

---

### 6. 打包离线版本

```bash
bash scripts/package_offline.sh
```

---

## 子探测器视图说明

| 视图名 | 说明 |
|--------|------|
| `assembled_besiii` | MDC + TOF + MUC + EMC 拼装全景（默认） |
| `mdc` | 主漂移室（含近似导线层，twistedtubs→tube） |
| `tof` | 飞行时间探测器（桶部 + 端盖） |
| `muc` | μ子鉴别器（包含 strip 位置图） |
| `cgem` | 柱形气体电子倍增探测器 |
| `emc` | 电磁量能器（含桶部 + 端盖，irregBox→box） |

详细技术说明见 [PROJECT_NOTES.md](PROJECT_NOTES.md)。
