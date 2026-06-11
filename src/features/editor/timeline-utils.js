/** @param {import('../../core/timeline-builder.js').TimelineData | null | undefined} data */
export function toTrackScenes(data) {
  if (!data?.timeline?.length) return [];
  return data.timeline.map((scene) => ({
    id: scene.id,
    start: scene.start,
    end: scene.end,
    label: scene.title,
    voiceover: scene.voiceover
  }));
}

/** @param {object} scene */
export function toInspectorScene(scene) {
  if (!scene) return null;
  return {
    voiceover: scene.voiceover || "",
    subtitle: scene.subtitle || "",
    visual: {
      type: scene.visual?.type || "真人口播 + 产品图",
      layout: scene.visual?.layout || "center",
      asset: scene.visual?.asset || "",
      headline: scene.visual?.headline || "",
      detail: scene.visual?.detail || ""
    }
  };
}
