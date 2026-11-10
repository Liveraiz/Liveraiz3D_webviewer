// ui/DevPerformancePanel.js
// 개발 모드 전용 성능 진단 패널.
// - stats.js 기반 FPS/MS/MB 패널 (좌클릭으로 패널 순환)
// - renderer.info 기반 draw call / triangle / geometry / texture 통계 오버레이
//   (draw call·triangle 수치가 높을수록 instancing/batching 등 WebGPU 최적화 후보)
//
// 프로덕션 번들에는 포함되지 않도록 항상 `import.meta.env.DEV` 가드 뒤에서만 생성할 것.
export class DevPerformancePanel {
    /**
     * @param {THREE.WebGLRenderer} threeRenderer - renderer.info를 읽어올 실제 Three.js 렌더러
     */
    constructor(threeRenderer) {
        this.threeRenderer = threeRenderer;
        this.statsPanel = null;
        this.infoEl = null;
        this.lastInfoUpdate = 0;
        this.infoUpdateIntervalMs = 500;

        this.createRenderInfoOverlay();
        this.loadStatsPanel();
    }

    async loadStatsPanel() {
        try {
            const { default: Stats } = await import('three/examples/jsm/libs/stats.module.js');
            this.statsPanel = new Stats();
            this.statsPanel.showPanel(0); // 0: fps, 1: ms, 2: mb

            Object.assign(this.statsPanel.dom.style, {
                position: 'fixed',
                right: '0px',
                left: 'auto',
                bottom: '0px',
                top: 'auto',
                zIndex: '800'
            });

            document.body.appendChild(this.statsPanel.dom);
        } catch (error) {
            console.warn('[DevPerformancePanel] stats.module.js 로드 실패:', error);
        }
    }

    createRenderInfoOverlay() {
        this.infoEl = document.createElement('div');
        this.infoEl.id = 'dev-render-info-panel';
        Object.assign(this.infoEl.style, {
            position: 'fixed',
            right: '0px',
            bottom: '50px',
            zIndex: '800',
            background: 'rgba(0, 0, 0, 0.75)',
            color: '#4dffb8',
            font: '11px/1.4 monospace',
            padding: '6px 8px',
            whiteSpace: 'pre',
            pointerEvents: 'none',
            borderRadius: '2px'
        });
        this.infoEl.textContent = 'Render Info: --';
        document.body.appendChild(this.infoEl);
    }

    /** tick() 시작 시 호출 (stats.js FPS 측정 시작) */
    begin() {
        this.statsPanel?.begin();
    }

    /** tick() 종료 시 호출 (stats.js FPS 측정 종료 + 렌더 통계 갱신) */
    end() {
        this.statsPanel?.end();
        this.updateRenderInfo();
    }

    updateRenderInfo() {
        if (!this.infoEl || !this.threeRenderer?.info) return;

        const now = performance.now();
        if (now - this.lastInfoUpdate < this.infoUpdateIntervalMs) return;
        this.lastInfoUpdate = now;

        const info = this.threeRenderer.info;
        const backend = this.threeRenderer.isWebGPURenderer ? 'WebGPU' : 'WebGL';

        this.infoEl.textContent =
            `Backend : ${backend}\n` +
            `Calls   : ${info.render.calls}\n` +
            `Tris    : ${info.render.triangles.toLocaleString()}\n` +
            `Points  : ${info.render.points}\n` +
            `Lines   : ${info.render.lines}\n` +
            `Geoms   : ${info.memory.geometries}\n` +
            `Textures: ${info.memory.textures}\n` +
            `Programs: ${info.programs ? info.programs.length : '-'}`;
    }

    dispose() {
        if (this.statsPanel?.dom?.parentNode) {
            this.statsPanel.dom.parentNode.removeChild(this.statsPanel.dom);
        }
        this.statsPanel = null;

        if (this.infoEl?.parentNode) {
            this.infoEl.parentNode.removeChild(this.infoEl);
        }
        this.infoEl = null;
    }
}

export default DevPerformancePanel;
