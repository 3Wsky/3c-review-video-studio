import PhaseNav from "./components/PhaseNav.jsx";
import MobileActionDock from "./components/MobileActionDock.jsx";

import { TopBar } from "./components/ui/index.js";

import GeneratePanel from "./features/generate/GeneratePanel.jsx";

import ConsoleSection from "./shell/ConsoleSection.jsx";

import RemotionDrawer from "./shell/RemotionDrawer.jsx";
import QualityOverlays from "./features/quality/QualityOverlays.jsx";
import GlobalToastHost from "./components/GlobalToastHost.jsx";

import { useDirectorStore } from "./store/useDirectorStore.js";



export default function App() {

  const apiStatus = useDirectorStore((s) => s.apiStatus);



  return (

    <>

      <TopBar status={apiStatus} />



      <PhaseNav />



      <main class="director">

        <GeneratePanel />

        <ConsoleSection />

      </main>



      <pre id="jsonOutput" hidden />

      <RemotionDrawer />
      <QualityOverlays />
      <GlobalToastHost />
      <MobileActionDock />



      {/* 道法起片过场动画（一生二，二生三，三生万物） */}

      <div id="taoOverlay" class="tao-overlay" hidden>

        <div class="tao-bg-effects">
          <svg class="tao-taichi-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <radialGradient id="taoYang" cx="50%" cy="35%" r="65%">
                <stop offset="0%" stop-color="#f0ece4" />
                <stop offset="100%" stop-color="#c8c2b4" />
              </radialGradient>
              <radialGradient id="taoYin" cx="50%" cy="65%" r="65%">
                <stop offset="0%" stop-color="#1a1a1a" />
                <stop offset="100%" stop-color="#050505" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="49" fill="url(#taoYin)" stroke="#4a463c" stroke-width="0.7" opacity="0.95" />
            <path
              d="M50,1 A49,49 0 0,1 50,99 A24.5,24.5 0 0,1 50,50 A24.5,24.5 0 0,0 50,1 Z"
              fill="url(#taoYang)"
            />
            <circle cx="50" cy="24.5" r="5.5" fill="#e8e4d8" />
            <circle cx="50" cy="75.5" r="5.5" fill="#080808" />
          </svg>
          <div class="tao-glow-ring" />
          <div class="tao-ink-mist" />
        </div>



        <div class="tao-container">

          <div class="tao-header">

            <div class="tao-title-main">道生一 · 一生二 · 二生三 · 三生万物</div>

            <div class="tao-subtitle" id="taoSubtitle">混沌初开，正在凝聚您的视频灵感...</div>

          </div>



          <div class="tao-stage-container" id="taoStageContainer" data-phase="1">

            {/* 壹：核心需求节点，仅在阶段 1 突出展示，阶段 2 向上移开并淡出 */}
            <div class="tao-main-node" id="taoMainNode">

              <div class="tao-node-pulse"></div>

              <div class="tao-node-content">

                <div class="tao-node-icon">壹</div>

                <div class="tao-node-title">核心需求</div>

                <div class="tao-node-desc" id="taoNodeDesc1">制作 华为Nova16 深度评测视频</div>

              </div>

            </div>



            {/* 长期存续的演化节点（阴阳/天地） */}
            <div class="tao-evolve-node tao-node-left" id="taoNodeLeft">

              <div class="tao-node-icon" id="taoIconLeft">阴</div>

              <div class="tao-node-title" id="taoTitleLeft">知乎真实口碑</div>

              <div class="tao-node-desc">搜罗真实评测，提炼大众口碑</div>

            </div>

            <div class="tao-evolve-node tao-node-right" id="taoNodeRight">

              <div class="tao-node-icon" id="taoIconRight">阳</div>

              <div class="tao-node-title" id="taoTitleRight">产品核心事实</div>

              <div class="tao-node-desc">核对事实参数，挖掘核心卖点</div>

            </div>



            {/* 第三极：人节点，仅在阶段 3 凝聚点亮并淡入 */}
            <div class="tao-evolve-node tao-node-bottom" id="taoNodeBottom">

              <div class="tao-node-pulse"></div>

              <div class="tao-node-content">

                <div class="tao-node-icon">人</div>

                <div class="tao-node-title">口播与素材匹配</div>

                <div class="tao-node-desc">生成原创脚本，匹配实拍分镜</div>

              </div>

            </div>

          </div>



          <div class="tao-footer">

            <button id="taoSkipBtn" class="ds-btn ds-btn--sm ds-btn--ghost" type="button">

              跳过动画

            </button>

          </div>

        </div>

      </div>



      {/* legacy director 读取 apiStatus 节点 */}

      <span id="apiStatus" hidden aria-hidden="true">

        {apiStatus}

      </span>

    </>

  );

}


