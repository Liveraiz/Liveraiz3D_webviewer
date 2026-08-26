// core/LiverViewer.js
import * as THREE from "three";
import Scene from "./Scene";
import Renderer from "./Renderer";
import Camera from "./Camera";
import MaterialManager from "../materials/MaterialManager";
import ControlManager from "../controls/ControlManager";
import TopBar from "../ui/TopBar";
import Toolbar from "../ui/Toolbar";
import { ObjectListPanel } from "../ui/ObjectListPanel";
import { MeshLabelManager } from "../ui/MeshLabelManager";
import ModelLoader from "../loaders/ModelLoader";
import { DeviceDetector } from "../utils/DeviceDetector";
import { ResizeHandler } from "../utils/ResizeHandler";
import { ErrorHandler } from "../utils/ErrorHandler";
import { Constants, initializeGlobalStyles } from "../utils/Constants";
//import ToggleButton from "../ui/ToggleButton";
// import meshOutlineMarker from "../controls/meshOutlineMarker";
import ModelSelector from "../ui/ModelSelector";
// import Stats from "three/examples/jsm/libs/stats.module.js";
import MeshTransform from "../controls/meshTransform";
import ViewerState from "./ViewerState";
import { PanelManager } from "../ui/PanelManager";
import TextPanel from "../ui/TextPanel";
import MeasurementTool from "../functions/measurementTool";
import MeshTooltip from "../ui/MeshTooltip";
import LoadingBar from "../ui/LoadingBar";
import LogoManager from "../ui/LogoManager";
import CameraPlayer from "../functions/CameraPlayer";
import ZoomControl from "../ui/ZoomControl";
import {
    parseViewerEntry,
    VIEWER_PROVIDER,
    clearLaunchTokenFromUrl,
    isS3DownloadUrlError,
} from "../services/ViewerEntryService";
import FloatingModeButtons from "../ui/FloatingModeButtons";
import XRHandler from "../functions/XRHandler";
import StereoscopicRenderer from "../functions/StereoscopicRenderer";
import { RenderManager } from "./RenderManager";
import { fetchViewerProjectManifest } from "../services/ViewerProjectManifestService";

export default class LiverViewer {
    constructor(containerId) {
        try {
            // 전역 스타일 초기화 - Pretendard 폰트 적용
            initializeGlobalStyles();

            this.containerId = containerId;
            const deviceDetector = new DeviceDetector();
            this.isMobile = deviceDetector.isMobile();
            
            console.log("Device detection:", {
                userAgent: navigator.userAgent,
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                isMobile: this.isMobile,
                deviceDetector: deviceDetector.isMobile()
            });

            this.meshes = new Map();
            this.isDarkMode = false;
            this.activeModel = null;

            this.toggleDarkMode = this.toggleDarkMode.bind(this);
            this.renderNeeded = false;

            // Render mode 관련 초기화
            this.renderMode = 'standard'; // 'standard' | 'stereoscopic' | 'xr'
            this.xrHandler = null;
            this.stereoscopicRenderer = null;
            this.floatingModeButtons = null;

            this.viewerEntry = parseViewerEntry(window.location);
            this.externalModelRequest = this.viewerEntry.externalModelRequest;
            this.externalModelProvider = this.viewerEntry.provider;
            this.onModelSelectorReady = this.createModelSelectorReadyHandler(this.viewerEntry);

            // Stats 초기화
            // this.stats = new Stats();
            // this.stats.showPanel(0);
            // document.body.appendChild(this.stats.dom);
            // this.stats.dom.style.position = "absolute";
            // this.stats.dom.style.right = "0px";
            // this.stats.dom.style.left = "auto";
            // this.stats.dom.style.bottom = "0px";
            // this.stats.dom.style.top = "auto";
            // this.stats.dom.style.zIndex = "800"; // TextPanel보다 낮은 z-index 설정

            // ViewerState 초기화
            this.viewerState = new ViewerState();
            // ViewerState의 isDarkMode를 LiverViewer의 초기값과 동기화
            this.viewerState.setState({ isDarkMode: this.isDarkMode });
            this.viewerState.subscribe(this.handleStateChange.bind(this));

            // Panel Manager 초기화를 먼저
            this.panelManager = new PanelManager(this.isMobile);

            // TextPanel 초기화
            this.textPanel = new TextPanel({
                isMobile: this.isMobile,
                panelManager: this.panelManager,
                isDarkMode: this.isDarkMode,
            });

            // ObjectListPanel 초기화
            this.objectListPanel = new ObjectListPanel({
                liverViewer: this,
                panelManager: this.panelManager,
                isDarkMode: this.isDarkMode,
                labelManager: this.labelManager,
                volumeTextBox: this.volumeTextBox,
            });

            // MeshTooltip 초기화
            this.meshTooltip = new MeshTooltip();

            // 콜백 설정 추가
            this.objectListPanel.setToggleCallback((name, visible, opacity) => {
                this.handleObjectToggle(name, visible, opacity);
            });

            // ModelSelector는 마지막에 초기화
            this.modelSelector = new ModelSelector({
                liverViewer: this,
                dropboxService: this.dropboxService,
                textPanel: this.textPanel, // TextPanel 직접 전달
                objectListPanel: this.objectListPanel, // ObjectListPanel 직접 전달
            });

            // LogoManager 초기화
            this.logoManager = new LogoManager({
                containerId: this.containerId,
                position: "bottom-left",
                width: 120,
                height: 60,
                margin: 20,
                opacity: 0.8,
                isDarkMode: this.isDarkMode,
            });

            console.log("LiverViewer initialized with panels:", {
                textPanel: !!this.textPanel,
                objectListPanel: !!this.objectListPanel,
                modelSelector: !!this.modelSelector,
            });

            // THREE.Clock 유지
            this.lastFrameTime = 0;
            this.targetFPS = 60;
            this.frameInterval = 1000 / this.targetFPS;
            this.clock = new THREE.Clock();

            // 초기화 순서 변경
            this.initialize();
        } catch (error) {
            ErrorHandler.handle(error, "LiverViewer Constructor");
        }
    }

