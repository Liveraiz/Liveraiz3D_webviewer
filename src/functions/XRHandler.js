// functions/XRHandler.js
import { Constants } from '../utils/Constants';

export default class XRHandler {
    constructor(viewer) {
        this.viewer = viewer;
        this.xrSession = null;
        this.xrWindow = null;

        this.initializeXRSupport();
    }

    initializeXRSupport() {
        if (!this.isXRSupported()) {
            console.warn('WebXR is not supported on this device');
        }
    }

    isXRSupported() {
        return 'xr' in navigator;
    }

    async checkXRSessionSupport(sessionType = 'immersive-ar') {
        if (!this.isXRSupported()) {
            return false;
        }

        try {
            const supported = await navigator.xr.isSessionSupported(sessionType);
            return supported;
        } catch (error) {
            console.error('Error checking XR session support:', error);
            return false;
        }
    }

    async openXRMode() {
        if (!this.isXRSupported()) {
            console.error('WebXR is not supported on this device');
            alert('XR is not supported on this device.');
            return;
        }

        try {
            // XR 세션 지원 확인
            const sessionType = Constants.XR_MODE.SESSION_TYPE;
            const isSupported = await this.checkXRSessionSupport(sessionType);

            if (!isSupported) {
                console.warn(`${sessionType} is not supported. Trying alternative...`);
                // 폴백: immersive-vr 시도
                const vrSupported = await this.checkXRSessionSupport('immersive-vr');
                if (!vrSupported) {
                    alert('Neither AR nor VR is supported on this device.');
                    return;
                }
            }

            // 현재 모델 및 카메라 상태 데이터 수집
            const modelData = this.collectModelData();

            // 새 창 열기
            this.openXRWindow(modelData);
        } catch (error) {
            console.error('Error opening XR mode:', error);
            alert('Failed to open XR mode: ' + error.message);
        }
    }

    collectModelData() {
        const viewer = this.viewer;
        
        // 카메라 상태
        const cameraState = {
            position: {
                x: viewer.camera.camera.position.x,
                y: viewer.camera.camera.position.y,
                z: viewer.camera.camera.position.z
            },
            target: {
                x: viewer.camera.target.x,
                y: viewer.camera.target.y,
                z: viewer.camera.target.z
            },
            fov: viewer.camera.camera.fov,
            zoom: viewer.camera.camera.zoom
        };

        // 활성 모델 정보
        const activeModelInfo = {
            url: viewer.activeModel?.url || Constants.ASSETS.MODELS.LIVER,
            name: viewer.activeModel?.name || 'default_model'
        };

        // 씬의 메시 상태
        const meshStates = {};
        if (viewer.meshes) {
            viewer.meshes.forEach((mesh, name) => {
                meshStates[name] = {
                    visible: mesh.visible,
                    opacity: mesh.material?.opacity ?? 1,
                    position: {
                        x: mesh.position.x,
                        y: mesh.position.y,
                        z: mesh.position.z
                    }
                };
            });
        }

        return {
            camera: cameraState,
            model: activeModelInfo,
            meshes: meshStates,
            isDarkMode: viewer.isDarkMode,
            timestamp: Date.now()
        };
    }

    openXRWindow(modelData) {
        // 모델 데이터를 URL 파라미터로 인코딩
        const encodedData = encodeURIComponent(JSON.stringify(modelData));
        
        // XR 창 URL 구성
        const xrPageUrl = `/xr-viewer.html?modelData=${encodedData}`;

        // 새 창 열기 (팝업)
        const windowFeatures = 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no';
        
        try {
            this.xrWindow = window.open(xrPageUrl, 'xr-viewer', windowFeatures);
            
            if (this.xrWindow) {
                console.log('XR window opened successfully');
            } else {
                console.error('Failed to open XR window - popup might be blocked');
                alert('Failed to open XR window. Please check if popups are blocked.');
            }
        } catch (error) {
            console.error('Error opening XR window:', error);
            alert('Failed to open XR window: ' + error.message);
        }
    }

    /**
     * XR 윈도우에서 WebXR 세션 시작
     * (xr-viewer.html에서 호출되는 메서드)
     */
    async startXRSession(scene, camera, renderer) {
        if (!this.isXRSupported()) {
            throw new Error('WebXR is not supported');
        }

        try {
            const sessionInit = {
                requiredFeatures: Constants.XR_MODE.FEATURES,
                optionalFeatures: ['dom-overlay', 'dom-overlay-for-handheld-ar'],
                domOverlay: { root: document.body }
            };

            const session = await navigator.xr.requestSession(
                Constants.XR_MODE.SESSION_TYPE,
                sessionInit
            );

            this.xrSession = session;
            console.log('XR session started:', session);

            return session;
        } catch (error) {
            console.error('Failed to start XR session:', error);
            throw error;
        }
    }

    async endXRSession() {
        if (this.xrSession) {
            try {
                await this.xrSession.end();
                this.xrSession = null;
                console.log('XR session ended');
            } catch (error) {
                console.error('Error ending XR session:', error);
            }
        }
    }

    closeXRWindow() {
        if (this.xrWindow) {
            try {
                this.xrWindow.close();
                this.xrWindow = null;
            } catch (error) {
                console.error('Error closing XR window:', error);
            }
        }
    }

    destroy() {
        this.endXRSession();
        this.closeXRWindow();
    }
}
