请在本仓库实现一个可在浏览器打开的「事件时间窗口聚合实验室」（禁止 Docker），并让 `npm test` 全部通过。

硬性需求：
1) 打开 `index.html`（`npm start` 或 `python3 -m http.server 8777 --directory .`）后：左侧事件流/水位线可视化，右侧控制面板；成功时 `#status` 为 `ready`。
2) 实现 `src/watermark.js` 的事件时间水位线：`WatermarkTracker` 根据乱序事件推进 watermark；允许 `allowedLatenessMs`；迟到事件计入 `#late-count`，不得污染已关闭窗口。
3) 实现 `src/window.js` 的滚动/翻滚窗口：`TumblingWindowAssigner` 与 `SlidingWindowAssigner`；按 `key` 分组；窗口关闭时产出聚合结果（count/sum/avg）。
4) 实现 `src/engine.js` 的 `StreamEngine`：接入 JSONL 事件（`fixtures/events.jsonl` 或面板粘贴）；按事件时间处理；关闭窗口写入结果列表；`#stats` 显示 watermark、已关闭窗口数、迟到数。
5) 实现 `src/ui/controls.js` 的 bindControls：可调窗口大小、滑动步长、allowedLateness；`Load fixtures` 加载样例；`Run` 跑完引擎；`Export JSON` 下载结果。
6) 修正骨架中故意留空/写错的逻辑，使 `npm test` 全绿；不要 Docker；不要改弱 `tests/*.test.js`；保持原生 ESM。

重要：用多个短 shell 命令分别写入各个文件（每次只写一个文件），避免单次超长输出；写完立刻 `npm test`，失败再修，直到通过。
