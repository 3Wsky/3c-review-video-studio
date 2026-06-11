import { buildTimeline } from "./timeline-builder.js";

/**
 * @param {Record<string, unknown>} data
 * @param {import('./timeline-builder.js').FormInput} input
 */
export function normalizeTimelineData(data, input) {
  const local = buildTimeline(input);
  const project = {
    ...local.project,
    ...(/** @type {Record<string, unknown>} */ (data.project) || {}),
    product:
      /** @type {Record<string, unknown>} */ (data.project)?.product ||
      data.product ||
      input.productName.trim(),
    category:
      /** @type {Record<string, unknown>} */ (data.project)?.category || input.category,
    platform:
      /** @type {Record<string, unknown>} */ (data.project)?.platform || input.platform,
    targetDuration: Number(
      /** @type {Record<string, unknown>} */ (data.project)?.targetDuration || input.targetDuration || 90
    ),
    layout: /** @type {Record<string, unknown>} */ (data.project)?.layout || input.layout
  };

  const sourceTimeline = Array.isArray(data.timeline) ? data.timeline : [];
  const fallbackTimeline = local.timeline;
  const timeline = (sourceTimeline.length ? sourceTimeline : fallbackTimeline).map((scene, index) => {
    const fallback = fallbackTimeline[index] || fallbackTimeline[fallbackTimeline.length - 1];
    const start = Number.isFinite(Number(scene.start)) ? Number(scene.start) : fallback.start;
    const end = Number.isFinite(Number(scene.end)) ? Number(scene.end) : fallback.end;
    const voiceover = scene.voiceover || fallback.voiceover;
    return {
      id: scene.id || `scene_${String(index + 1).padStart(2, "0")}`,
      index: scene.index || index + 1,
      title: scene.title || fallback.title,
      start,
      end,
      duration: Number.isFinite(Number(scene.duration))
        ? Number(scene.duration)
        : Number((end - start).toFixed(2)),
      voiceover,
      subtitle: scene.subtitle || voiceover,
      visual: {
        type: scene.visual?.type || fallback.visual.type,
        layout: scene.visual?.layout || project.layout,
        headline: scene.visual?.headline || fallback.visual.headline,
        detail: scene.visual?.detail || fallback.visual.detail,
        asset: scene.visual?.asset || fallback.visual.asset,
        ...(scene.visual?.metric && typeof scene.visual.metric === "object"
          ? { metric: scene.visual.metric }
          : {}),
        ...(scene.visual?.compare && typeof scene.visual.compare === "object"
          ? { compare: scene.visual.compare }
          : {})
      },
      checks: Array.isArray(scene.checks) ? scene.checks : fallback.checks,
      source: scene.source || "Cloudflare LLM"
    };
  });

  return {
    project,
    insights: {
      ...local.insights,
      ...(/** @type {Record<string, unknown>} */ (data.insights) || {}),
      sourceCount:
        /** @type {Record<string, unknown>} */ (data.insights)?.sourceCount || local.insights.sourceCount
    },
    timeline
  };
}