    initialize() {
        try {
            // Core components initialization 순서 변경
            this.setupCamera(); // 카메라를 먼저 설정
            this.setupRenderer();
            this.setupScene();

            // MeshTooltip 초기화 (카메라 설정 후)
            this.meshTooltip = new MeshTooltip();
            this.meshTooltip.camera = this.camera; // 카메라 참조 전달
            this.meshTooltip.isMobile = this.isMobile;

            // 나머지 매니저들 설정
            this.setupManagers();

            // ObjectListPanel에 labelManager 연결
            if (this.objectListPanel && this.labelManager) {
                this.objectListPanel.setLabelManager(this.labelManager);
                console.log('[LiverViewer] labelManager connected to ObjectListPanel');
            }

            // CameraPlayer 초기화
            this.setupCameraPlayer();

            // ViewerState에 LiverViewer 등록 (UI 초기화 전에)
            console.log("=== Registering LiverViewer to viewerState ===");
            console.log("Before setState - viewerState:", this.viewerState);
            console.log("Before setState - viewerState.state:", this.viewerState.state);
            
            this.viewerState.setState({ liverViewer: this });
            
            // 전역 변수로도 설정 (Toolbar에서 접근하기 위해)
            window.liverViewer = this;
            
            // HDRI 회전 기능을 전역으로 노출
            window.rotateHDRI = (degrees) => {
                if (this.scene && this.scene.rotateEnvironmentByDegrees) {
                    this.scene.rotateEnvironmentByDegrees(degrees);
                    console.log(`HDRI rotated by ${degrees} degrees`);
                } else {
                    console.warn('HDRI rotation not available');
                }
            };
            
            // HDRI 회전 예시 함수들
            window.rotateHDRILeft = () => window.rotateHDRI(-90);   // 왼쪽으로 90도
            window.rotateHDRIRight = () => window.rotateHDRI(90);   // 오른쪽으로 90도
            window.rotateHDRI180 = () => window.rotateHDRI(180);    // 180도 회전
            window.resetHDRI = () => window.rotateHDRI(0);          // 원래 위치로

            console.log("After setState - viewerState.state:", this.viewerState.state);
            console.log("After setState - viewerState.state.liverViewer:", this.viewerState.state.liverViewer);
            console.log("After setState - this:", this);
            console.log("Set window.liverViewer:", window.liverViewer);

            // ModelLoader와 나머지 UI 초기화
            // ✅ 순서 변경: Toolbar를 먼저 생성하고, ModelLoader가 toolbar를 참조하도록
            this.setupRemainingUIWithoutObjectList();  // Toolbar 생성
            this.setupModelLoader();                   // ModelLoader 생성 (toolbar 참조 가능)
            this.setupTopBar();

            // Floating Mode Buttons 초기화
            this.setupFloatingModeButtons();

            // RenderManager 초기화 - 모든 매니저 설정 후
            this.renderManager = new RenderManager(
                this.renderer.renderer,
                this.scene,
                this.camera,
                this.viewerState,
                this.renderer.labelRenderer,
                this.labelManager,
                this.materialManager
            );
            // console.log('[LiverViewer] RenderManager initialized with materialManager');

            // Event listeners
            this.setupEventListeners();

            // Animation 시작
            this.startAnimation();

            console.log("Components initialized:", {
                camera: !!this.camera,
                modelSelector: !!this.modelSelector,
                topBar: !!this.topBar,
                textPanel: !!this.textPanel,
                objectListPanel: !!this.objectListPanel,
            });
        } catch (error) {
            ErrorHandler.handle(error, "LiverViewer Initialize");
        }
    }

    setupTopBar() {
        this.topBar = new TopBar({
            isMobile: this.isMobile,
            isDarkMode: this.isDarkMode,
            viewerState: this.viewerState,
            textPanel: this.textPanel,
            objectListPanel: this.objectListPanel,
            controlManager: this.controlManager,
            cameraPlayer: this.cameraPlayer,
            modelLoader: this.modelLoader,
            modelSelector: this.modelSelector,
        });

        // 추가: 명시적으로 cameraPlayer 설정
        if (this.cameraPlayer) {
            this.topBar.setCameraPlayer(this.cameraPlayer);
            console.log("CameraPlayer가 TopBar에 연결되었습니다");
        } else {
            console.error(
                "TopBar에 전달할 CameraPlayer가 초기화되지 않았습니다"
            );
        }

        // TopBar에 ModelSelector 연결
        this.topBar.setModelSelector(this.modelSelector);
    }

    setupTextPanel() {
        this.textPanel = new TextPanel({
            isMobile: this.isMobile,
            panelManager: this.panelManager,
            isDarkMode: this.isDarkMode,
        });
    }

    setupRenderer() {
        this.renderer = new Renderer(this.containerId, this.isMobile);
        if (!this.renderer.renderer) {
            throw new Error("Failed to initialize renderer");
        }

        // CSS2DRenderer가 제대로 초기화되었는지 확인
        if (!this.renderer.labelRenderer) {
            console.error("CSS2DRenderer not initialized");
        }
    }

    setupCamera() {
        this.camera = new Camera(this.isMobile);
        this.camera.position.set(0, 0, 5); // 초기 위치 설정
        this.camera.lookAt(0, 0, 0); // 초기 시점 설정
        console.log("Camera initialized:", {
            position: this.camera.position,
            isMobile: this.isMobile,
        });
    }

    setupScene() {
        this.scene = new Scene(this.renderer.renderer, this.isDarkMode);
    }

    setupManagers() {
        // Material manager
        this.materialManager = new MaterialManager(this.renderer.renderer);

        // Mesh Label Manager - 메시 숫자 라벨 관리
        this.labelManager = new MeshLabelManager(this.scene, this.camera);
        console.log('[LiverViewer] MeshLabelManager initialized');

        // Control manager
        this.controlManager = new ControlManager(
            this.camera,
            this.renderer.renderer,
            this.isMobile,
            "OrbitControls"
        );

        // MeshTooltip을 ControlManager에 연결
        if (this.meshTooltip) {
            console.log("[LiverViewer] ControlManager에 MeshTooltip 연결");
            this.controlManager.setMeshTooltip(this.meshTooltip);
        }

        // Transform 기능 추가
        this.meshTransform = new MeshTransform(
            this.renderer.renderer,
            this.scene,
            this.camera,
            this.controlManager.controls,
            Array.from(this.meshes.values()),
            new Map(),
            this.controlManager // ControlManager 전달 추가
        );

        if (this.modelLoader) {
            this.meshTransform.setModelLoader(this.modelLoader);
        }

        // Resize handler
        this.resizeHandler = new ResizeHandler({
            camera: this.camera,
            renderer: this.renderer,
            isMobile: this.isMobile,
        });

        // MeasurementTool 초기화 - ObjectListPanel이 준비된 후에 실행
        this.measurementTool = new MeasurementTool(
            this.scene,
            this.camera,
            this.renderer.renderer,
            {
                onMeasurementComplete: (measurement) => {
                    console.log("Measurement completed:", measurement);
                    if (this.objectListPanel) {
                        console.log("Adding measurement to ObjectListPanel");
                        this.objectListPanel.addMeasurement(measurement);
                    } else {
                        console.warn("ObjectListPanel not available");
                    }
                },
                objectListPanel: this.objectListPanel,
            },
            this.isMobile
        );

        // MeshTooltip 초기화 및 설정
        this.meshTooltip = new MeshTooltip();
        this.meshTooltip.isMobile = this.isMobile;
        this.meshTooltip.camera = this.camera;
    }

