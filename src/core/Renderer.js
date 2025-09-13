// core/Renderer.js
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer';

// WebViewer 렌더링 Class
export default class Renderer {
    /**
     * 렌더러 클래스 생성자
     * WebGL 렌더러를 초기화하고 기본 설정을 구성
     * @param {string} containerId - 렌더러가 추가될 컨테이너 ID
     * @param {boolean} isMobile - 모바일 기기 여부
     */
    constructor(containerId, isMobile) {
        try {
            this.setupRenderer(containerId, isMobile);
        } catch (error) {
            console.error("렌더러 초기화 중 오류 발생:", error);
            throw error;
        }
    }

    /**
     * 렌더러 설정
     * WebGL 렌더러의 기본 속성과 크기를 설정하고 컨테이너에 추가
     * @param {string} containerId - 렌더러가 추가될 컨테이너 ID
     * @param {boolean} isMobile - 모바일 기기 여부
     */
    setupRenderer(containerId, isMobile) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`컨테이너를 찾을 수 없음: ${containerId}`);
        }

        this.renderer = new THREE.WebGLRenderer({
            antialias: !isMobile,
            alpha: true,
            preserveDrawingBuffer: true
        });

        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        container.appendChild(this.renderer.domElement);

        // CSS2D 렌더러 초기화
        this.initializeCSS2DRenderer();
        container.appendChild(this.labelRenderer.domElement);
    }

    /**
     * CSS2D 렌더러 초기화
     * 라벨 렌더러를 설정하고 기본 스타일을 적용
     */
    initializeCSS2DRenderer() {
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        Object.assign(this.labelRenderer.domElement.style, {
            position: 'absolute',
            top: '0px',
            pointerEvents: 'none'
        });
    }

    setupContainer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);
        this.container.appendChild(this.labelRenderer.domElement);
    }

    updateSize(width, height) {
        this.renderer.setSize(width, height);
        this.labelRenderer.setSize(width, height);
    }

    /**
     * 렌더링 수행
     * @param {THREE.Scene} scene - 렌더링할 씬
     * @param {THREE.Camera} camera - 사용할 카메라
     */
    render(scene, camera) {
        if (this.renderer && scene && camera) {
            this.renderer.render(scene, camera);
            if (this.labelRenderer) {
                this.labelRenderer.render(scene, camera);
            }
        }
    }
}