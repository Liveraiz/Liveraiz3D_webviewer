// loaders/ModelLoader.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { EXCLUDE_KEYWORDS } from "../utils/Constants";

export default class ModelLoader {
    constructor({
        scene,
        camera,
        materialManager,
        objectListPanel,
        meshes,
        onLoadComplete,
        onLoadError,
        modelPath,
        loadingBar,
        renderer,
        toolbar,
        hdriPath, // 추가: 조명용 HDRI 경로
    }) {
        this.scene = scene;
        this.camera = camera;
        this.materialManager = materialManager;
        this.objectListPanel = objectListPanel;
        this.meshes = new Map();
        this.onLoadComplete = onLoadComplete;
        this.onLoadError = onLoadError;
        this.modelPath = modelPath;
        this.mixer = null;
        this.animations = [];
        this.animationActions = new Map();
        this.isPlaying = true;
        this.clock = new THREE.Clock();
        this.loadingBar = loadingBar;
        this.renderer = renderer;
        
        // Toolbar 초기화
        if (toolbar) {
            console.log("Initializing Toolbar in ModelLoader");
            this.toolbar = toolbar;
            // Toolbar가 이미 초기화되어 있는지 확인
            if (!this.toolbar.container) {
                console.warn("Toolbar container not found, creating new container");
                const container = document.createElement('div');
                container.className = 'toolbar-container';
                document.body.appendChild(container);
                this.toolbar.container = container;
            }
        } else {
            console.warn("No Toolbar provided to ModelLoader");
        }

        // 디버깅
        console.log("ModelLoader initialized with:", {
            hasScene: !!scene,
            hasCamera: !!camera,
            hasObjectListPanel: !!objectListPanel,
            hasRenderer: !!renderer,
            hasToolbar: !!toolbar,
            modelPath: modelPath,
        });
        if (!this.scene) {
            throw new Error("Scene is required");
        }

        if (!this.camera) {
            throw new Error("Camera is required");
        }

        if (!this.modelPath) {
            throw new Error("Model path is required");
        }

        this.loader = new GLTFLoader();
        this.modelPaths = [
            "./models/LDLT_3D_simul.glb",
            "./models/HCC_5sections.glb",
            "./models/LDLT_D_fusion.glb",
            "./models/LDLT_CT-PP_HVt.glb",
            "./models/LDLT_CT-PP_RL.glb",
        ];
        this.currentModelIndex = this.modelPaths.indexOf(modelPath) || 0;

        // 파일 업로드 input 엘리먼트 생성
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.glb,.gltf';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);

        // 파일 선택 이벤트 리스너
        this.fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.loadLocalFile(file);
            }
        });

        // 애니메이션 컨트롤 관련 변수 추가
        this.animationSlider = null;
        this.animationTimeDisplay = null;
        this.animationPlayButton = null;
        this.currentAnimationTime = 0;
        this.maxAnimationDuration = 0;

        // HDRI 관련 상태
        this.hdriPath = hdriPath || './studio_country_hall_1k.hdr';
        this.hdriLoader = new RGBELoader();
        this.hdriLoaded = false;
        this.modelLoaded = false;
        this.hdriTexture = null;
        this._pendingGltf = null;
        this._pendingLoadingElem = null;
        this._pendingModel = null;
        this._pendingGltfAnimations = null;
        this._pendingGltfObject = null;
        this._pendingGltfScene = null;
        this._pendingGltfAllMeshes = null;
        this._pendingGltfVisibilityUpdates = null;
        this._pendingGltfModel = null;
        this._pendingGltfGltf = null;
        this._pendingGltfLoadingElem = null;
        this._pendingGltfGltfScene = null;
        this._pendingGltfGltfAnimations = null;
        this._pendingGltfGltfAllMeshes = null;
        this._pendingGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfModel = null;
        this._pendingGltfGltfGltf = null;
        this._pendingGltfGltfLoadingElem = null;
        this._pendingGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfScene = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAnimations = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfAllMeshes = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfVisibilityUpdates = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfModel = null;
        this._pendingGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltfGltf = null;
        this.loadModel();
    }

    createMesh(geometry, material, name) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = name;

        mesh.userData.initialTransform = {
            position: mesh.position.clone(),
            rotation: mesh.rotation.clone(),
            scale: mesh.scale.clone(),
        };

        return mesh;
    }

    loadModel(dropboxUrl = null) {
        try {
            // 기존 모델과 메시들을 제거
            this.resetScene();

            // 로딩 바 표시
            this.loadingBar.show();
            console.log('[LoadingBar] show()');
            this.loadingBar.setTitle("Loading Model...");
            console.log('[LoadingBar] setTitle:', "Loading Model...");
            this.loadingBar.setProgress(0);
            console.log('[LoadingBar] setProgress:', 0);
            this.loadingBar.setModelProgress(0);
            console.log('[LoadingBar] setModelProgress:', 0);
            this.loadingBar.setHDRIProgress(0);
            console.log('[LoadingBar] setHDRIProgress:', 0);

            const loadingElem = document.getElementById("loading");
            let modelPath = dropboxUrl || this.modelPath;
            console.log("Loading model from path:", modelPath);

            // Dropbox URL인 경우 modelPath 업데이트
            if (dropboxUrl) {
                this.modelPath = dropboxUrl;
            }

            // Dropbox URL 체크 및 변환
            if (modelPath.includes("dropbox.com")) {
                modelPath = this.convertDropboxLink(modelPath);
                console.log("Converted Dropbox URL:", modelPath);
            }

            // 상태 초기화
            this.modelLoaded = false;
            this.hdriLoaded = false;
            this._pendingGltf = null;
            this._pendingLoadingElem = loadingElem;

            // 1. 모델 로드
            this.loader.load(
                modelPath,
                (gltf) => {
                    console.log("Model loaded successfully");
                    // Dropbox 모델의 경우 조명 강도 조정
                    if (this.modelPath.includes("dropbox.com")) {
                        gltf.scene.traverse((child) => {
                            if (child.isMesh) {
                                if (child.material) {
                                    child.material.envMapIntensity = 0.5;
                                }
                            }
                        });
                    }
                    this.modelLoaded = true;
                    this._pendingGltf = gltf;
                    this._tryFinalizeLoad();
                },
                (xhr) => {
                    const percent = (xhr.loaded / xhr.total) * 100;
                    this.handleLoadProgress(xhr, loadingElem);
                    if (this.loadingBar) {
                        console.log('[LoadingBar] setModelProgress:', percent);
                    }
                },
                (error) => {
                    console.error("Error loading model:", error);
                    this.handleLoadError(error, loadingElem);
                    this.loadingBar.hide();
                }
            );

            // 2. HDRI(조명) 로드
            this.hdriLoader.load(
                this.hdriPath,
                (texture) => {
                    this.hdriLoaded = true;
                    this.hdriTexture = texture;
                    this._tryFinalizeLoad();
                },
                (xhr) => {
                    if (xhr.lengthComputable) {
                        const percent = (xhr.loaded / xhr.total) * 100;
                        if (this.loadingBar) {
                            this.loadingBar.setHDRIProgress(percent);
                            console.log('[LoadingBar] setHDRIProgress:', percent);
                        }
                    }
                },
                (error) => {
                    console.error("Error loading HDRI:", error);
                    if (this.loadingBar) {
                        this.loadingBar.setHDRIProgress(100);
                        console.log('[LoadingBar] setHDRIProgress:', 100);
                    }
                    // HDRI 실패 시에도 진행 (어둡게 보일 수 있음)
                    this.hdriLoaded = true;
                    this._tryFinalizeLoad();
                }
            );
        } catch (error) {
            console.error("Error in loadModel:", error);
            this.handleLoadError(error);
            this.loadingBar.hide();
        }
    }

    // 모델과 HDRI가 모두 로드되면 handleLoadSuccess 호출
    _tryFinalizeLoad() {
        if (this.modelLoaded && this.hdriLoaded) {
            // 조명 텍스처가 있으면 씬 환경에만 적용 (배경 이미지는 그대로)
            if (this.hdriTexture && this.scene) {
                this.hdriTexture.mapping = THREE.EquirectangularReflectionMapping;
                this.scene.environment = this.hdriTexture;
                // this.scene.background = this.hdriTexture; // 배경 이미지는 적용하지 않음
            }
            this.handleLoadSuccess(this._pendingGltf, this._pendingLoadingElem);
        }
    }

    convertDropboxLink(url) {
        try {
            if (url.includes("dropbox.com")) {
                // www.dropbox.com을 dl.dropboxusercontent.com으로 변경
                url = url.replace(
                    "www.dropbox.com",
                    "dl.dropboxusercontent.com"
                );

                // sharing을 raw로 변경
                url = url.replace("?dl=0", "");
                url = url.replace("?dl=1", "");
                url = url.replace("/sharing/", "/raw/");

                return url;
            }
            return url;
        } catch (error) {
            console.error("Error converting Dropbox link:", error);
            return url;
        }
    }

    /**
     * 셰이더 컴파일을 강제화하고 완료될 때까지 기다립니다.
     * @param {THREE.Object3D} model - 컴파일할 모델
     * @returns {Promise} 컴파일 완료 시 해결되는 Promise
     */
    async ensureModelShaderCompilation(model) {
        return new Promise((resolve) => {
            if (!this.renderer || !this.renderer.renderer) {
                console.warn("Renderer not available for model shader compilation");
                resolve();
                return;
            }

            try {
                const tempScene = new THREE.Scene();
                const tempCamera = new THREE.PerspectiveCamera();
                tempScene.add(model);

                // 셰이더 컴파일을 위한 렌더링
                this.renderer.renderer.render(tempScene, tempCamera);
                console.log("Shader compilation completed successfully");
            } catch (error) {
                console.warn("Error during shader compilation:", error);
            }
            resolve();
        });
    }

    async handleLoadSuccess(gltf, loadingElem) {
        try {
            console.log("Model loaded successfully");

            // 모델 로딩 완료 - 100%
            if (this.loadingBar) {
                this.loadingBar.setModelProgress(100);
                console.log('[LoadingBar] setModelProgress:', 100);
            }

            const model = gltf.scene;

            // HDRI 조명 세기 조정: 모든 메쉬의 envMapIntensity를 1.0로 설정
            model.traverse((child) => {
                if (child.isMesh && child.material && 'envMapIntensity' in child.material) {
                    child.material.envMapIntensity = 1.0;
                }
            });

            // 셰이더 컴파일 시작 - 0%
            if (this.loadingBar) {
                this.loadingBar.setShaderProgress(0);
                console.log('[LoadingBar] setShaderProgress:', 0);
            }

            // 모델의 셰이더 컴파일 보장
            console.log("Starting shader compilation for the model...");
            await this.ensureModelShaderCompilation(model);
            console.log("Shader compilation completed");

            // 셰이더 컴파일 완료 - 100%
            if (this.loadingBar) {
                this.loadingBar.setShaderProgress(100);
                console.log('[LoadingBar] setShaderProgress:', 100);
            }

            // 로딩 완료 프로세스 수정
            setTimeout(() => {
                if (this.loadingBar) {
                    this.loadingBar.hide();
                    console.log('[LoadingBar] hide()');
                }
            }, 500);

            // 모델 초기화 계속 진행
            this.scene.add(model);

            // Empty 오브젝트와 메시 디폼 설정
            this.setupMeshDeform(model);

            // 애니메이션 처리 부분 수정
            this.animations = gltf.animations || [];
            if (this.animations.length > 0) {
                console.log(`Found ${this.animations.length} animations:`, 
                    this.animations.map(a => a.name));
                
                // 애니메이션 상세 정보 로깅
                this.animations.forEach(animation => {
                    console.log(`Animation details for ${animation.name}:`, {
                        duration: animation.duration,
                        tracks: animation.tracks.length,
                        fps: animation.fps,
                        timeScale: animation.timeScale
                    });
                });

                this.mixer = new THREE.AnimationMixer(model);

                // 모든 애니메이션 동시 재생
                this.animations.forEach(animation => {
                    console.log(`Setting up animation: ${animation.name}`);
                    const action = this.mixer.clipAction(animation);
                    
                    // 애니메이션 설정
                    action.setLoop(THREE.LoopRepeat);
                    action.clampWhenFinished = false;
                    action.enabled = true;
                    
                    this.animationActions.set(animation.name, action);
                    
                    // 애니메이션 재생
                    console.log(`Playing animation: ${animation.name}`);
                    action.reset();
                    action.play();
                });

                this.isPlaying = true;
                this.mixer.timeScale = 1.0;

                // 최대 애니메이션 길이 계산 (가장 긴 애니메이션 기준)
                this.maxAnimationDuration = Math.max(...this.animations.map(anim => anim.duration));
                console.log(`Max animation duration: ${this.maxAnimationDuration}`);

                // 애니메이션 컨트롤 UI 생성
                this.createAnimationControls();
                if (this.animationSlider) {
                    this.animationSlider.max = '100';
                    this.updateTimeDisplay(0);
                    this.updatePlayButtonState();
                }

                // 애니메이션 컨트롤 표시 및 버튼 초기화
                if (this.toolbar) {
                    this.toolbar.showAnimationControls(true);
                    
                    // 애니메이션 버튼이 없으면 생성
                    if (!this.toolbar.animationButton) {
                        console.log("Creating animation button");
                        this.toolbar.createAnimationButton();
                    }
                    
                    // 애니메이션 버튼 상태 업데이트
                    if (this.toolbar.animationButton) {
                        this.toolbar.animationButton.classList.add('active');
                        this.toolbar.animationButton.setAttribute('data-playing', 'true');
                    }
                }
            }

            // 모든 메시 수집
            const allMeshes = [];
            model.traverse((child) => {
                if (child.isMesh) {
                    allMeshes.push(child);
                }
            });

            // MaterialManager를 통해 겹치는 메시 처리
            const visibilityUpdates =
                this.materialManager.handleOverlappingMeshes(allMeshes);

            // 가시성 업데이트 적용
            visibilityUpdates.forEach((isVisible, meshName) => {
                const mesh = allMeshes.find((m) => m.name === meshName);
                if (mesh) {
                    console.log(
                        `Applying visibility ${isVisible} to mesh ${meshName}`
                    );
                    mesh.visible = isVisible;

                    // meshes Map 업데이트
                    if (isVisible) {
                        this.meshes.set(meshName, mesh);
                    } else {
                        this.meshes.delete(meshName);
                        console.log(
                            `Removed ${meshName} from meshes Map due to visibility`
                        );
                    }
                }
            });

            // ObjectListPanel 업데이트 (보이는 객체만)
            if (this.objectListPanel) {
                const visibleMeshes = Array.from(this.meshes.values()).filter(
                    (mesh) => mesh.visible
                );
                this.objectListPanel.updateObjectList(visibleMeshes);
            }

            // 바운딩 박스 계산 (visible이고 필터링되지 않은 객체만 포함)
            const visibleObjects = model.children.filter(
                (obj) =>
                    obj.visible &&
                    !EXCLUDE_KEYWORDS.some((keyword) =>
                        obj.name.includes(keyword)
                    )
            );

            if (visibleObjects.length > 0) {
                const boundingBox = new THREE.Box3();
                visibleObjects.forEach((obj) =>
                    boundingBox.expandByObject(obj)
                );
                const center = new THREE.Vector3();
                boundingBox.getCenter(center);

                // 모델 중앙 정렬
                model.position.sub(center);

                // 카메라 위치 자동 조정
                this.fitCameraToObject(model);
            }

            // onLoadComplete 호출 시 애니메이션 존재 여부 전달
            if (this.onLoadComplete) {
                const hasAnimations = this.animations.length > 0;
                console.log("Calling onLoadComplete with hasAnimations:", hasAnimations);
                this.onLoadComplete(hasAnimations);
            }

            if (loadingElem) {
                loadingElem.style.display = "none";
            }

            model.traverse((child) => {
                if (child.isMesh) {
                    if (child.material) {
                        // See-through 효과를 위해 FrontSide를 DoubleSide로 변경
                        child.material.side = THREE.DoubleSide;

                        // 투명도가 있는 경우
                        if (child.material.transparent) {
                            // 초기 투명도 값을 0.60으로 설정 (소수점 2자리)
                            child.material.opacity = 0.60;
                            // 알파 테스트 값 설정 (소수점 2자리)
                            child.material.alphaTest = 0.30;
                            // 블렌딩 모드 설정
                            child.material.blending = THREE.NormalBlending;
                            // 깊이 쓰기 활성화
                            child.material.depthWrite = true;
                            
                            // 재질 업데이트를 위한 메서드 추가
                            child.material.setOpacity = (value) => {
                                // 소수점 4자리까지 유지 (더 정밀한 계산을 위해)
                                const preciseValue = Math.round(value * 10000) / 10000;
                                // 최종적으로 소수점 2자리까지 표시
                                const roundedValue = Math.round(preciseValue * 100) / 100;
                                child.material.opacity = Math.max(0, Math.min(1, roundedValue));
                                child.material.needsUpdate = true;
                                
                                // 디버깅을 위한 로그 추가
                                console.log(`Material opacity updated:`, {
                                    original: value,
                                    precise: preciseValue,
                                    rounded: roundedValue,
                                    final: child.material.opacity
                                });
                            };
                            
                            child.material.setAlphaTest = (value) => {
                                // 소수점 4자리까지 유지
                                const preciseValue = Math.round(value * 10000) / 10000;
                                // 최종적으로 소수점 2자리까지 표시
                                const roundedValue = Math.round(preciseValue * 100) / 100;
                                child.material.alphaTest = Math.max(0, Math.min(1, roundedValue));
                                child.material.needsUpdate = true;
                                
                                // 디버깅을 위한 로그 추가
                                console.log(`Material alphaTest updated:`, {
                                    original: value,
                                    precise: preciseValue,
                                    rounded: roundedValue,
                                    final: child.material.alphaTest
                                });
                            };

                            // 초기 재질 정보 로깅
                            console.log(`Initial material settings for ${child.name}:`, {
                                opacity: child.material.opacity,
                                alphaTest: child.material.alphaTest,
                                transparent: child.material.transparent,
                                blending: child.material.blending
                            });
                        }
                    }
                }
            });

            // 렌더링 요청
            if (this.liverViewer) {
                this.liverViewer.requestRender();
            }
        } catch (error) {
            console.error("Error in handleLoadSuccess:", error);
            this.handleLoadError(error, loadingElem);
        }
    }

    setupMesh(mesh, orgPosition) {
        if (!this.meshes) {
            this.meshes = new Map();
        }
        mesh.position.copy(orgPosition);
        this.scene.add(mesh);
        this.meshes.set(mesh.name, mesh);
    }

    fitCameraToObject(object, offset = 2.5) {
        const boundingBox = new THREE.Box3().setFromObject(object);
        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);

        const aspect = window.innerWidth / window.innerHeight;
        let distance;

        if (aspect > 1) {
            const horizontalFov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
            distance = maxDim / 2 / Math.tan(horizontalFov / 2);
        } else {
            distance = maxDim / 2 / Math.tan(fov / 2);
        }

        distance *= offset;

        this.camera.position.set(0, 0, distance);
        this.camera.lookAt(center);

        this.camera.near = 0.01;
        this.camera.far = distance * 100;
        this.camera.updateProjectionMatrix();

        if (this.camera.controls) {
            this.camera.controls.target.copy(center);
            this.camera.controls.maxDistance = distance * 2;
            this.camera.controls.minDistance = 0.1;
            this.camera.controls.update();
        }
    }

    handleLoadProgress(xhr, loadingElem) {
        const percent = (xhr.loaded / xhr.total) * 100;
        console.log(`Model loading progress: ${Math.round(percent)}%`);

        // 향상된 LoadingBar API 사용
        if (this.loadingBar) {
            this.loadingBar.setModelProgress(percent);
        }

        if (loadingElem) {
            loadingElem.textContent = `Loading: ${Math.round(percent)}%`;
        }
    }

    handleLoadError(error, loadingElem) {
        console.error("Error loading model:", error);
        if (loadingElem) {
            loadingElem.textContent = "Error loading model";
        }
        if (this.onLoadError) {
            this.onLoadError(error);
        }
    }

    showModelSelector() {
        console.log("ModelLoader.showModelSelector 호출됨");
        console.log("ModelSelector 존재 여부:", !!this.modelSelector);
        console.log("ModelSelector:", this.modelSelector);

        if (this.modelSelector) {
            console.log("ModelSelector.show 호출 시도");
            this.modelSelector.show();
        } else {
            console.warn("ModelSelector가 초기화되지 않았습니다.");
        }
    }

    clearScene() {
        // 초기화 로직 구현
    }

    resetScene() {
        // 기존 메시들을 제거하고 리소스 해제
        if (this.meshes) {
            this.meshes.forEach((mesh) => {
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach((m) => m.dispose());
                    } else {
                        mesh.material.dispose();
                    }
                }
                this.scene.remove(mesh);
            });
            this.meshes.clear();
        }

        this.labelDispose();

        // 씬에서 모든 3D 객체 제거
        const objectsToRemove = [];
        this.scene.traverse((object) => {
            if (object.isMesh || object.isGroup) {
                objectsToRemove.push(object);
            }
        });

        objectsToRemove.forEach((object) => {
            this.scene.remove(object);
        });

        // ObjectListPanel 초기화
        if (this.objectListPanel) {
            this.objectListPanel.clearList();
        }

        // 애니메이션 컨트롤 제거
        if (this.toolbar) {
            this.toolbar.removeAnimationControls();
        }
        this.animationSlider = null;
        this.animationTimeDisplay = null;
        this.animationPlayButton = null;
    }

    //애니메이션 재생 여부 확인
    isAnimatable() {
        return this.animations && this.animations.length > 0 && this.mixer !== null;
    }

    //애니메이션 재생
    playAnimation(name = "RIG-ArmatureAction.002") {
        console.log(`Attempting to play animation: ${name}`);
        const action = this.animationActions.get(name);
        if (action) {
            // 다른 모든 애니메이션 중지
            this.animationActions.forEach((otherAction) => {
                if (otherAction !== action) {
                    otherAction.stop();
                }
            });

            this.isPlaying = true;
            this.mixer.timeScale = 1.0;
            action.reset();
            action.play();
            
            // 애니메이션 설정 확인
            console.log(`Animation settings after play for ${name}:`, {
                duration: action.getClip().duration,
                timeScale: action.timeScale,
                weight: action.weight,
                loop: action.loop,
                isPlaying: action.isRunning()
            });
            
            return true;
        }
        console.warn(`Animation not found: ${name}`);
        return false;
    }

    //애니메이션 일시정지
    pauseAnimation() {
        if (this.mixer) {
            this.isPlaying = false;
            this.mixer.timeScale = 0;
            console.log("Animation paused");
        }
    }

    //애니메이션 업데이트
    updateAnimation(delta) {
        if (this.mixer) {
            this.mixer.update(delta);
            return true;
        }
        return false;
    }

    //애니메이션 존재 여부 확인
    hasAnimation(name) {
        const action = this.animationActions.get(name);
        if (action) {
            const clip = action.getClip();
            // Action으로 시작하고 트랙 수가 적은 애니메이션만 유효한 것으로 간주
            return clip.name.startsWith("Action") && clip.tracks.length < 10;
        }
        return false;
    }

    //애니메이션 지속 시간 확인
    getAnimationDuration(name = "RIG-ArmatureAction.002") {
        const action = this.animationActions.get(name);
        if (action) {
            const duration = action.getClip().duration;
            console.log(`Animation duration for ${name}: ${duration}`);
            return duration;
        }
        console.warn(`Animation duration not found for: ${name}`);
        return 0;
    }

    //애니메이션 시간 설정
    setAnimationTime(time) {
        if (!this.mixer) return;
        
        this.currentAnimationTime = time;
        
        // 모든 애니메이션 액션의 시간 동기화
        this.animationActions.forEach(action => {
            const duration = action.getClip().duration;
            const normalizedTime = time % duration;
            action.time = normalizedTime;
            action.needsUpdate = true;
        });

        // Empty 오브젝트와 연결된 메시들의 위치 업데이트
        this.scene.traverse((child) => {
            if (child.isMesh && child.userData.modifiers?.meshDeform) {
                const empty = child.parent;
                if (empty && (empty.type === 'Empty' || empty.userData.type === 'Empty')) {
                    // Empty 오브젝트의 현재 변환을 메시에 적용
                    child.position.copy(empty.position);
                    child.quaternion.copy(empty.quaternion);
                    child.scale.copy(empty.scale);
                }
            }
        });
    }

    // labelDispose 메서드 수정
    labelDispose() {
        if (this.volumeTextBox) {
            this.volumeTextBox.dispose();
        }
    }

    // animate 메서드 수정
    animate() {
        if (this.volumeTextBox) {
            this.volumeTextBox.update();
        }

        if (this.mixer && this.isPlaying) {
            const delta = this.clock.getDelta();
            this.mixer.update(delta);
            
            // 현재 애니메이션 시간 업데이트
            this.currentAnimationTime = this.mixer.time;
            if (this.animationSlider) {
                const normalizedValue = (this.currentAnimationTime % this.maxAnimationDuration) / this.maxAnimationDuration * 100;
                this.animationSlider.value = normalizedValue;
                this.updateTimeDisplay(this.currentAnimationTime);
            }
        }
    }

    // Z-fighting 처리 메서드
    handleZFighting(mesh, meshBoundingBoxes) {
        const currentBox = mesh.geometry.boundingBox;
        let overlappingCount = 0;
        let exactMatchCount = 0;

        // 다른 메시들과의 겹침 체크
        meshBoundingBoxes.forEach((otherBox, uuid) => {
            if (mesh.uuid !== uuid) {
                if (this.checkBoxOverlap(currentBox, otherBox)) {
                    overlappingCount++;

                    // 정확히 같은 바운딩 박스인지 체크
                    if (this.checkExactBoxMatch(currentBox, otherBox)) {
                        exactMatchCount++;
                    }
                }
            }
        });

        // 정확히 같은 위치의 버텍스를 가진 메시 체크
        const vertexPositions = this.getVertexPositions(mesh);
        meshBoundingBoxes.forEach((otherBox, uuid) => {
            if (mesh.uuid !== uuid) {
                const otherMesh = this.meshes.get(uuid);
                if (
                    otherMesh &&
                    this.hasIdenticalVertices(
                        vertexPositions,
                        this.getVertexPositions(otherMesh)
                    )
                ) {
                    console.log(
                        `Found identical geometry for: ${mesh.name} and ${otherMesh.name}`
                    );
                    exactMatchCount += 2; // 더 큰 가중치 부여
                }
            }
        });

        if (overlappingCount > 0) {
            if (mesh.material) {
                // 더 세밀한 렌더링 순서 조정
                const centerPos = new THREE.Vector3();
                mesh.geometry.computeBoundingSphere();
                mesh.geometry.boundingSphere.center.clone(centerPos);

                // 공간상의 위치를 고려한 렌더링 순서
                const renderOrderBase = Math.floor(centerPos.z * 1000);
                const renderOrderY = Math.floor(centerPos.y * 100);
                const renderOrderX = Math.floor(centerPos.x * 10);

                mesh.renderOrder =
                    renderOrderBase + renderOrderY + renderOrderX;

                // 더 큰 오프셋 적용
                mesh.material.polygonOffset = true;
                mesh.material.polygonOffsetFactor =
                    (overlappingCount + exactMatchCount) * 3;
                mesh.material.polygonOffsetUnits = 2;

                // 깊이 버퍼 설정 강화
                mesh.material.depthWrite = true;
                mesh.material.depthTest = true;

                // 투명도가 있는 경우 추가 처리
                if (mesh.material.transparent) {
                    mesh.renderOrder += 2000;
                    mesh.material.depthWrite = false;
                }
            }
        }
    }

    // 정확한 바운딩 박스 일치 체크
    checkExactBoxMatch(box1, box2) {
        const tolerance = 0.0001; // 작은 오차 허용
        return (
            Math.abs(box1.min.x - box2.min.x) < tolerance &&
            Math.abs(box1.min.y - box2.min.y) < tolerance &&
            Math.abs(box1.min.z - box2.min.z) < tolerance &&
            Math.abs(box1.max.x - box2.max.x) < tolerance &&
            Math.abs(box1.max.y - box2.max.y) < tolerance &&
            Math.abs(box1.max.z - box2.max.z) < tolerance
        );
    }

    // 메시 볼륨 계산
    calculateMeshVolume(mesh) {
        const box = mesh.geometry.boundingBox;
        return (
            (box.max.x - box.min.x) *
            (box.max.y - box.min.y) *
            (box.max.z - box.min.z)
        );
    }

    // 메시 표면적 계산 (근사값)
    calculateSurfaceArea(mesh) {
        let area = 0;
        const geometry = mesh.geometry;

        if (geometry.index !== null) {
            const position = geometry.attributes.position;
            const index = geometry.index;

            for (let i = 0; i < index.count; i += 3) {
                const a = new THREE.Vector3().fromBufferAttribute(
                    position,
                    index.getX(i)
                );
                const b = new THREE.Vector3().fromBufferAttribute(
                    position,
                    index.getX(i + 1)
                );
                const c = new THREE.Vector3().fromBufferAttribute(
                    position,
                    index.getX(i + 2)
                );

                // 삼각형 면적 계산
                const triangle = new THREE.Triangle(a, b, c);
                area += triangle.getArea();
            }
        }

        return area;
    }

    // 바운딩 박스 겹침 체크
    checkBoxOverlap(box1, box2) {
        const tolerance = 0.001; // 작은 오차 허용
        return (
            box1.min.x <= box2.max.x + tolerance &&
            box1.max.x >= box2.min.x - tolerance &&
            box1.min.y <= box2.max.y + tolerance &&
            box1.max.y >= box2.min.y - tolerance &&
            box1.min.z <= box2.max.z + tolerance &&
            box1.max.z >= box2.min.z - tolerance
        );
    }

    // 메시의 버텍스 위치 배열 얻기
    getVertexPositions(mesh) {
        const positions = [];
        const positionAttribute = mesh.geometry.attributes.position;

        for (let i = 0; i < positionAttribute.count; i++) {
            positions.push(
                new THREE.Vector3(
                    positionAttribute.getX(i),
                    positionAttribute.getY(i),
                    positionAttribute.getZ(i)
                )
            );
        }
        return positions;
    }

    // 두 메시의 버텍스가 동일한지 체크
    hasIdenticalVertices(vertices1, vertices2) {
        if (vertices1.length !== vertices2.length) return false;

        const tolerance = 0.0001;
        for (let i = 0; i < vertices1.length; i++) {
            const v1 = vertices1[i];
            const v2 = vertices2[i];
            if (
                Math.abs(v1.x - v2.x) > tolerance ||
                Math.abs(v1.y - v2.y) > tolerance ||
                Math.abs(v1.z - v2.z) > tolerance
            ) {
                return false;
            }
        }
        return true;
    }

    // 겹치는 메시 찾기
    findOverlappingMeshes(info, meshInfo) {
        const overlapping = [];
        meshInfo.forEach((otherInfo, otherUuid) => {
            if (
                otherUuid !== info.mesh.uuid &&
                this.checkBoxOverlap(info.boundingBox, otherInfo.boundingBox)
            ) {
                overlapping.push(otherInfo);
            }
        });
        return overlapping;
    }

    // 로컬 파일 업로드 메서드 추가
    loadLocalFile(file) {
        try {
            // 기존 모델과 메시들을 제거
            this.resetScene();

            // 로딩 바 표시
            this.loadingBar.show();
            this.loadingBar.setTitle("Loading Local File...");
            this.loadingBar.setProgress(0);

            const reader = new FileReader();
            
            reader.onload = (e) => {
                const arrayBuffer = e.target.result;
                
                // GLTFLoader로 로컬 파일 로드
                this.loader.parse(arrayBuffer, '', (gltf) => {
                    console.log("Local file loaded successfully");
                    this.handleLoadSuccess(gltf, null);
                }, (error) => {
                    console.error("Error parsing local file:", error);
                    this.handleLoadError(error, null);
                });
            };

            reader.onerror = (error) => {
                console.error("Error reading file:", error);
                this.handleLoadError(error, null);
            };

            reader.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = (event.loaded / event.total) * 100;
                    this.handleLoadProgress({ loaded: event.loaded, total: event.total }, null);
                }
            };

            reader.readAsArrayBuffer(file);
        } catch (error) {
            console.error("Error in loadLocalFile:", error);
            this.handleLoadError(error, null);
        }
    }

    // 파일 선택 다이얼로그 열기 메서드
    openFileDialog() {
        this.fileInput.click();
    }

    setupMeshDeform(model) {
        // Empty 오브젝트 찾기
        const emptyObjects = [];
        model.traverse((child) => {
            if (child.type === 'Empty' || child.userData.type === 'Empty') {
                console.log(`Found Empty object: ${child.name}`, child);
                emptyObjects.push(child);
            }
        });

        // 메시 디폼 처리
        model.traverse((child) => {
            if (child.isMesh) {
                // 모디파이어가 적용된 메시 처리
                if (child.userData.modifiers) {
                    // Mesh Deform 모디파이어 처리
                    if (child.userData.modifiers.meshDeform) {
                        const deformData = child.userData.modifiers.meshDeform;
                        console.log(`Found mesh deform modifier for ${child.name}:`, deformData);
                        
                        // Empty 오브젝트를 기준점으로 사용
                        if (deformData.target && emptyObjects.length > 0) {
                            const targetEmpty = emptyObjects.find(empty => 
                                empty.name === deformData.target || 
                                empty.uuid === deformData.target
                            );
                            
                            if (targetEmpty) {
                                console.log(`Found target Empty for ${child.name}: ${targetEmpty.name}`);
                                
                                // Empty 오브젝트의 위치를 기준으로 메시 디폼 적용
                                child.position.copy(targetEmpty.position);
                                child.quaternion.copy(targetEmpty.quaternion);
                                child.scale.copy(targetEmpty.scale);
                                
                                // Empty 오브젝트를 부모로 설정
                                targetEmpty.add(child);
                                
                                // 원래 위치 저장
                                child.userData.originalTransform = {
                                    position: child.position.clone(),
                                    quaternion: child.quaternion.clone(),
                                    scale: child.scale.clone()
                                };
                            }
                        }
                        
                        // Mesh Deform 모디파이어가 있는 경우 해당 메시를 애니메이션에 연결
                        if (this.mixer) {
                            const action = this.animations.find(anim => anim.name.startsWith('Action'));
                            if (action) {
                                const deformAction = this.mixer.clipAction(action);
                                deformAction.play();
                                console.log(`Playing mesh deform animation for ${child.name}`);
                            }
                        }
                    }
                }
            }
        });
    }

    //애니메이션 컨트롤 표시 여부
    showAnimationControls(show) {
        if (this.toolbar) {
            const hasAnimations = this.animations && this.animations.length > 0;
            const hasRigAnimation = this.animations.some(anim => anim.name.startsWith('RIG-'));
            
            if (hasAnimations && hasRigAnimation) {
                console.log("Showing animation controls for RIG animation");
                this.toolbar.showAnimationControls(true);
                
                // 애니메이션 버튼이 없으면 생성
                if (!this.toolbar.animationButton) {
                    console.log("Creating animation button");
                    this.toolbar.createAnimationButton();
                }
            } else {
                console.log("No RIG animations found, hiding animation controls");
                this.toolbar.showAnimationControls(false);
            }
        } else {
            console.warn("Toolbar not available for animation controls");
        }
    }

    // 애니메이션 컨트롤 UI 생성 메서드
    createAnimationControls() {
        if (!this.toolbar) {
            console.warn("Toolbar not available for animation controls");
            return;
        }

        console.log("Creating animation controls");
        // 애니메이션 컨트롤 컨테이너
        const container = document.createElement('div');
        container.className = 'animation-controls';
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 5px;
            margin: 10px;
        `;

        // 재생 버튼
        const playButton = document.createElement('button');
        playButton.className = 'animation-play-button';
        playButton.innerHTML = '▶';
        playButton.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 16px;
            cursor: pointer;
            padding: 5px;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
        `;

        // 자동재생 버튼
        const autoPlayButton = document.createElement('button');
        autoPlayButton.className = 'animation-autoplay-button';
        autoPlayButton.innerHTML = '🔄';
        autoPlayButton.title = '자동재생';
        autoPlayButton.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 16px;
            cursor: pointer;
            padding: 5px;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
        `;

        // 슬라이더
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = '0';
        slider.className = 'animation-slider';
        slider.style.cssText = `
            flex: 1;
            height: 5px;
            -webkit-appearance: none;
            background: #ddd;
            border-radius: 5px;
            outline: none;
        `;

        // 시간 표시
        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'animation-time';
        timeDisplay.style.cssText = `
            color: white;
            font-size: 12px;
            min-width: 60px;
            text-align: right;
        `;

        container.appendChild(playButton);
        container.appendChild(autoPlayButton);
        container.appendChild(slider);
        container.appendChild(timeDisplay);

        // 툴바에 컨트롤 추가
        this.toolbar.addAnimationControls(container);

        this.animationSlider = slider;
        this.animationTimeDisplay = timeDisplay;
        this.animationPlayButton = playButton;
        this.animationAutoPlayButton = autoPlayButton;

        // 슬라이더 이벤트 리스너
        const stopAutoplay = () => {
            console.log("Stopping autoplay");
            this.isPlaying = false;
            if (this.mixer) {
                this.mixer.timeScale = 0;
            }
            this.updatePlayButtonState();
            if (this.animationAutoPlayButton) {
                this.animationAutoPlayButton.style.background = 'rgba(255, 255, 255, 0.2)';
                this.animationAutoPlayButton.setAttribute('data-playing', 'false');
            }
        };

        slider.addEventListener('mousedown', stopAutoplay);
        slider.addEventListener('touchstart', stopAutoplay);

        slider.addEventListener('input', (e) => {
            const value = e.target.value;
            const normalizedTime = (value / 100) * this.maxAnimationDuration;
            this.setAnimationTime(normalizedTime);
            this.updateTimeDisplay(normalizedTime);
        });

        // 재생 버튼 이벤트 리스너
        playButton.addEventListener('click', () => {
            console.log("Play button clicked, current state:", this.isPlaying);
            if (this.isPlaying) {
                this.pauseAnimation();
            } else {
                this.resumeAnimation();
            }
            this.updatePlayButtonState();
        });

        // 자동재생 버튼 이벤트 리스너
        autoPlayButton.addEventListener('click', () => {
            console.log("Autoplay button clicked, current state:", this.isPlaying);
            this.isPlaying = !this.isPlaying;
            if (this.isPlaying) {
                if (this.mixer) {
                    this.mixer.timeScale = 1.0;
                }
                autoPlayButton.style.background = 'rgba(255, 255, 255, 0.3)';
                autoPlayButton.setAttribute('data-playing', 'true');
                playButton.style.background = 'rgba(255, 255, 255, 0.3)';
                playButton.innerHTML = '⏸';
            } else {
                if (this.mixer) {
                    this.mixer.timeScale = 0;
                }
                autoPlayButton.style.background = 'rgba(255, 255, 255, 0.2)';
                autoPlayButton.setAttribute('data-playing', 'false');
                playButton.style.background = 'rgba(255, 255, 255, 0.2)';
                playButton.innerHTML = '▶';
            }
        });

        console.log("Animation controls created successfully");
    }

    // 재생 버튼 상태 업데이트
    updatePlayButtonState() {
        if (this.animationPlayButton) {
            this.animationPlayButton.innerHTML = this.isPlaying ? '⏸' : '▶';
            this.animationPlayButton.style.background = this.isPlaying ? 
                'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)';
            this.animationPlayButton.setAttribute('data-playing', this.isPlaying.toString());
        }
    }

    // 애니메이션 일시정지
    pauseAnimation() {
        console.log("Pausing animation");
        this.isPlaying = false;
        if (this.mixer) {
            this.mixer.timeScale = 0;
        }
        if (this.animationAutoPlayButton) {
            this.animationAutoPlayButton.style.background = 'rgba(255, 255, 255, 0.2)';
            this.animationAutoPlayButton.setAttribute('data-playing', 'false');
        }
    }

    // 애니메이션 재개
    resumeAnimation() {
        console.log("Resuming animation");
        this.isPlaying = true;
        if (this.mixer) {
            this.mixer.timeScale = 1.0;
        }
        if (this.animationAutoPlayButton) {
            this.animationAutoPlayButton.style.background = 'rgba(255, 255, 255, 0.3)';
            this.animationAutoPlayButton.setAttribute('data-playing', 'true');
        }
    }

    // 시간 표시 업데이트
    updateTimeDisplay(time) {
        if (!this.animationTimeDisplay) return;
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        this.animationTimeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * 현재 활성화된 애니메이션이 있는지 확인
     * @returns {boolean} - 활성화된 애니메이션 여부
     */
    hasActiveAnimation() {
        if (!this.mixer || !this.animationActions) {
            return false;
        }
        
        // 애니메이션 액션이 있고 재생 중인지 확인
        for (const [_, action] of this.animationActions) {
            if (action && action.isRunning()) {
                return true;
            }
        }
        
        // 또는 자동재생이 활성화되어 있는지 확인
        return this.isPlaying;
    }
}
