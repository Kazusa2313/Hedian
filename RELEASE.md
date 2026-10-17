# RELEASE · Hedian_20260909_225919

> 基于 `Hedian`（基线版本）的改动发布说明。每项变更的完整论证过程、日志摘录与
> 回退方法见仓库内 `CHANGELOG.md`；本文记录**改了什么、为什么改、涉及哪些文件**。

| 项 | 说明 |
|------|------|
| 基线版本 | `Hedian`（核电站监护制合规检测系统） |
| 本版本 | `Hedian_20260909_225919` |
| 变更范围 | 变更 1 ~ 变更 17（普通沟通 / 语音转写 / 监护制 / 前端 / 工程清理） |
| 部署差异 | 部署方式、目录结构、启动命令与基线完全一致，见 `README.md`；模型权重与输入视频不随仓库发布，需自行放置于 `models/` 与 `data/` |
| 提交规范 | 遵循 Conventional Commits（`feat(rules): ...` / `fix(voice): ...` 等） |

---

## 变更总览

| # | 主题 | 类型 | 主要涉及文件 |
|---|------|------|--------------|
| 1 | 新增"普通沟通"流程 | 新功能 | `rules/normal_comm_rule.py`（新建）、`config.yaml`、`frontend/src/types.ts`、`frontend/src/composables/useNotify.ts` |
| 2 | "请监护"标红 + 监护制启动白名单 | 修复 | `modules/voice/speech_transcriber.py`、`rules/supervision_rule.py` |
| 3 | GPU 显存分配调整（运行配置） | 配置 | `config.yaml`（`gpu_map.evaluation: "1"→"0"`） |
| 4 | 普通沟通超时改用独立计时器，移除 tracker 依赖 | 修复 | `rules/normal_comm_rule.py` |
| 5 | 语音转录 VAD 分段改造（方案 A） | 重构 | `modules/voice/speech_transcriber.py`、`modules/voice/voice_module.py`、`config.yaml` |
| 6 | 普通沟通 15s 窗口改在视频时间轴上判定 | 修复 | `modules/voice/speech_transcriber.py`、`modules/voice/voice_module.py`、`rules/normal_comm_rule.py` |
| 7 | 普通沟通最长时长 15s → 30s | 配置 | `config.yaml` |
| 8 | 修复 PoseEMAFilter 缺失方法致 tracker 崩溃 | 修复 | `modules/behavior/behavior_utils.py` |
| 9 | 语音转录改为流式流水线（增量读音频 + 在线切片 + 跨段成句） | 重构 | `modules/voice/streaming_source.py`、`modules/voice/segmenters.py`、`modules/voice/sentence_assembler.py`（均新建）、`modules/voice/speech_transcriber.py`、`modules/voice/voice_module.py`、`config.yaml` |
| 10 | 测试输入视频切换为 segment002.mpg | 配置 | `config.yaml`（`videos.front/pop`） |
| 11 | 同句应答：修复岗位词/"请讲"/"收到"同句时确认信号被丢弃 | 修复 | `modules/voice/voice_module.py`、`modules/voice/speech_transcriber.py` |
| 12 | 岗位词被句边界切开：保护词跨断点拼接 + 断句阈值去倒挂 | 修复 | `modules/voice/sentence_assembler.py`、`modules/voice/speech_transcriber.py`、`modules/voice/voice_module.py`、`config.yaml` |
| 13 | 普通沟通：窗口 30s→50s + 被新沟通顶掉 + 超时收尾不再吞事件 | 修复 | `rules/normal_comm_rule.py`、`config.yaml` |
| 14 | 前端流程通知同秒排序：先"结束"后"开始"，按 flow_id 区分"被顶掉"与"同句应答" | 修复 | `frontend/src/types.ts`、`frontend/src/composables/useNotify.ts`、`frontend/dist/**`（重新构建） |
| 15 | 语音段间左上下文实验 0.4s→2.0s + 新增 A/B 对比工具 `tools/asr_ab.py` | 实验（已回退） | `modules/voice/speech_transcriber.py`、`config.yaml` |
| 16 | 回退变更 15：`boundary_overlap_sec` 2.0s→0.4s，删除 A/B 工具与产物 | 回退 | `config.yaml`、`tools/asr_ab.py`（删除） |
| 17 | 删除批处理流水线（辅助链路），语音转写仅保留流式流水线 | 清理 | `modules/voice/voice_module.py`、`modules/voice/speech_transcriber.py`、`config.yaml` |

