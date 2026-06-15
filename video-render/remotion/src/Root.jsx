import React from "react";
import { Composition } from "remotion";
import { ReviewVideo } from "./ReviewVideo.jsx";
import { buildComposition, FPS } from "./scene-model.mjs";
import sampleTimeline from "../../samples/timeline.sample.json";

// 画幅/总时长都从 inputProps 推导：worker 传 { timeline, format } 即可，
// Remotion 用 calculateMetadata 自动算出竖屏/横屏/方图与总帧数。
export const RemotionRoot = () => {
  return (
    <Composition
      id="ReviewVideo"
      component={ReviewVideo}
      fps={FPS}
      // 占位尺寸/时长，真实值由 calculateMetadata 覆盖
      durationInFrames={300}
      width={1080}
      height={1920}
      defaultProps={{ timeline: sampleTimeline, format: "9:16", assetMap: {}, assetKinds: {} }}
      calculateMetadata={({ props }) => {
        const comp = buildComposition(props.timeline, props.format);
        return {
          durationInFrames: comp.durationInFrames,
          fps: comp.fps,
          width: comp.width,
          height: comp.height,
        };
      }}
    />
  );
};
