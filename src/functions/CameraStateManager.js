import * as THREE from "three";

/**
 * 카메라 상태 관리 클래스
 * 카메라의 위치, 회전, 타겟, FOV 등을 저장하고 복원하는 기능 제공
 */
export default class CameraStateManager {
    /**
     * 생성자
     * @param {THREE.Camera} camera - Three.js 카메라 객체
     * @param {THREE.ArcballControls|THREE.OrbitControls} controls - 카메라 컨트롤 객체
     */
    constructor(camera, controls) {
        if (!camera) {
            throw new Error("Camera is required for CameraStateManager");
        }
        if (!controls) {
            throw new Error("Controls is required for CameraStateManager");
        }

        this.camera = camera;
        this.controls = controls;
    }

    /**
     * 현재 카메라 상태를 저장
     * 카메라의 위치, 회전, 타겟, FOV 등을 저장하여 나중에 복원할 수 있도록 함
     * @param {number} timestamp - 저장 시점의 타임스탬프 (선택사항)
     * @returns {Object} 저장된 카메라 상태 객체
     */
    saveCameraState(timestamp = null) {
        const state = {
            timestamp: timestamp || Date.now(),
            position: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            },
            rotation: {
                x: this.camera.rotation.x,
                y: this.camera.rotation.y,
                z: this.camera.rotation.z
            },
            quaternion: {
                x: this.camera.quaternion.x,
                y: this.camera.quaternion.y,
                z: this.camera.quaternion.z,
                w: this.camera.quaternion.w
            },
            target: {
                x: this.controls.target.x,
                y: this.controls.target.y,
                z: this.controls.target.z
            },
            fov: this.camera.fov,
            up: {
                x: this.camera.up.x,
                y: this.camera.up.y,
                z: this.camera.up.z
            }
        };

        console.log('Camera state saved:', state);
        return state;
    }

    /**
     * 저장된 카메라 상태를 복원
     * @param {Object} state - 저장된 카메라 상태 객체
     */
    loadCameraState(state) {
        if (!state) {
            console.warn("No camera state provided to load");
            return;
        }

        // 위치 복원
        if (state.position) {
            this.camera.position.set(
                state.position.x,
                state.position.y,
                state.position.z
            );
        }

        // 회전 복원 (quaternion 우선, 없으면 rotation 사용)
        if (state.quaternion) {
            this.camera.quaternion.set(
                state.quaternion.x,
                state.quaternion.y,
                state.quaternion.z,
                state.quaternion.w
            );
        } else if (state.rotation) {
            this.camera.rotation.set(
                state.rotation.x,
                state.rotation.y,
                state.rotation.z
            );
        }

        // 타겟 복원
        if (state.target && this.controls) {
            this.controls.target.set(
                state.target.x,
                state.target.y,
                state.target.z
            );
        }

        // FOV 복원
        if (state.fov !== undefined) {
            this.camera.fov = state.fov;
            this.camera.updateProjectionMatrix();
        }

        // Up 벡터 복원
        if (state.up) {
            this.camera.up.set(
                state.up.x,
                state.up.y,
                state.up.z
            );
        }

        // 컨트롤 업데이트
        if (this.controls) {
            this.controls.update();
        }

        console.log('Camera state loaded:', state);
    }

    /**
     * 카메라 상태를 JSON 문자열로 직렬화
     * @param {number} timestamp - 저장 시점의 타임스탬프 (선택사항)
     * @returns {string} JSON 문자열
     */
    serializeCameraState(timestamp = null) {
        const state = this.saveCameraState(timestamp);
        return JSON.stringify(state, null, 2);
    }

    /**
     * JSON 문자열에서 카메라 상태를 역직렬화하여 복원
     * @param {string} jsonString - JSON 문자열
     */
    deserializeCameraState(jsonString) {
        try {
            const state = JSON.parse(jsonString);
            this.loadCameraState(state);
        } catch (error) {
            console.error("Failed to parse camera state JSON:", error);
            throw error;
        }
    }

    /**
     * 여러 카메라 상태를 저장하고 관리
     * @param {string} key - 상태를 식별할 키
     * @param {number} timestamp - 저장 시점의 타임스탬프 (선택사항)
     * @returns {Object} 저장된 카메라 상태 객체
     */
    saveNamedState(key, timestamp = null) {
        const state = this.saveCameraState(timestamp);
        state.key = key;
        
        // 로컬 스토리지에 저장 (선택사항)
        try {
            const savedStates = this.getAllSavedStates();
            savedStates[key] = state;
            localStorage.setItem('cameraStates', JSON.stringify(savedStates));
        } catch (error) {
            console.warn("Failed to save to localStorage:", error);
        }
        
        return state;
    }

    /**
     * 저장된 이름 있는 카메라 상태를 불러오기
     * @param {string} key - 상태를 식별할 키
     * @returns {Object|null} 저장된 카메라 상태 객체 또는 null
     */
    loadNamedState(key) {
        try {
            const savedStates = this.getAllSavedStates();
            const state = savedStates[key];
            if (state) {
                this.loadCameraState(state);
                return state;
            }
            return null;
        } catch (error) {
            console.error("Failed to load named state:", error);
            return null;
        }
    }

    /**
     * 로컬 스토리지에서 모든 저장된 상태 가져오기
     * @returns {Object} 모든 저장된 상태 객체
     */
    getAllSavedStates() {
        try {
            const stored = localStorage.getItem('cameraStates');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn("Failed to get saved states from localStorage:", error);
            return {};
        }
    }

    /**
     * 특정 이름의 저장된 상태 삭제
     * @param {string} key - 삭제할 상태의 키
     */
    deleteNamedState(key) {
        try {
            const savedStates = this.getAllSavedStates();
            delete savedStates[key];
            localStorage.setItem('cameraStates', JSON.stringify(savedStates));
        } catch (error) {
            console.warn("Failed to delete named state:", error);
        }
    }

    /**
     * 모든 저장된 상태 삭제
     */
    clearAllSavedStates() {
        try {
            localStorage.removeItem('cameraStates');
        } catch (error) {
            console.warn("Failed to clear saved states:", error);
        }
    }
}