---

## 变更明细

### 变更 1：新增"普通沟通"流程（新功能）

- **新增** `rules/normal_comm_rule.py`：普通沟通流程状态机——岗位词（一回路/二回路/
  机组长）后 3s 内出现"请讲"即开始，"收到"或超时结束。
- `config.yaml` 增加 `rules.normal_comm` 开关；前端 `types.ts` / `useNotify.ts`
  支持流程通知展示。

### 变更 2："请监护"标红 + 监护制启动白名单（修复）

- `speech_transcriber.py`：`KEYWORD_LABELS` 中 `("请监护", "请求监护")` 改为
  `("请监护", "请监护")`，避免"请监护"被归一化为"请求监护"造成重复事件。
- `supervision_rule.py`：监护制启动白名单改为 `["请监护", "请求监护"]`；设备码
  排除表加入 `"请监护"`。

### 变更 3：GPU 显存分配调整（配置）

- `config.yaml`：`gpu_map.evaluation` 由 `"1"` 改为 `"0"`，评估模型与 tracker 同卡，
  规避单卡环境下显存溢出。

### 变更 4：普通沟通超时改用独立计时器（修复）

- `rules/normal_comm_rule.py`：移除对 `TRACKER_PROXIMITY` / `BEHAVIOR_HAND_RAISED`
  事件的超时驱动，改为 `threading.Timer` 独立计时器；结束时间精确为
  `flow_start_sec + 窗口`（视频时间轴），不再依赖 tracker 心跳与事件驱动。

### 变更 5：语音转录 VAD 分段改造（重构）

- `speech_transcriber.py`：删除 librosa 加载 / noisereduce 降噪 / RMS 尾部截尾与
  20s 滑窗 + midpoint 去重；新增 ffmpeg `silencedetect` VAD 整文件分段
  （-35dB / 0.8s / pad 0.2s / min 0.35s / chunk 30s）；解码参数对齐评估链路
  （贪心 + `no_repeat_ngram_size=3`）；保留 ForcedAligner 字级时间戳与 OpenCC 繁转简。
- `config.yaml` 新增 5 个 VAD 参数项。

### 变更 6：15s 窗口改在视频时间轴上判定（修复）

- "收到"提前结束与超时关闭的判定均以**视频时间轴**（`localSec`）为准，消除
  处理时间与视频时间的错位。

### 变更 7：普通沟通最长时长 15s → 30s（配置）

- `config.yaml` 调整窗口时长。

### 变更 8：修复 PoseEMAFilter 缺失方法（修复）

- `behavior_utils.py`：`PoseEMAFilter` 新增 `remove(track_id)` 与 `clear()`，
  修复目标消失时 tracker 进程崩溃。

### 变更 9：语音转录改为流式流水线（重构，本版本核心变更）

- **新增** `streaming_source.py`（ffmpeg 管道增量读 PCM / 环形缓冲 / 直播源判定）、
  `segmenters.py`（可插拔在线切片策略：silence_vad / fixed_window）、
  `sentence_assembler.py`（跨段全局词流成句，保护词不可切分）。
- `speech_transcriber.py` 新增 `transcribe_stream()`：边读边切边解码，段闭合即回调，
  段间左上下文重叠，首结果无需等待整段音频。
- `voice_module.py` 按 `voice.pipeline` 分流接入；`config.yaml` 暴露流式与切片参数。

### 变更 10：测试输入视频切换（配置）

- `videos.front/pop` 切换为 `segment002.mpg`。

### 变更 11：同句应答修复（修复）

- 同句内"岗位词→请讲→收到"的关键词按**句中出现位置**排序输出（而非关键词表顺序），
  并把同句全部关键词随事件下发，规则层据此识别同句应答，不再空等超时。

