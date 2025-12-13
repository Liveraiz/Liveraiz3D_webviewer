// core/Scene.js
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { Constants } from '../utils/Constants';

export default class Scene extends THREE.Scene {
    /**
     * 씬 클래스 생성자
     * 3D 씬의 기본 설정과 초기화를 담당
     * @param {THREE.WebGLRenderer} renderer - Three.js 렌더러
     * @param {boolean} isDarkMode - 다크모드 여부
     */
    constructor(renderer, isDarkMode = false) {
        super();
        this.isDarkMode = isDarkMode;
        this.renderer = renderer;
        this.updateBackground(isDarkMode);
        this.setupHelpers();
        this.setupLights();
    }

    /**
     * 배경 업데이트
     * 다크모드 상태에 따라 씬의 배경색 변경
     * @param {boolean} isDarkMode - 다크모드 여부
     */
    updateBackground(isDarkMode) {
        const color = isDarkMode ? 
            Constants.COLORS.DARK_BACKGROUND : 
            Constants.COLORS.LIGHT_BACKGROUND;
        
        this.background = new THREE.Color(color);
        
        console.log('Background color:', this.background);
    }

    /**
     * 헬퍼 설정
     * 카메라 헬퍼, 축 헬퍼, 좌표축 라벨, 원점 구체 등을 설정
     */
    setupHelpers() {
        // 카메라 헬퍼 (나중에 업데이트 필요)
        this.cameraHelper = new THREE.CameraHelper(new THREE.PerspectiveCamera());
        this.cameraHelper.name = 'helper';
        this.cameraHelper.visible = false;
        this.add(this.cameraHelper);

        // 축 헬퍼
        this.axesHelper = new THREE.AxesHelper(200);
        this.axesHelper.name = 'helper';
        this.axesHelper.visible = false;
        this.add(this.axesHelper);

        // 좌표축 라벨 생성
        this.createAxisLabels();

        // 원점 구체
        const originSphere = new THREE.Mesh(
            new THREE.SphereGeometry(5, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        originSphere.name = 'helper';
        originSphere.visible = false;
        this.add(originSphere);
    }

    /**
     * 축 라벨 생성
     * X, Y, Z 축과 원점에 대한 라벨 생성 및 설정
     */
    createAxisLabels() {
        const createLabel = (text, position, color) => {
            const div = document.createElement('div');
            div.className = 'axis-label';
            div.textContent = text;
            div.style.color = color;
            div.style.fontSize = '14px';
            div.style.fontWeight = 'bold';
            div.style.fontFamily = 'Arial';
            div.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
            div.style.padding = '2px 6px';
            div.style.borderRadius = '3px';
            div.style.userSelect = 'none';

            const label = new CSS2DObject(div);
            label.position.copy(position);
            label.name = 'helper';
            label.visible = false;
            return label;
        };

        // 축 라벨 생성
        this.labels = {
            origin: createLabel('Origin', new THREE.Vector3(0, -20, 0), '#ffffff'),
            x: createLabel('X', new THREE.Vector3(220, 0, 0), '#ff4444'),
            y: createLabel('Y', new THREE.Vector3(0, 220, 0), '#44ff44'),
            z: createLabel('Z', new THREE.Vector3(0, 0, 220), '#4444ff')
        };

        // 라벨 추가
        Object.values(this.labels).forEach(label => this.add(label));
    }

    /**
     * 조명 설정
     * HDRI 환경 맵을 사용한 조명 설정
     */
    setupLights() {
        console.log('[Scene] Setting up lights...');
        const hdriFileName = 'studio_small_09_1k.hdr';
        console.log(`[Scene] Loading HDRI file: ${hdriFileName}`);

        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        if (!this.renderer) {
            console.error('[Scene] Renderer not available, cannot load HDRI');
            this.setupFallbackLights();
            return;
        }

        console.log('[Scene] Creating RGBELoader and starting load...');
        
        // HDRI 로드 시도
        new RGBELoader()
            .load(`./${hdriFileName}`, 
                (texture) => {
                    console.log(`[Scene] HDRI loaded successfully: ${hdriFileName}`);
                    texture.mapping = THREE.EquirectangularReflectionMapping;
                    
                    // HDRI 회전 적용 (270도)
                    texture.offset.x = 0.75;  // 270도 회전 (0.75 = 3/4)
                    texture.wrapS = THREE.RepeatWrapping;
                    
                    this.environment = texture;
                    
                    // 균일한 조명 추가 (shading 줄이기)
                    // this.setupUniformLighting(); // HDRI만 사용하기 위해 주석 처리
                    
                    // 메모리 관리
                    pmremGenerator.dispose();
                    console.log('[Scene] Environment map applied and resources cleaned up');
                },
                undefined,
                (error) => {
                    console.error('[Scene] Error loading HDRI:', error);
                    console.log('[Scene] Switching to fallback lighting');
                    this.setupFallbackLights();
                }
            );
    }

    /**
     * HDRI 환경 맵 회전
     * @param {THREE.Texture} texture - HDRI 텍스처
     * @param {number} rotationY - Y축 회전 (라디안)
     */
    rotateEnvironment(texture, rotationY = 0) {
        if (!texture || !texture.matrix) {
            console.warn('[Scene] Texture or matrix not available for rotation');
            return;
        }

        // 회전 행렬 생성
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(rotationY);
        
        // 텍스처의 변환 행렬에 회전 적용
        texture.matrix = rotationMatrix;
        texture.matrixAutoUpdate = false;
        
        console.log(`[Scene] HDRI rotated by ${THREE.MathUtils.radToDeg(rotationY)} degrees`);
    }

    /**
     * HDRI 환경 맵 회전 (도 단위)
     * @param {number} degrees - 회전할 각도 (도)
     */
    rotateEnvironmentByDegrees(degrees) {
        const radians = THREE.MathUtils.degToRad(degrees);
        this.rotateEnvironment(this.environment, radians);
    }

    /**
     * 환경 맵 미리 로딩
     * @returns {Promise} 환경 맵 로딩이 완료되면 해결되는 Promise
     */
    preloadEnvironmentMap() {
        return new Promise((resolve, reject) => {
            console.log('[Scene] Starting environment map preloading...');
            
            const hdriFileName = 'christmas_photo_studio_01_1k.hdr';
            const envMapPath = `./${hdriFileName}`;
            console.log(`[Scene] Environment map path: ${envMapPath}`);
            
            if (!this.renderer) {
                console.error('[Scene] Renderer not available, cannot load environment map');
                this.setupFallbackLights();
                resolve(false);
                return;
            }
            
            // HDR 로더 생성
            const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
            pmremGenerator.compileEquirectangularShader();
            
            console.log('[Scene] Starting HDRI loading...');
            
            new RGBELoader()
                .load(envMapPath, 
                    // 성공 콜백
                    (texture) => {
                        console.log('[Scene] HDRI loaded successfully!');
                        texture.mapping = THREE.EquirectangularReflectionMapping;
                        
                        // 조명용으로만 사용, 배경은 변경하지 않음
                        this.environment = texture;
                        
                        // 메모리 관리
                        pmremGenerator.dispose();
                        
                        console.log('[Scene] Environment map setup complete');
                        resolve(true);
                    },
                    undefined,
                    // 오류 콜백
                    (error) => {
                        console.error('[Scene] Error loading HDRI:', error);
                        console.log('[Scene] Switching to fallback lighting');
                        this.setupFallbackLights();
                        resolve(false);
                    }
                );
        });
    }

    /**
     * 대체 조명 설정
     * HDRI 로드 실패 시 기본 조명 설정
     */
    setupFallbackLights() {
        console.log('[Scene] 대체 조명 설정 시작...');
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 5, 5);
        this.add(ambientLight, directionalLight);
        console.log('[Scene] 대체 조명 설정 완료');
    }

    /**
     * 차분한 조명 설정 (자연스러운 라이팅)
     * 이미지처럼 부드럽고 차분한 조명 효과
     */
    setupUniformLighting() {
        console.log('[Scene] 차분한 조명 설정 시작...');
        
        // 기존 조명 제거 (있다면)
        this.children.forEach(child => {
            if (child.isLight) {
                this.remove(child);
            }
        });
        
        // 1. Ambient Light (전체적인 부드러운 조명 - 매우 약하게)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
        this.add(ambientLight);
        console.log('[Scene] Ambient light added with intensity 0.15');
        
        // 2. Key Light (주 조명 - 매우 약하게, 자연스러운 방향)
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.08);
        keyLight.position.set(5, 8, 3);
        keyLight.castShadow = false;
        this.add(keyLight);
        console.log('[Scene] Key light added with intensity 0.08');
        
        // 3. Fill Light (채우기 조명 - 균일하게, 매우 약하게)
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.05);
        fillLight.position.set(-3, 4, -2);
        fillLight.castShadow = false;
        this.add(fillLight);
        console.log('[Scene] Fill light added with intensity 0.05');
        
        console.log('[Scene] 차분한 조명 설정 완료 - 총 3개 조명 (강도 대폭 감소)');
    }

    /**
     * 카메라 헬퍼 업데이트
     * 새로운 카메라에 대한 헬퍼 업데이트
     * @param {THREE.Camera} camera - 업데이트할 카메라
     */
    // updateCameraHelper(camera) {
    //     if (this.cameraHelper) {
    //         this.remove(this.cameraHelper);
    //         this.cameraHelper = new THREE.CameraHelper(camera);
    //         this.cameraHelper.name = 'helper';
    //         this.cameraHelper.visible = false;
    //         this.add(this.cameraHelper);
    //     }
    // }

    /**
     * 헬퍼 표시 토글
     * 모든 헬퍼 요소의 가시성 설정
     * @param {boolean} visible - 표시 여부
     */
    // toggleHelpers(visible) {
    //     this.traverse((child) => {
    //         if (child.name === 'helper' || 
    //             child instanceof THREE.AxesHelper || 
    //             child instanceof CSS2DObject ||
    //             child.type === 'Line') {
    //             child.visible = visible;
    //         }
    //     });
    // }
}