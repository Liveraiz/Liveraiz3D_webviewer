export class RenderManager {
    /**
     * 렌더 매니저 생성자
     * 렌더링 상태와 프레임 관리를 초기화
     * @param {THREE.WebGLRenderer} renderer - Three.js 렌더러
     * @param {THREE.Scene} scene - Three.js 씬
     * @param {THREE.Camera} camera - Three.js 카메라
     * @param {Object} state - 상태 관리 객체
     * @param {CSS2DRenderer} css2dRenderer - CSS2D 렌더러 (옵션)
     * @param {MeshLabelManager} labelManager - 메시 라벨 매니저 (옵션)
     * @param {MaterialManager} materialManager - 메시지얼 매니저 (옵션, 투명 메시 정렬용)
     */
    constructor(renderer, scene, camera, state, css2dRenderer = null, labelManager = null, materialManager = null) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.state = state;
        this.css2dRenderer = css2dRenderer;
        this.labelManager = labelManager;
        this.materialManager = materialManager;
        this.lastTime = performance.now();
        this.frameInterval = 1000 / state.state.fps.target;
        
        // renderer의 sortObjects 설정 (투명 객체 정렬 활성화)
        if (this.renderer) {
            this.renderer.sortObjects = true;
        }
    }

    /**
     * 렌더링 상태 업데이트
     * 프레임 간격을 계산하고 필요한 경우 렌더링 수행
     */
    update() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;

        if (deltaTime >= this.frameInterval) {
            this.lastTime = currentTime - (deltaTime % this.frameInterval);
            
            if (this.state.state.renderNeeded) {
                this.render();
                this.state.setState({ renderNeeded: false });
            }
        }
    }

    /**
     * 씬 렌더링
     * 현재 씬과 카메라 상태를 렌더링
     * CSS2DRenderer를 사용하여 메시 라벨도 함께 렌더링
     * 투명 메시들의 renderOrder를 카메라 거리 기반으로 업데이트
     */
    render() {
        if (this.renderer && this.scene && this.camera) {
            // 투명 메시의 renderOrder 업데이트 (매 프레임)
            // back-to-front 렌더링 보장
            if (this.materialManager && this.scene) {
                const allMeshes = [];
                this.scene.traverse(obj => {
                    if (obj.isMesh) {
                        allMeshes.push(obj);
                    }
                });
                this.materialManager.updateTransparentMeshRenderOrder(this.camera, allMeshes);
            }

            // 메시 라벨 위치 업데이트 (매 프레임)
            if (this.labelManager) {
                this.labelManager.updateAllLabelsPosition();
            }

            // 3D 렌더링
            this.renderer.render(this.scene, this.camera);

            // CSS2D 라벨 렌더링
            if (this.css2dRenderer && this.scene && this.camera) {
                this.css2dRenderer.render(this.scene, this.camera);
            }
        }
    }

    /**
     * 렌더링 요청
     * 다음 프레임에서 렌더링이 필요함을 표시
     */
    requestRender() {
        this.state.setState({ renderNeeded: true });
    }
} 