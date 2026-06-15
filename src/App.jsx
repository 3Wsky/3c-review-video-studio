import PhaseNav from "./components/PhaseNav.jsx";
import MobileActionDock from "./components/MobileActionDock.jsx";

import { TopBar } from "./components/ui/index.js";

import GeneratePanel from "./features/generate/GeneratePanel.jsx";

import ConsoleSection from "./shell/ConsoleSection.jsx";

import RemotionDrawer from "./shell/RemotionDrawer.jsx";
import QualityOverlays from "./features/quality/QualityOverlays.jsx";

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
      <MobileActionDock />



      {/* 道法起片过场动画（一生二，二生三，三生万物） */}

      <div id="taoOverlay" class="tao-overlay" hidden>

        <div class="tao-bg-effects">

          <svg class="tao-taichi-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">

            <circle cx="50" cy="50" r="48" fill="none" stroke="var(--ds-accent)" stroke-width="0.5" opacity="0.2" />

            <path d="M 50 2 A 48 48 0 0 0 50 98 A 24 24 0 0 1 50 50 A 24 24 0 0 0 50 2 Z" fill="rgba(255,255,255,0.02)" />

            <path d="M 50 2 A 48 48 0 0 1 50 98 A 24 24 0 0 1 50 50 A 24 24 0 0 0 50 2 Z" fill="rgba(177,107,255,0.12)" />

            <circle cx="50" cy="26" r="6" fill="rgba(177,107,255,0.8)" />

            <circle cx="50" cy="74" r="6" fill="rgba(255,255,255,0.1)" />

          </svg>

          <div class="tao-glow-ring"></div>

          <div class="tao-sparkles"></div>

        </div>



        <div class="tao-container">

          <div class="tao-header">

            <div class="tao-title-main">道生一 · 一生二 · 二生三 · 三生万物</div>

            <div class="tao-subtitle" id="taoSubtitle">混沌初开，正在凝聚您的视频灵感...</div>

          </div>



          <div class="tao-stage-container">

            <div class="tao-stage tao-stage-1" id="taoStage1">

              <div class="tao-node-pulse"></div>

              <div class="tao-node-content">

                <div class="tao-node-icon">壹</div>

                <div class="tao-node-title">核心需求</div>

                <div class="tao-node-desc" id="taoNodeDesc1">制作 华为Nova16 深度评测视频</div>

              </div>

            </div>



            <div class="tao-stage tao-stage-2" id="taoStage2" hidden>

              <div class="tao-stage-row">

                <div class="tao-node">

                  <div class="tao-node-icon">阴</div>

                  <div class="tao-node-title">知乎真实口碑</div>

                  <div class="tao-node-desc">搜罗真实评测，提炼大众口碑</div>

                </div>

                <div class="tao-node">

                  <div class="tao-node-icon">阳</div>

                  <div class="tao-node-title">产品核心事实</div>

                  <div class="tao-node-desc">核对事实参数，挖掘核心卖点</div>

                </div>

              </div>

            </div>



            <div class="tao-stage tao-stage-3" id="taoStage3" hidden>

              <div class="tao-stage-grid">

                <div class="tao-node">

                  <div class="tao-node-icon">天</div>

                  <div class="tao-node-title">知乎真实口碑</div>

                  <div class="tao-node-desc">搜罗真实评测，提炼大众口碑</div>

                </div>

                <div class="tao-node">

                  <div class="tao-node-icon">地</div>

                  <div class="tao-node-title">产品核心事实</div>

                  <div class="tao-node-desc">核对事实参数，挖掘核心卖点</div>

                </div>

                <div class="tao-node tao-node-center">

                  <div class="tao-node-icon">人</div>

                  <div class="tao-node-title">口播与素材匹配</div>

                  <div class="tao-node-desc">生成原创脚本，匹配实拍分镜</div>

                </div>

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