### 变更 12：岗位词跨断点拼接（修复）

- `sentence_assembler.py` 增加保护词机制：断句点不得落在保护词（岗位词、复合关键词）
  内部；`sentence_gap_sec` 0.6→1.0 且须 ≥ `vad_min_silence_sec`，消除
  "句边界比段边界更敏感"导致的岗位词被切分。

### 变更 13：普通沟通窗口与顶掉逻辑（修复）

- 窗口 30s→50s；活跃流程被新沟通顶掉时正确收尾；超时收尾不再吞掉后续事件。

### 变更 14：前端流程通知同秒排序（修复）

- 同一秒内先推"结束"后推"开始"，并按 `flow_id` 区分"被顶掉"与"同句应答"，
  消除前端通知闪跳；`frontend/dist` 重新构建。

### 变更 15 / 16：左上下文实验与回退（实验）

- 变更 15 将段间左上下文 0.4s→2.0s 并新增 `tools/asr_ab.py` 做受控对比；
  结论为关键词命中下降且收益有限，**变更 16 完整回退**（含工具与产物删除），
  `boundary_overlap_sec` 恢复 0.4s。

### 变更 17：删除批处理流水线（清理，本版本最新变更）

- **背景**：变更 9 后旧整文件批处理路径以 `voice.pipeline` 开关保留（标称用途：
  回退与 A/B 对比）。运行历史核查（45 场 run.log）证实流式上线后批处理 **0 次执行**，
  且变更 16 已确认无需保留 A/B 能力，故整链删除。
- `voice_module.py`：删除 `_process_video_legacy`（旧批处理路径）、`_extract_audio`
  及 `subprocess` 导入；`process_video` 固定调用流式实现。
- `speech_transcriber.py`：删除批处理核心 `transcribe()`、`_extract_segment`、
  `_detect_speech_intervals`、`SILENCE_EVENT_PATTERN`；**保留**流式路径仍在用的
  `_probe_duration`。
- `config.yaml`：删除 `voice.pipeline` 开关。
- **行为变化：无**（批处理链路删除前从未在实际运行中启用，流式链路代码路径与
  输出不受影响）。实测验证：`segment002.mpg`（1529.9s）流式转写产出
  123 段 / 3521 词 / 258 事件 / 90 关键时刻，RTF≈0.066。

---

## 本版本配置差异（相对基线 Hedian）

| 配置项 | 基线 | 本版本 | 说明 |
|---|---|---|---|
| `gpu_map.evaluation` | `"1"` | `"0"` | 变更 3，单卡环境防显存溢出 |
| `videos.front/pop` | `our_equip_v2.mp4` | `segment002.mpg` | 变更 10，测试视频切换（绝对路径，部署时按自有视频修改） |
| `rules.*` | 无 normal_comm | 新增 `normal_comm` 等开关 | 变更 1 |
| `voice.*` VAD / 流式 / 切片参数 | 无 | 新增多组参数 | 变更 5 / 9 / 12 |

> ⚠️ 部署前请核对 `config.yaml` 中 `videos.*` 与 `voice.model_path` /
> `aligner_path` 指向真实文件（模型命名差异见 `README.md`"准备资源"一节）。

## 已知问题（未修复）

1. 裸"监护"二字仍会触发监护制（`("监护", "请求监护")` 子串匹配），误触发风险。
2. 300s 超时关闭后无法立即重新开始（模块速度差导致的启动请求被吞）。
3. Redis 为多用户共用时，`/start` 的 `flushdb` 会清空同 db 全部 key——建议使用
   **专用 Redis 实例**（`README.md` 同样强调此点）。

## 验证记录（变更 17）

1. `python -m py_compile modules/voice/voice_module.py modules/voice/speech_transcriber.py` 通过。
2. 全项目无 `_process_video_legacy` / 批处理 `transcribe(` / `voice.pipeline` 残留引用。
3. 实机运行 `segment002.mpg`：日志出现 `开始流式语音转文字`，流式转录完成
   （123 段 / 3521 词），关键词时刻与规则层判定正常产出。