    setupRemainingUIWithoutObjectList() {
        // Toolbar 초기화 - 모든 컴포넌트가 준비된 후에
        this.toolbar = new Toolbar({
            materialManager: this.materialManager,
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            meshes: Array.from(this.meshes.values()),
            toggleDarkMode: this.toggleDarkMode,
            isMobile: this.isMobile,
            modelLoader: this.modelLoader,
            modelSelector: this.modelSelector,
            meshTransform: this.meshTransform,
            measurementTool: this.measurementTool,
            objectListPanel: this.objectListPanel, // ObjectListPanel 전달
            isDarkMode: this.isDarkMode,
        });

        this.zoomControl = new ZoomControl({
            camera: this.camera,
            controlManager: this.controlManager,
            textPanel: this.textPanel,
            isDarkMode: this.isDarkMode,
            isMobile: this.isMobile,
            onRequestRender: () => this.requestRender(),
        });
    }

    setupModelLoader() {
        try {
            // 로딩 바 생성
            this.loadingBar = new LoadingBar(this.isDarkMode);

            // ModelLoader 초기화
            this.modelLoader = new ModelLoader({
                scene: this.scene,
                camera: this.camera,
                materialManager: this.materialManager,
                meshes: this.meshes,
                loadingBar: this.loadingBar,
                renderer: this.renderer.renderer,
                toolbar: this.toolbar,
                onLoadComplete: (hasAnimation) => {
                    console.log("모델 로드 완료, 애니메이션 여부:", hasAnimation);

                    // 메시 라벨 초기화 (숫자가 붙은 메시들)
                    if (this.labelManager) {
                        this.labelManager.initializeLabelsFromScene();
                        console.log(`[LiverViewer] ${this.labelManager.getLabelCount()} mesh labels initialized`);
                        
                        // ObjectListPanel 라벨 토글 갱신
                        if (this.objectListPanel) {
                            this.objectListPanel.updateLabelToggle();
                        }
                    }

                    // 측정값 초기화
                    if (this.measurementTool) {
                        this.measurementTool.clearAllMeasurements();
                        this.measurementTool.disableMeasurementMode();
                        // 모델 로드 완료 후 marker size 업데이트
                        this.measurementTool.refreshMarkerSize();
                    }

                    // Toolbar의 측정 도구 버튼 상태 초기화
                    if (this.toolbar) {
                        this.toolbar.resetMeasurementButtons();
                        this.toolbar.showAnimationControls(hasAnimation);
                    }

                    this.handleLoadComplete(hasAnimation);
                },
                onLoadError: (error) => {
                    console.error("모델 로드 에러:", error);
                    this.handleLoadError(error);
                },
                modelPath: "./models/260807-dangam.glb",
                // URL 파라미터가 없으면 기본 모델 자동 로드, 있으면 ModelSelector에서 선택하도록
                autoLoad: !this.viewerEntry.provider,
            });

            console.log("✅ ModelLoader created successfully");

            // ✅ ModelSelector는 이미 constructor에서 생성되었으므로, ModelLoader를 설정하기만 함
            // 기존 ModelSelector 인스턴스 재사용
            if (this.modelSelector && this.modelLoader) {
                this.modelSelector.setModelLoader(this.modelLoader);
                console.log("✅ [LiverViewer] ModelLoader 설정 완료");
            } else {
                console.warn("⚠️ ModelSelector or ModelLoader not available for linking");
            }

            // ModelSelector에서 JSON 파일을 로드한 후 로고 데이터 처리를 위한 콜백 추가
            if (this.modelSelector) {
                this.modelSelector.onJsonLoaded = (jsonData) => {
                    if (jsonData && jsonData.logo) {
                        console.log("JSON에서 로고 데이터 발견:", jsonData.logo);
                        // LogoManager에 dropboxService 연결 후 로고 로드
                        if (this.modelSelector.dropboxService) {
                            this.logoManager.setDropboxService(
                                this.modelSelector.dropboxService
                            );
                        }
                        this.logoManager.loadFromDropbox(jsonData.logo);
                    }
                };
            }

            // URL 파라미터로 전달된 모델 처리
            if (this.onModelSelectorReady) {
                console.log("Executing onModelSelectorReady callback");
                this.onModelSelectorReady(this.modelSelector).then((result) => {
                    if (result?.showSelector !== false) {
                        console.log(
                            "Model manifest loaded, showing ModelSelector"
                        );
                        this.modelSelector.show(); // 로딩 완료 후 UI 표시
                    }
                });
            }

            // TopBar에 ModelSelector 연결
            if (this.topBar) {
                this.topBar.setModelSelector(this.modelSelector);
            }

            console.log("✅ ModelLoader 및 ModelSelector 초기화 완료");

        } catch (error) {
            console.error("ModelLoader 설정 중 에러:", error);
            ErrorHandler.handle(error, "ModelLoader Setup");
        }
    }

