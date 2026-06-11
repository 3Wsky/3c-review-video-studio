import { Field, Select, Textarea, Input, FieldGrid } from "../../components/ui/index.js";
import { useDirectorStore } from "../../store/useDirectorStore.js";
import { CATEGORY_RULES } from "../../core/constants.js";
import LegacyExtras from "./LegacyExtras.jsx";

const PLATFORMS = ["抖音 / 快手 9:16", "B站竖屏 9:16", "小红书 3:4", "视频号 9:16"];
const CATEGORIES = [...new Set(CATEGORY_RULES.map((r) => r.cat))];

export default function AdvancedSettings() {
  const category = useDirectorStore((s) => s.category);
  const targetDuration = useDirectorStore((s) => s.targetDuration);
  const platform = useDirectorStore((s) => s.platform);
  const layout = useDirectorStore((s) => s.layout);
  const factsText = useDirectorStore((s) => s.factsText);
  const apiBase = useDirectorStore((s) => s.apiBase);
  const setField = useDirectorStore((s) => s.setField);
  const persistApiBase = useDirectorStore((s) => s.persistApiBase);

  return (
    <div class="adv-panel ds-adv-panel" id="advPanel">
      <FieldGrid>
        <Field label="品类">
          <Select
            id="category"
            value={category}
            onChange={(e) => {
              setField("category", e.currentTarget.value);
              setField("categoryTouched", true);
            }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="目标时长(秒)">
          <Input
            id="targetDuration"
            type="number"
            min={30}
            max={240}
            step={5}
            value={String(targetDuration)}
            onInput={(e) => setField("targetDuration", Number(e.currentTarget.value) || 90)}
          />
        </Field>
        <Field label="视频平台">
          <Select id="platform" value={platform} onChange={(e) => setField("platform", e.currentTarget.value)}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <div class="segmented" role="group" aria-label="真人出镜布局">
        {[
          { id: "center", label: "真人居中" },
          { id: "left", label: "真人左侧" },
          { id: "pip", label: "右下小窗" },
          { id: "none", label: "无真人" }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            class={`segment${layout === item.id ? " active" : ""}`}
            data-layout={item.id}
            onClick={() => setField("layout", item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Field label="产品事实（可选，帮助 MiMo 更准）">
        <Textarea
          id="factsInput"
          rows={4}
          value={factsText}
          onInput={(e) => setField("factsText", e.currentTarget.value)}
        />
      </Field>

      <Field label="后端地址（可选，留空走同源 Cloudflare）">
        <Input
          id="apiBase"
          type="url"
          placeholder="https://your-codespace-8000.app.github.dev"
          value={apiBase}
          onChange={(e) => persistApiBase(e.currentTarget.value)}
        />
      </Field>

      <LegacyExtras />
    </div>
  );
}
