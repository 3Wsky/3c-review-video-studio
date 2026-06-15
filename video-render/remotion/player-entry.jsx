// 网页 <Player> 实时预览入口：把同一套 Remotion 合成（ReviewVideo）用 @remotion/player
// 嵌进纯静态导演台。esbuild 打成单文件 IIFE（见 build-player.mjs），index.html 懒加载，
// 暴露一个全局工厂 window.Mount3CRemotionPlayer。
//
// 用法（app.js）：
//   const handle = window.Mount3CRemotionPlayer(containerEl, { timeline, format, assetMap });
//   handle.update({ timeline, format, assetMap });  // 改文案/时长/排序后即时刷新
//   handle.unmount();
//
// 预览与出片像素一致：两边都用 src/ReviewVideo.jsx + src/scene-model.jsx 的 buildComposition。

import React from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";
import { ReviewVideo } from "./src/ReviewVideo.jsx";
import { buildComposition } from "./src/scene-model.mjs";

function inferAssetKinds(assetMap) {
  const kinds = {};
  for (const [name, url] of Object.entries(assetMap || {})) {
    kinds[name] = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || "")) ? "video" : "image";
  }
  return kinds;
}

function PlayerWrap({ timeline, format, assetMap, assetKinds }) {
  const comp = buildComposition(timeline, format);
  const kinds = assetKinds || inferAssetKinds(assetMap);
  // 画幅自适应容器宽度（保持合成的真实宽高比由 compositionWidth/Height 决定）
  return (
    <Player
      component={ReviewVideo}
      inputProps={{ timeline, format, assetMap, assetKinds: kinds }}
      durationInFrames={comp.durationInFrames}
      compositionWidth={comp.width}
      compositionHeight={comp.height}
      fps={comp.fps}
      style={{ width: "100%", height: "100%" }}
      controls
      loop
      acknowledgeRemotionLicense
    />
  );
}

export function mount(container, props) {
  const root = createRoot(container);
  let current = props;
  const render = () => root.render(<PlayerWrap {...current} />);
  render();
  return {
    update(next) {
      current = { ...current, ...next };
      render();
    },
    unmount() {
      root.unmount();
    },
  };
}

// 暴露到全局，供纯静态 app.js 调用
if (typeof window !== "undefined") {
  window.Mount3CRemotionPlayer = mount;
}