    createModelSelectorReadyHandler(entry) {
        if (!entry?.provider) {
            return null;
        }

        if (entry.provider === VIEWER_PROVIDER.S3) {
            return async (modelSelector) => {
                try {
                    const manifest = await fetchViewerProjectManifest(entry.projectId, entry.launchToken);
                    await modelSelector.loadManifest(manifest, VIEWER_PROVIDER.S3);
                    clearLaunchTokenFromUrl();
                    return { showSelector: true };
                } catch (error) {
                    console.error("Error loading S3 viewer manifest:", error);
                    ErrorHandler.showErrorMessage(
                        "S3 viewer link has expired or could not be loaded. Please restart the viewer from the portal."
                    );
                    return { showSelector: false };
                }
            };
        }

        if (entry.provider === VIEWER_PROVIDER.DROPBOX) {
            return async (modelSelector) => {
                try {
                    await modelSelector.loadDropboxFolderContents(entry.jsonUrl, true);
                } catch (error) {
                    console.error("Error loading JSON from URL:", error);
                    ErrorHandler.showErrorMessage("Dropbox model information could not be loaded. Please check the link and try again.");
                }
                return { showSelector: true };
            };
        }

        return async () => {
            ErrorHandler.showErrorMessage("Unsupported viewer source. Please restart the viewer from the portal.");
            return { showSelector: false };
        };
    }

    setupMeshTooltip() {
        const style = document.createElement("style");
        style.textContent = `
            .mesh-tooltip {
                background-color: ${
                    this.isDarkMode
                        ? "rgba(255, 255, 255, 0.8)"
                        : "rgba(0, 0, 0, 0.8)"
                };
                color: ${this.isDarkMode ? "#000" : "#fff"};
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 14px;
                pointer-events: none;
                white-space: nowrap;
                z-index: 1000;
                position: absolute;
                transform: translate(-50%, -50%);
            }
        `;
        document.head.appendChild(style);
    }

    setupCameraPlayer() {
        try {
            console.log("CameraPlayer 초기화 시작...");
            // this.scene, this.camera, this.renderer.renderer가 모두 존재하는지 확인
            if (
                !this.scene ||
                !this.camera ||
                !this.renderer ||
                !this.renderer.renderer
            ) {
                console.error("CameraPlayer 초기화에 필요한 객체가 없습니다:", {
                    scene: !!this.scene,
                    camera: !!this.camera,
                    renderer: !!this.renderer,
                    rendererRenderer: !!(
                        this.renderer && this.renderer.renderer
                    ),
                });
                return;
            }

            this.cameraPlayer = new CameraPlayer(
                this.scene,
                this.camera,
                this.renderer.renderer,
                this.isMobile
            );
            console.log("CameraPlayer 초기화 완료:", !!this.cameraPlayer);
        } catch (error) {
            console.error("CameraPlayer 초기화 오류:", error);
            ErrorHandler.handle(error, "CameraPlayer Setup");
        }
    }

    setupEventListeners() {
        window.addEventListener("resize", () => {
            this.resizeHandler.handleResize(
                window.innerWidth,
                window.innerHeight
            );

            if (this.stereoscopicRenderer) {
                this.stereoscopicRenderer.updateCanvasSize(window.innerWidth, window.innerHeight);
            }
        });

        // Transform 컨트롤의 이벤트 리스너는 MeshTransform 클래스 내부에서 처리
        this.renderer.renderer.domElement.addEventListener(
            "pointerdown",
            (event) => this.meshTransform?.onPointerDown(event)
        );
    }

    handleObjectToggle(objectId, visible, opacity = undefined) {
        // meshes Map에서 먼저 찾기
        let mesh = this.meshes.get(objectId);
        
        // meshes Map에 없으면 objectListPanel의 objects Map에서 찾기 (vol 메시 등)
        if (!mesh && this.objectListPanel) {
            mesh = this.objectListPanel.getObject(objectId);
        }
        
        if (mesh) {
            mesh.visible = visible;

            // opacity가 제공된 경우 material 업데이트
            if (opacity !== undefined && mesh.material) {
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach((mat) => {
                    mat.userData = mat.userData || {};
                    if (mat.userData._baseTransparent === undefined) {
                        mat.userData._baseTransparent = mat.transparent;
                    }
                    if (mat.userData._baseDepthWrite === undefined) {
                        mat.userData._baseDepthWrite = mat.depthWrite;
                    }
                    if (mat.userData.originalOpacity === undefined) {
                        mat.userData.originalOpacity = mat.opacity;
                    }

                    mat.opacity = opacity;
                    if (opacity < 1) {
                        mat.transparent = true;
                        if (mat.userData._baseTransparent === false) {
                            mat.depthWrite = false;
                        }
                    } else {
                        mat.transparent = mat.userData._baseTransparent;
                        mat.depthWrite = mat.userData._baseDepthWrite;
                    }
                    mat.needsUpdate = true;

                    // opacity가 1.0으로 바뀌면 originalOpacity도 1.0으로 갱신
                    if (opacity === 1) {
                        mat.userData.originalOpacity = 1.0;
                    } else if (mat.userData.originalOpacity === undefined) {
                        // 최초 세팅이 없으면 현재 opacity로 기록
                        mat.userData.originalOpacity = opacity;
                    }
                });
            }

            // ObjectListPanel에 등록된 오브젝트만 보이도록 설정 (vol 메시들은 objects Map에 있으므로 통과)
            if (this.objectListPanel && !this.objectListPanel.hasObject(objectId)) {
                mesh.visible = false;
            }
        }
    }

