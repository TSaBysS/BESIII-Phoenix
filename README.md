# BESIII Phoenix Quick Check

基于 [Phoenix Event Display](https://github.com/HSF/phoenix) 的 BESIII 探测器**事例与几何**可视化：从 BOSS **GDML** 生成多子探测器 JSON 几何，从 **REC（及 MC）ROOT** 导出 Phoenix 事例 JSON，在浏览器中叠加 **MDC/TOF/MUC/EMC 击中、重建径迹、EMC shower、MC truth** 等，并带 **PID 点选**与 **truth 几何匹配** 说明。

详细技术说明见 **[PROJECT_NOTES.md](PROJECT_NOTES.md)**（几何组件、REC 分支、truth/reco 绘制、坐标与 PID）。

---

## 目录结构

```
BESIII_PhoenixCheck/
├── scripts/
│   ├── bes3_visualize.sh       # prepare | prepare-event | prepare-mixed
│   ├── merge_phoenix_events.py # 合并多个事例 JSON
│   ├── prepare_geometry.py
│   ├── export_geometry.C
│   ├── prepare_events.py      # REC/MC → 事例 JSON
│   └── package_offline.sh
├── data/
│   ├── views/                 # 子探测器几何 .root.json
│   └── events/                # 事例 JSON；默认演示 event.mixed.json
│       └── ks_mc_pairs.txt    # KS.rec 中纳入 prepare-mixed 的 (run, event) 表
├── web/                       # 静态前端（Phoenix + Three.js 叠加层）
├── PROJECT_NOTES.md
└── README.md
```

---

## 快速开始

### 1. 准备探测器几何（一般只需一次）

```bash
bash scripts/bes3_visualize.sh prepare
```

**依赖**：ROOT（TGeoManager）、Python 3。

---

### 2. 转换事例数据

**单个 REC 或整目录**（输出默认 `data/events/event.rec.json`）：

```bash
bash scripts/bes3_visualize.sh prepare-event /path/to/file.rec
bash scripts/bes3_visualize.sh prepare-event /path/to/rec_dir/
```

**按 (runId, eventId) 列表筛选**（例如只抽 `KS.rec` 中部分事例）：

```bash
python3 scripts/prepare_events.py /path/to/KS.rec data/events/out.json --select data/events/ks_mc_pairs.txt
```

**合并「大量真实 REC + 小集合 MC」演示包**（Knunubar 目录 + `KS.rec` 子集 → `data/events/event.mixed.json`）：

```bash
bash scripts/bes3_visualize.sh prepare-mixed
```

可通过环境变量覆盖路径：`KNUNUBAR_REC_DIR`、`KS_REC_MC`、`KS_MC_PAIRS`（见 `bes3_visualize.sh` 注释）。

其它选项：`python3 scripts/prepare_events.py --help`。

---

### 3. 启动本地 Web 服务

```bash
cd BESIII_PhoenixCheck
python3 -m http.server 8010
```

浏览器打开：`http://127.0.0.1:8010/web/`

---

### 4. 网页端行为（当前版本）

- **默认加载**：几何就绪后自动 `fetch` **`../data/events/event.mixed.json`** 作为示范（可在 `index.html` 中改 `window.BES3_DEFAULT_EVENT_URL`）。若不需要：URL 加 **`?noDefault=1`** 或设置 `window.BES3_SKIP_DEFAULT_EVENT = true`。
- **上一例 / 下一例**：按当前下拉列表顺序切换事例。
- **快速跳转**：`run`（MC 负 run 可只填**绝对值**）与 `rec` 文件名片段，点「跳转」；两者可单独或组合使用。
- **导入其它 JSON**：仍支持按钮选择、区域点击、拖拽与全页拖放；**清空事例** 后回到仅几何视图。

---

### 5. 打包离线版本

```bash
bash scripts/package_offline.sh
```

---

## 子探测器视图

| 视图名 | 说明 |
|--------|------|
| `assembled_besiii` | MDC + TOF + MUC + EMC 拼装（默认） |
| `mdc` / `tof` / `muc` / `cgem` / `emc` | 单子探测器 |

在 `web/index.html` 里配置 `window.BES3_GEOMETRIES` 与 `window.BES3_SELECTED_VIEW`。

---

## 文档与维护

- **[PROJECT_NOTES.md](PROJECT_NOTES.md)**：几何层级、REC 分支表、truth/reco 与 MC truth **筛选规则**、坐标缩放、PID/truth 交互细节。
- 修改导出逻辑后，按需重新运行 **`prepare-event` / `prepare-mixed`** 或带 `--select` 的 `prepare_events.py`，再刷新网页验证。
