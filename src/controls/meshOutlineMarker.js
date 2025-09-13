import * as THREE from "three";

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader";

export default class meshOutlineMarker {
    /**
     * 메시 아웃라인 마커 생성자
     * 3D 객체의 외곽선을 표시하기 위한 클래스 초기화
     * @param {THREE.Camera} camera - Three.js 카메라
     * @param {THREE.Scene} scene - Three.js 씬
     * @param {Array<THREE.Mesh>} meshes - 외곽선을 표시할 메시 배열
     * @param {THREE.WebGLRenderer} renderer - Three.js 렌더러
     */
    constructor(camera, scene, meshes, renderer) {
        this.camera = camera;
        this.scene = scene;
        this.meshes = meshes;
        this.renderer = renderer;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedObjects = [];
        this.isEnabled = true;

        this.setupEffectComposer();
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.selectedObjects = [];
            this.outlinePass.selectedObjects = [];
        }
    }

    /**
     * 이펙트 컴포저 설정
     * 외곽선 효과를 위한 포스트 프로세싱 파이프라인 구성
     * RenderPass, OutlinePass, FXAA, OutputPass 설정
     */
    setupEffectComposer() {
        this.composer = new EffectComposer(this.renderer);

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.outlinePass = new OutlinePass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            this.scene,
            this.camera
        );

        // Outline Pass Configuration
        this.outlinePass.edgeStrength = 3.0;
        this.outlinePass.edgeGlow = 0;
        this.outlinePass.edgeThickness = 2.0;
        this.outlinePass.pulsePeriod = 0;
        this.outlinePass.usePatternTexture = false;
        this.outlinePass.visibleEdgeColor.set("#ffffff");
        this.outlinePass.hiddenEdgeColor.set("#ffff00");

        this.composer.addPass(this.outlinePass);

        // Add FXAA Pass
        this.addFXAAPass();

        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);
    }

    /**
     * FXAA 패스 추가
     * 계단 현상(앨리어싱) 방지를 위한 FXAA 설정
     * 해상도에 따른 유니폼 값 설정 및 리사이즈 이벤트 처리
     */
    addFXAAPass() {
        const fxaaPass = new ShaderPass(FXAAShader);

        // Set the resolution uniforms
        const pixelRatio = this.renderer.getPixelRatio();
        fxaaPass.material.uniforms["resolution"].value.x =
            1 / (window.innerWidth * pixelRatio);
        fxaaPass.material.uniforms["resolution"].value.y =
            1 / (window.innerHeight * pixelRatio);

        // Add the FXAA pass to the composer
        this.composer.addPass(fxaaPass);

        // Update the FXAA pass on resize
        window.addEventListener("resize", () => {
            const pixelRatio = this.renderer.getPixelRatio();
            fxaaPass.material.uniforms["resolution"].value.x =
                1 / (window.innerWidth * pixelRatio);
            fxaaPass.material.uniforms["resolution"].value.y =
                1 / (window.innerHeight * pixelRatio);
        });
    }

    updateMousePosition(x, y) {
        if (!this.isEnabled) return;
        
        this.mouse.x = x;
        this.mouse.y = y;
        this.checkIntersection();
    }

    /**
     * 교차 검사
     * 레이캐스터를 사용하여 포인터와 메시의 교차 여부 확인
     * 교차된 객체에 외곽선 효과 적용
     */
    checkIntersection() {
        if (!this.isEnabled) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.meshes, true);

        if (intersects.length > 0) {
            // 가장 앞쪽의 mesh 선택 (distance가 가장 작은 것)
            const closestIntersect = intersects.reduce((closest, current) => {
                return (closest.distance < current.distance) ? closest : current;
            });
            
            const selectedObject = closestIntersect.object;
            this.selectedObjects = [selectedObject];
            this.outlinePass.selectedObjects = this.selectedObjects;
        } else {
            this.selectedObjects = [];
            this.outlinePass.selectedObjects = [];
        }
    }

    /**
     * 선택 객체 수동 추가
     * 외곽선을 표시할 객체를 수동으로 추가
     * @param {THREE.Object3D} object - 선택할 3D 객체
     */
    addSelectedObject(object) {
        this.selectedObjects.push(object);
        this.outlinePass.selectedObjects = this.selectedObjects;
    }

    /**
     * 렌더링 업데이트
     * 이펙트 컴포저를 사용하여 씬 렌더링
     */
    update() {
        this.composer.render();
    }

    /**
     * 윈도우 크기 변경 처리
     * 뷰포트 크기 변경 시 카메라, 렌더러, 컴포저 크기 조정
     */
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
    }
}