    handleLoadComplete() {
        try {
            // 기존 모델 제거 전에 모든 툴팁 정리
            if (this.meshTooltip) {
                console.log("새 모델 로드: 기존 툴팁 정리");
                this.meshTooltip.dispose();
            }

            // 기존 모델 제거
            if (this.activeModel) {
                this.scene.remove(this.activeModel);
            }

            // 새 모델 설정
            this.activeModel = this.scene.children.find(
                (child) => child.isGroup
            );

            // 여기서 setCameraToFitModel이 호출되는지 확인
            if (this.activeModel && this.controlManager) {
                console.log("Setting camera to fit model:", {
                    modelExists: !!this.activeModel,
                    modelSize: new THREE.Box3()
                        .setFromObject(this.activeModel)
                        .getSize(new THREE.Vector3()),
                });
                this.controlManager.setCameraToFitModel(this.activeModel);
            }

            // meshes Map 업데이트
            this.meshes.clear();

            // 새로운 MeshTooltip 인스턴스 생성
            this.meshTooltip = new MeshTooltip();
            this.meshTooltip.camera = this.camera;
            this.meshTooltip.isMobile = this.isMobile;

            // ControlManager에 새로운 MeshTooltip 연결
            if (this.controlManager) {
                console.log(
                    "[LiverViewer] ControlManager에 새 MeshTooltip 연결"
                );
                this.controlManager.setMeshTooltip(this.meshTooltip);
            }

            // MaterialManager에 MeshTooltip 연결
            if (this.materialManager) {
                console.log("[LiverViewer] MaterialManager에 MeshTooltip 연결");
                this.materialManager.setMeshTooltip(this.meshTooltip);
            }

            this.scene.traverse((object) => {
                if (object.isMesh) {
                    const name = object.name.toLowerCase();

                    // 이름이나 특수문자만 있는 우 제외
                    if (
                        !name ||
                        name.trim() === "" ||
                        /^[^a-zA-Z0-9]+$/.test(name)
                    ) {
                        return;
                    }

                    const excludeKeywords = [
                        "helper",
                        // "axis",
                        "grid",
                        "transform",
                        "start",
                        "end",
                        "control",
                        "handle",
                        "point",
                        "empty",
                        "undefined",
                    ];

                    // 숫자나 한 글자로만 된 이름 제외
                    const isSingleChar = name.length === 1;
                    const startsWithNumber = /^\d/.test(name);
                    const startsWithXYZ = /^[xyz]/i.test(name);

                    // 제외할 키워드가 포함되어 있는지 확인
                    const hasExcludedKeyword = excludeKeywords.some((keyword) =>
                        name.includes(keyword)
                    );

                    if (
                        !isSingleChar &&
                        !startsWithNumber &&
                        !startsWithXYZ &&
                        !hasExcludedKeyword
                    ) {
                        object.visible = true;
                        this.meshes.set(object.name, object);
                        console.log(`새 메쉬 툴팁 설정: ${object.name}`);
                        this.meshTooltip.setupHoverEvents(object, this.scene);
                    }
                }
            });

            // ObjectListPanel 업데이트
            if (this.objectListPanel) {
                this.objectListPanel.clearObjectList();
                this.objectListPanel.updateObjectList(
                    Array.from(this.meshes.values())
                );
                
                // ObjectListPanel에 MeshTooltip 연결
                if (this.meshTooltip) {
                    this.objectListPanel.setMeshTooltip(this.meshTooltip);
                }
            }

            // meshMarker와 meshTransform 업데이트
            if (this.meshMarker) {
                this.meshMarker.meshes = Array.from(this.meshes.values());
            }

            if (this.meshTransform) {
                // 현재 scene에 있는 meshes를 Array로 만들어 전달
                const meshArray = Array.from(this.meshes.values());
                this.meshTransform.meshes = meshArray;

                // 초기 상태 Map 초기화
                this.meshTransform.initialTransforms = new Map();

                // 각 Mesh의 userData.initialTransform을 MeshTransform.initialTransforms에 저장
                meshArray.forEach((mesh) => {
                    if (mesh.userData && mesh.userData.initialTransform) {
                        this.meshTransform.initialTransforms.set(
                            mesh.id,
                            mesh.userData.initialTransform
                        );
                    }
                });
            }

            // === ROI 모델 자동 활성화 (model 완전 로드 후) ===
            // 이 시점에는 model이 scene에 추가되고 모든 초기화가 완료됨
            if (this.toolbar && this.toolbar.lungVesselROI && this.toolbar.currentLoadedModel) {
                const modelName = this.toolbar.currentLoadedModel.toUpperCase();
                if (modelName.includes('ROI')) {
                    console.log(`[LiverViewer] ROI Model detected: ${modelName}, activating ROI vessel feature...`);
                    // 약간의 delay 추가 (모든 render 완료 후)
                    setTimeout(() => {
                        if (this.toolbar.lungVesselROI && !this.toolbar.lungVesselROI.isActive) {
                            this.toolbar.lungVesselROI.enableLungVesselROI();
                            console.log("[LiverViewer] ROI Vessel automatically activated after model load complete");
                        }
                    }, 100);
                }
            }

            // 로딩 화면 숨기기
            const loadingElement = document.getElementById("loading");
            if (loadingElement) {
                loadingElement.style.display = "none";
            }
        } catch (error) {
            console.error("Error in handleLoadComplete:", error);
            this.handleLoadError(error);
        }
    }

    handleLoadError(error) {
        ErrorHandler.handle(error, "Model Loading");
        if (this.externalModelProvider === VIEWER_PROVIDER.S3 && isS3DownloadUrlError(error)) {
            ErrorHandler.showErrorMessage(
                "The S3 download URL has expired. Please restart the viewer from the portal."
            );
            return;
        }
        const loadingElement = document.getElementById("loading");
        if (loadingElement) {
            loadingElement.textContent = "Error loading model";
            loadingElement.style.color = "red";
        }
    }

    toggleDarkMode() {
        console.log("LiverViewer toggleDarkMode called");
        this.isDarkMode = !this.isDarkMode;
        console.log("LiverViewer isDarkMode updated to:", this.isDarkMode);
    
        // Scene과 Material 업데이트 - 카메라가 활성화되지 않은 경우에만 배경 업데이트
        if (!this.cameraPlayer || !this.cameraPlayer.active) {
            this.scene.updateBackground(this.isDarkMode);
        }
        
        this.materialManager.updateMaterialsForDarkMode(this.isDarkMode);
    
        // 로고 업데이트 (다크모드에 맞게 필터 적용)
        if (this.logoManager) {
            this.logoManager.applyColorMode(this.isDarkMode);
        }
    
        // UI 컴포넌트 업데이트
        if (this.topBar) {
            console.log("Updating TopBar theme with isDarkMode:", this.isDarkMode);
            this.topBar.updateTheme(this.isDarkMode);
        }

        // Toolbar 테마 업데이트 (TopBar와 별도로)
        if (this.toolbar) {
            try {
                this.toolbar.updateTheme(this.isDarkMode);
            } catch (error) {
                console.error("Error calling toolbar.updateTheme:", error);
            }
        }
    
        // 여기서 카메라가 활성화되어 있으면 비디오 텍스처를 다시 배경으로 설정
        if (this.cameraPlayer && this.cameraPlayer.active) {
            console.log("카메라가 활성화되어 있어 비디오 텍스처를 다시 배경으로 설정");
            this.scene.background = this.cameraPlayer.videoTexture;
        }

        if (this.modelSelector) {
            console.log("Directly updating ModelSelector theme");
            this.modelSelector.updateTheme(this.isDarkMode);
        }

        // ObjectListPanel 테마 업데이트 추가
        if (this.objectListPanel) {
            console.log("Updating ObjectListPanel theme");
            this.objectListPanel.updateTheme(this.isDarkMode);
        }

        // 툴팁 테마 업데이트
        if (this.meshTooltip) {
            this.meshTooltip.updateTheme(this.isDarkMode);
        }

        // LoadingBar 테마 업데이트
        if (this.loadingBar) {
            this.loadingBar.updateTheme(this.isDarkMode);
        }

        if (this.zoomControl) {
            this.zoomControl.updateTheme(this.isDarkMode);
        }

        // FloatingModeButtons 테마 업데이트
        if (this.floatingModeButtons) {
            this.floatingModeButtons.setDarkMode(this.isDarkMode);
        }

    }

