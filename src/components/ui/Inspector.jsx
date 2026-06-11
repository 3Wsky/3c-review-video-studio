import { Field, Input, Textarea, Select } from "./Field.jsx";
import { SegmentGroup } from "./SegmentGroup.jsx";

/**
 * Inspector — 右侧检视面板组件，用于编辑当前选中分镜的详细参数
 * @param {{
 *   scene: {
 *     voiceover: string;
 *     subtitle?: string;
 *     visual?: {
 *       type: string;
 *       layout: string;
 *       asset?: string;
 *       headline?: string;
 *       detail?: string;
 *     }
 *   };
 *   assets?: Array<{ name: string; url?: string }>;
 *   onChange: (updatedScene: any) => void;
 *   className?: string;
 * }} props
 */
export function Inspector({ scene, assets = [], onChange, className = "" }) {
  if (!scene) {
    return (
      <div className={`ds-inspector-empty ${className}`.trim()}>
        请在左侧选择一个分镜进行编辑
      </div>
    );
  }

  const visual = scene.visual || { type: "真人口播 + 产品图", layout: "center" };

  const handleFieldChange = (path, value) => {
    const updated = { ...scene };
    if (path.startsWith("visual.")) {
      const key = path.split(".")[1];
      updated.visual = { ...visual, [key]: value };
    } else {
      updated[path] = value;
    }
    onChange && onChange(updated);
  };

  const layoutOptions = [
    { value: "center", label: "真人居中" },
    { value: "left", label: "真人左侧" },
    { value: "pip", label: "右下小窗" },
    { value: "none", label: "无真人" }
  ];

  const visualTypes = [
    "真人口播 + 产品图",
    "纯产品图展示",
    "参数对比卡片",
    "知乎评测引用",
    "质检警告画面"
  ];

  return (
    <div className={`ds-inspector ${className}`.trim()}>
      <div className="ds-inspector__section">
        <Field label="口播稿文案">
          <Textarea
            value={scene.voiceover || ""}
            onInput={(e) => handleFieldChange("voiceover", e.currentTarget.value)}
            placeholder="输入该镜头的口播解说词..."
            rows={3}
          />
        </Field>
      </div>

      <div className="ds-inspector__section">
        <Field label="字幕（留空默认同口播）">
          <Input
            value={scene.subtitle || ""}
            onInput={(e) => handleFieldChange("subtitle", e.currentTarget.value)}
            placeholder="输入字幕文案..."
          />
        </Field>
      </div>

      <div className="ds-inspector__section">
        <Field label="画面视觉类型">
          <Select
            value={visual.type || "真人口播 + 产品图"}
            onChange={(e) => handleFieldChange("visual.type", e.currentTarget.value)}
          >
            {visualTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="ds-inspector__section">
        <Field label="真人出镜布局">
          <SegmentGroup
            options={layoutOptions}
            value={visual.layout || "center"}
            onChange={(val) => handleFieldChange("visual.layout", val)}
            columns={4}
          />
        </Field>
      </div>

      <div className="ds-inspector__section">
        <Field label="绑定产品素材">
          <Select
            value={visual.asset || ""}
            onChange={(e) => handleFieldChange("visual.asset", e.currentTarget.value)}
          >
            <option value="">-- 不绑定素材 --</option>
            {assets.map((asset) => (
              <option key={asset.name} value={asset.name}>
                {asset.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="ds-inspector__section ds-field-grid">
        <Field label="画面大标题">
          <Input
            value={visual.headline || ""}
            onInput={(e) => handleFieldChange("visual.headline", e.currentTarget.value)}
            placeholder="如：先看结论"
          />
        </Field>
        <Field label="画面副标题">
          <Input
            value={visual.detail || ""}
            onInput={(e) => handleFieldChange("visual.detail", e.currentTarget.value)}
            placeholder="如：舒适度是主卖点"
          />
        </Field>
      </div>
    </div>
  );
}