    startAnimation() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.tick();
        }
    }

    stopAnimation() {
        this.isAnimating = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    tick() {
        if (!this.isAnimating) return;

        const currentTime = performance.now();
        const elapsed = currentTime - this.lastFrameTime;

        if (elapsed < this.frameInterval) {
            this.animationFrameId = requestAnimationFrame(() => this.tick());
            return;
        }

        this.lastFrameTime = currentTime - (elapsed % this.frameInterval);

        try {
            // this.stats.begin();

            const delta = Math.min(elapsed / 1000, 0.1);

            // Set renderNeeded to true if anything changes
            let renderNeeded = false;

            // Update CameraPlayer (update video texture)
            if (this.cameraPlayer && this.cameraPlayer.active) {
                this.cameraPlayer.update();
                renderNeeded = true;
            }

            // Update animations
            if (this.modelLoader?.isAnimatable()) {
                const animated = this.modelLoader.updateAnimation(delta);
                if (animated) {
                    renderNeeded = true;
                }
            }

            // Update controls
            // damping이 활성화된 경우에만 업데이트 (ControlManager.update()에서도 처리하므로 중복 방지)
            if (this.controlManager?.controls) {
                // damping이 활성화되지 않은 경우에만 여기서 업데이트
                // damping이 활성화된 경우는 ControlManager.update()에서 처리
                if (!this.controlManager.controls.enableDamping) {
                    this.controlManager.controls.update();
                    renderNeeded = true;
                } else {
                    // damping이 활성화된 경우, ControlManager.update()를 호출
                    this.controlManager.update();
                    renderNeeded = true;
                }
            }

            // Update Transform Controls - only when meshes exist
            if (this.meshTransform && this.meshes.size > 0) {
                this.meshTransform.update(delta);
                renderNeeded = true;
            }

            // Render only when needed - single pass rendering
            if (renderNeeded && this.renderer && this.scene && this.camera) {
                // 투명 메시 렌더 순서 업데이트 (매 프레임)
                // 이것이 depthWrite conflict 해결의 핵심
                if (this.materialManager && this.scene) {
                    const allMeshes = [];
                    this.scene.traverse(obj => {
                        if (obj.isMesh) {
                            allMeshes.push(obj);
                        }
                    });
                    this.materialManager.updateTransparentMeshRenderOrder(this.camera, allMeshes);
                    // console.log('[LiverViewer.tick] Transparent mesh renderOrder updated');
                }

                // Update mesh label positions before rendering
                if (this.labelManager) {
                    this.labelManager.updateAllLabelsPosition();
                }

                // Stereoscopic 모드 렌더링
                if (this.renderMode === 'stereoscopic' && this.stereoscopicRenderer) {
                    this.stereoscopicRenderer.render((eyeCamera) => {
                        this.renderer.renderer.render(this.scene, eyeCamera);
                        if (this.renderer.labelRenderer) {
                            this.renderer.labelRenderer.render(this.scene, eyeCamera);
                        }
                    });
                } else {
                    // Standard rendering (background is already set in the scene)
                    this.renderer.render(this.scene, this.camera);

                    // Render labels on top
                    if (this.renderer.labelRenderer) {
                        this.renderer.labelRenderer.render(this.scene, this.camera);
                    }
                }

                this.renderNeeded = false;
            }

            // this.stats.end();
        } catch (error) {
            console.error("Error in animation loop:", error);
        }

        this.animationFrameId = requestAnimationFrame(() => this.tick());
    }

    // 리소스 정리를 위한 메서드 추가
    dispose() {
        try {
            console.log('[LiverViewer] Dispose started...');

            // 1. 애니메이션 루프 중지
            this.stopAnimation();

            // 2. 이벤트 리스너 제거
            this.removeEventListeners();

            // 3. CameraPlayer 정리
            if (this.cameraPlayer) {
                this.cameraPlayer.dispose();
                this.cameraPlayer = null;
            }

            // 4. LogoManager 정리
            if (this.logoManager) {
                this.logoManager.dispose();
                this.logoManager = null;
            }

            // 5. FloatingModeButtons 정리
            if (this.floatingModeButtons) {
                this.floatingModeButtons.destroy();
                this.floatingModeButtons = null;
            }

            // 6. XRHandler 정리
            if (this.xrHandler) {
                if (typeof this.xrHandler.dispose === 'function') {
                    this.xrHandler.dispose();
                }
                this.xrHandler = null;
            }

            // 7. StereoscopicRenderer 정리
            if (this.stereoscopicRenderer) {
                if (typeof this.stereoscopicRenderer.dispose === 'function') {
                    this.stereoscopicRenderer.dispose();
                }
                this.stereoscopicRenderer = null;
            }

            // 8. MeshTooltip 정리
            if (this.meshTooltip) {
                this.meshTooltip.dispose();
                this.meshTooltip = null;
            }

            // 9. UI 컴포넌트 정리
            if (this.topBar) {
                if (typeof this.topBar.dispose === 'function') {
                    this.topBar.dispose();
                }
                this.topBar = null;
            }

            if (this.toolbar) {
                if (typeof this.toolbar.dispose === 'function') {
                    this.toolbar.dispose();
                }
                this.toolbar = null;
            }

            if (this.modelSelector) {
                if (typeof this.modelSelector.dispose === 'function') {
                    this.modelSelector.dispose();
                }
                this.modelSelector = null;
            }

            if (this.objectListPanel) {
                if (typeof this.objectListPanel.dispose === 'function') {
                    this.objectListPanel.dispose();
                }
                this.objectListPanel = null;
            }

            if (this.textPanel) {
                if (typeof this.textPanel.dispose === 'function') {
                    this.textPanel.dispose();
                }
                this.textPanel = null;
            }

            if (this.panelManager) {
                if (typeof this.panelManager.dispose === 'function') {
                    this.panelManager.dispose();
                }
                this.panelManager = null;
            }

            if (this.loadingBar) {
                if (typeof this.loadingBar.dispose === 'function') {
                    this.loadingBar.dispose();
                }
                this.loadingBar = null;
            }

            if (this.zoomControl) {
                if (typeof this.zoomControl.dispose === 'function') {
                    this.zoomControl.dispose();
                }
                this.zoomControl = null;
            }

            // 10. ControlManager 정리
            if (this.controlManager) {
                this.controlManager.dispose();
                this.controlManager = null;
            }

            // 11. MaterialManager 정리
            if (this.materialManager) {
                if (typeof this.materialManager.dispose === 'function') {
                    this.materialManager.dispose();
                }
                this.materialManager = null;
            }

            // 12. ModelLoader 정리
            if (this.modelLoader) {
                if (typeof this.modelLoader.dispose === 'function') {
                    this.modelLoader.dispose();
                }
                this.modelLoader = null;
            }

            // 13. ResizeHandler 정리
            if (this.resizeHandler) {
                if (typeof this.resizeHandler.dispose === 'function') {
                    this.resizeHandler.dispose();
                }
                this.resizeHandler = null;
            }

            // 14. Scene 정리 (Scene의 모든 객체와 리소스 정리)
            if (this.scene) {
                this.scene.dispose();
                this.scene = null;
            }

            // 15. Renderer 정리 (Renderer의 WebGL 컨텍스트 정리)
            if (this.renderer) {
                this.renderer.dispose();
                this.renderer = null;
            }

            // 16. Camera 정리
            this.camera = null;

            // 17. meshes Map 정리
            this.meshes.clear();

            // 18. 전역 참조 제거
            if (window.liverViewer === this) {
                window.liverViewer = null;
            }
            if (window.liverAIzViewer === this) {
                window.liverAIzViewer = null;
            }

            console.log('[LiverViewer] Dispose completed successfully');
        } catch (error) {
            console.error('[LiverViewer] Error during dispose:', error);
        }
    }

    /**
     * 등록된 이벤트 리스너 제거
     */
    removeEventListeners() {
        try {
            // window resize 리스너 제거를 위해 정확한 핸들러를 저장해야 하나,
            // 현재 setupEventListeners에서 화살표 함수로 등록되어 있어 제거 불가능
            // 따라서 ResizeHandler에서 정리하거나 핸들러를 저장해야 함
            
            if (this.renderer && this.renderer.renderer && this.renderer.renderer.domElement) {
                // pointerdown 리스너 제거 (정확한 핸들러가 없어 불가능하므로 ResizeHandler에서 정리)
                // 대신 renderer 정리 시 domElement 제거로 리스너가 자동 정리됨
            }

            console.log('[LiverViewer] Event listeners cleanup initiated');
        } catch (error) {
            console.error('[LiverViewer] Error removing event listeners:', error);
        }
    }

    // 상태 변경시에만 렌더링 요청
    requestRender() {
        this.renderNeeded = true;
    }

    // 상태 변경 핸들러 추가
    handleStateChange(state) {
        if (this.isDarkMode !== state.isDarkMode) {
            this.isDarkMode = state.isDarkMode;
            this.scene.updateBackground(this.isDarkMode);
            this.materialManager.updateMaterialsForDarkMode(this.isDarkMode);
        }
    }

    // Toolbar에서 ModelSelector를 열 수 있도록 메서드 추가
    showModelSelector() {
        if (this.modelSelector) {
            this.modelSelector.show();
        }
    }

    /**
     * Floating Mode Buttons 초기화
     */
    setupFloatingModeButtons() {
        try {
            if (this.isMobile) {
                if (this.floatingModeButtons) {
                    this.floatingModeButtons.destroy();
                    this.floatingModeButtons = null;
                }

                console.log('[LiverViewer] FloatingModeButtons disabled on mobile devices');
                return;
            }

            this.floatingModeButtons = new FloatingModeButtons({
                onXRModeRequested: () => this.onXRModeRequested(),
                onStereoModeRequested: (mode) => {
                    if (this.renderMode === 'stereoscopic' && this.stereoscopicRenderer && this.stereoscopicRenderer.getMode() === mode) {
                        this.disableStereoscopic();
                        return;
                    }

                    this.enableStereoscopic(mode, this.stereoscopicAnamorphic ?? true);
                },
                onStereoAspectRequested: (anamorphic) => {
                    this.stereoscopicAnamorphic = Boolean(anamorphic);

                    if (this.renderMode === 'stereoscopic' && this.stereoscopicRenderer) {
                        this.stereoscopicRenderer.setAnamorphic(this.stereoscopicAnamorphic);
                        this.requestRender();
                    }

                    if (this.floatingModeButtons && this.stereoscopicRenderer) {
                        this.floatingModeButtons.setStereoscopicActive(
                            this.renderMode === 'stereoscopic',
                            this.stereoscopicRenderer.getMode(),
                            this.stereoscopicAnamorphic
                        );
                    }
                },
                isDarkMode: this.isDarkMode,
                isMobile: this.isMobile,
                liverViewer: this
            });

            // XRHandler 초기화
            this.xrHandler = new XRHandler(this);

            console.log('[LiverViewer] FloatingModeButtons and XRHandler initialized');
        } catch (error) {
            console.error('Error setting up floating mode buttons:', error);
            ErrorHandler.handle(error, 'FloatingModeButtons Setup');
        }
    }

    /**
     * XR Mode 요청 시 호출
     */
    onXRModeRequested() {
        console.log('[LiverViewer] XR Mode requested');
        
        if (this.xrHandler) {
            this.xrHandler.openXRMode();
        } else {
            alert('XR Handler is not initialized');
        }
    }

    /**
     * 3D SBS Mode 요청 시 호출
     */
    on3DGlassModeRequested() {
        console.log('[LiverViewer] 3D Glass Mode requested');
        
        if (this.renderMode === 'stereoscopic') {
            this.disableStereoscopic();
        } else {
            this.enableStereoscopic();
        }
    }

    /**
     * Stereoscopic 렌더링 활성화 (SBS 모드)
     */
    enableStereoscopic(mode = Constants.STEREOSCOPIC.DEFAULT_MODE || 'side-by-side', anamorphic = true) {
        try {
            // StereoscopicRenderer 초기화
            if (!this.stereoscopicRenderer) {
                this.stereoscopicRenderer = new StereoscopicRenderer(
                    this.renderer.renderer,
                    this.camera,
                    this.scene
                );
            }

            this.stereoscopicAnamorphic = Boolean(anamorphic);
            this.stereoscopicRenderer.setMode(mode);
            this.stereoscopicRenderer.setAnamorphic(this.stereoscopicAnamorphic);

            if (this.renderMode === 'stereoscopic') {
                if (this.floatingModeButtons) {
                    this.floatingModeButtons.setStereoscopicActive(true, this.stereoscopicRenderer.getMode(), this.stereoscopicAnamorphic);
                }

                this.requestRender();
                console.log('[LiverViewer] Stereoscopic mode switched:', this.stereoscopicRenderer.getMode());
                return;
            }

            this.renderMode = 'stereoscopic';

            // Stereoscopic 모드 활성화
            this.stereoscopicRenderer.enableStereoscopic();
            this.renderer.enableStereoscopicMode();

            if (this.floatingModeButtons) {
                this.floatingModeButtons.setStereoscopicActive(true, this.stereoscopicRenderer.getMode(), this.stereoscopicAnamorphic);
                // this.floatingModeButtons.hide(); // 버튼이 비활성화되어 있으므로 주석 처리
            }

            this.requestRender();

            console.log('[LiverViewer] Stereoscopic rendering enabled');
        } catch (error) {
            console.error('Error enabling stereoscopic rendering:', error);
            ErrorHandler.handle(error, 'Stereoscopic Enable');
        }
    }

    /**
     * Stereoscopic 렌더링 비활성화
     */
    disableStereoscopic() {
        try {
            if (this.renderMode !== 'stereoscopic') {
                console.warn('Stereoscopic mode is not active');
                return;
            }

            this.renderMode = 'standard';

            // Stereoscopic 모드 비활성화
            if (this.stereoscopicRenderer) {
                this.stereoscopicRenderer.disableStereoscopic();
            }

            this.renderer.disableStereoscopicMode();

            if (this.floatingModeButtons) {
                this.floatingModeButtons.setStereoscopicActive(false, null, this.stereoscopicAnamorphic ?? true);
                // this.floatingModeButtons.show(); // 버튼이 비활성화되어 있으므로 주석 처리
            }

            this.requestRender();

            console.log('[LiverViewer] Stereoscopic rendering disabled');
        } catch (error) {
            console.error('Error disabling stereoscopic rendering:', error);
            ErrorHandler.handle(error, 'Stereoscopic Disable');
        }
    }

    /**
     * 렌더링 모드 토글
     */
    /**
     * Hospital Integration - Load file from CLI argument
     * Called when the app is launched from hospital PACS with a file path
     * @param {string} filePath - Path to the model file or folder
     */
    loadFile(filePath) {
        try {
            console.log('[Hospital Integration] Loading file:', filePath);
            
            if (!filePath) {
                console.error('No file path provided');
                return;
            }

            // Check if it's a zip file or a folder
            if (filePath.endsWith('.zip')) {
                console.log('[Hospital Integration] Zip file detected:', filePath);
                // For now, we'll inform the user that automatic zip extraction
                // should be done by the hospital integration program
                // The viewer will then be called with the extracted folder path
                const folderPath = filePath.replace(/\.zip$/, '');
                this.loadFolderPath(folderPath);
            } else {
                // Assume it's a folder path
                this.loadFolderPath(filePath);
            }
        } catch (error) {
            console.error('[Hospital Integration] Error loading file:', error);
            ErrorHandler.handle(error, 'Hospital Integration File Load');
        }
    }

    /**
     * Load models from a folder path using ModelSelector
     * @param {string} folderPath - Path to folder containing models
     */
    loadFolderPath(folderPath) {
        try {
            console.log('[Hospital Integration] Loading from folder:', folderPath);
            
            if (!folderPath) {
                console.error('[Hospital Integration] No folder path provided');
                if (this.textPanel) {
                    try {
                        this.textPanel.addLog(
                            `❌ 폴더 경로가 없습니다`,
                            'error'
                        );
                    } catch (e) {
                        console.warn('[Hospital Integration] textPanel error:', e);
                    }
                }
                return;
            }

            if (!this.modelSelector) {
                console.error('[Hospital Integration] ModelSelector not initialized');
                if (this.textPanel) {
                    try {
                        this.textPanel.addLog(
                            `❌ ModelSelector가 준비되지 않았습니다`,
                            'error'
                        );
                    } catch (e) {
                        console.warn('[Hospital Integration] textPanel error:', e);
                    }
                }
                return;
            }

            console.log('[Hospital Integration] Using ModelSelector.loadFolderPath()');
            
            // Use ModelSelector's existing folder loading functionality
            this.modelSelector.loadFolderPath(folderPath)
                .then(() => {
                    console.log('[Hospital Integration] ✓ Folder loaded successfully');
                    if (this.textPanel) {
                        try {
                            this.textPanel.addLog(
                                `✅ 폴더 로드 완료`,
                                'success'
                            );
                        } catch (e) {
                            console.warn('[Hospital Integration] textPanel error:', e);
                        }
                    }
                })
                .catch((error) => {
                    console.error('[Hospital Integration] Error:', error);
                    if (this.textPanel) {
                        try {
                            this.textPanel.addLog(
                                `❌ 오류: ${error.message}`,
                                'error'
                            );
                        } catch (e) {
                            console.warn('[Hospital Integration] textPanel error:', e);
                        }
                    }
                });
        } catch (error) {
            console.error('[Hospital Integration] Error loading folder:', error);
            console.error('[Hospital Integration] Stack:', error.stack);
            try {
                ErrorHandler.handle(error, 'Hospital Integration Folder Load');
            } catch (e) {
                console.warn('[Hospital Integration] ErrorHandler failed:', e);
            }
        }
    }

    toggleRenderMode(newMode) {
        if (newMode === this.renderMode) {
            console.warn(`Already in ${newMode} mode`);
            return;
        }

        if (newMode === 'stereoscopic') {
            this.enableStereoscopic();
        } else if (newMode === 'standard') {
            this.disableStereoscopic();
        } else {
            console.error(`Unknown render mode: ${newMode}`);
        }
    }
}
