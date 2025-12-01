import * as THREE from "three";

export default class CameraPlayer {
    constructor(scene, camera, renderer, isMobile = false) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.isMobile = isMobile;

        // Camera stream-related properties
        this.videoElement = null;
        this.videoTexture = null;
        this.stream = null;
        this.active = false; // This property will be observed by TopBar
        
        // 원래 배경 저장용
        this.originalBackground = null;
        
        // 여러 카메라 장치를 위한 속성
        this.availableDevices = [];
        this.currentDeviceIndex = -1; // -1로 시작하여 첫 토글 시 0으로 설정
        
        // UI 요소
        this.cameraSelectButton = null;
        
        // 디바이스 크기 관련
        this.containerWidth = window.innerWidth;
        this.containerHeight = window.innerHeight;
        
        // 이벤트 리스너 바인딩
        this._handleResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._handleResize);
    }

    // 사용 가능한 비디오 장치 목록 가져오기
    async _getVideoDevices() {
        try {
            // 먼저 권한 요청
            await navigator.mediaDevices.getUserMedia({ video: true });
            console.log("카메라 권한 확인됨");
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log(`사용 가능한 비디오 장치 ${videoDevices.length}개 발견`);
            return videoDevices;
        } catch (error) {
            console.error("장치 열거 중 오류 발생:", error);
            
            // 권한 없이도 장치 목록 시도
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                return devices.filter(device => device.kind === 'videoinput');
            } catch (enumError) {
                console.error("장치 열거 실패:", enumError);
                return [];
            }
        }
    }
    
    // 카메라 장치 전환 UI 생성
    _createCameraSwitchUI() {
        // 기존 UI가 있으면 제거
        if (this.cameraSelectButton) {
            document.body.removeChild(this.cameraSelectButton);
        }
        
        // 장치가 2개 이상일 때만 전환 버튼 표시
        if (this.availableDevices.length > 1) {
            const button = document.createElement('button');
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
            button.style.cssText = `
                position: absolute;
                bottom: 20px;
                left: 20px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background-color: rgba(0, 0, 0, 0.5);
                color: white;
                border: none;
                cursor: pointer;
                z-index: 1001;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s;
            `;
            
            button.addEventListener('mouseover', () => {
                button.style.transform = 'scale(1.1)';
            });
            
            button.addEventListener('mouseout', () => {
                button.style.transform = 'scale(1)';
            });
            
            button.addEventListener('click', () => {
                this._switchCamera();
            });
            
            document.body.appendChild(button);
            this.cameraSelectButton = button;
        }
    }
    
    // 카메라 전환
    async _switchCamera() {
        if (this.availableDevices.length <= 1) return;
        
        // 카메라 인덱스 업데이트
        this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.availableDevices.length;
        
        // 현재 카메라 중지
        this.stopCamera();
        
        // 새 카메라로 초기화
        await this._initializeWithDevice(this.availableDevices[this.currentDeviceIndex].deviceId);
    }
    
    // 특정 장치 ID로 카메라 초기화
    async _initializeWithDevice(deviceId) {
        if (this.active) {
            this.stopCamera();
        }
        
        console.log(`장치 ID: ${deviceId}로 웹캠 초기화 시작...`);
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const constraints = {
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                    // 브라우저 호환성을 위해 고급 설정 제거
                }
            };

            try {
                let stream;
                try {
                    // 고해상도로 시도
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    console.log("웹캠 스트림 획득 성공 (고해상도)");
                } catch (highResError) {
                    console.log("고해상도 실패, 기본 설정으로 재시도:", highResError.message);
                    // 기본 설정으로 fallback
                    const fallbackConstraints = {
                        video: {
                            deviceId: deviceId ? { exact: deviceId } : undefined
                        }
                    };
                    stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                    console.log("웹캠 스트림 획득 성공 (기본 설정)");
                }
                this.stream = stream;
                
                // 비디오 요소 생성
                this.videoElement = document.createElement("video");
                this.videoElement.srcObject = stream;
                this.videoElement.autoplay = true;
                this.videoElement.muted = true;
                this.videoElement.playsInline = true;
                
                // 색상 정확도를 위한 비디오 속성 설정
                this.videoElement.setAttribute('crossorigin', 'anonymous');
                this.videoElement.style.filter = 'none'; // CSS 필터 제거
                
                try {
                    await this.videoElement.play();
                    console.log("비디오 재생 시작, 해상도:", 
                        this.videoElement.videoWidth, "x", this.videoElement.videoHeight);
                    
                    // 비디오가 실제로 로드될 때까지 잠시 대기
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // 비디오 텍스처 생성 - 정확한 색상 설정
                    this.videoTexture = new THREE.VideoTexture(this.videoElement);
                    this.videoTexture.minFilter = THREE.LinearFilter;
                    this.videoTexture.magFilter = THREE.LinearFilter;
                    this.videoTexture.generateMipmaps = false;
                    this.videoTexture.format = THREE.RGBAFormat;
                    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
                    this.videoTexture.flipY = true;
                    
                    // 색상 정확도를 위한 추가 설정
                    this.videoTexture.anisotropy = 1;
                    this.videoTexture.wrapS = THREE.ClampToEdgeWrapping;
                    this.videoTexture.wrapT = THREE.ClampToEdgeWrapping;
                    
                    // 비디오 텍스처가 제대로 로드될 때까지 대기
                    this.videoTexture.needsUpdate = true;
                    
                    // 씬 배경으로 비디오 텍스처 설정
                    this._setupVideoBackground();
                    
                    this.active = true;
                    
                    // 카메라 전환 UI 업데이트
                    this._createCameraSwitchUI();
                    
                } catch (error) {
                    console.error("비디오 재생 오류:", error);
                    this.showError("웹캠 영상 재생에 실패했습니다.");
                }
            } catch (error) {
                console.error("getUserMedia 오류:", error);
                
                // 구체적인 오류 메시지 제공
                let errorMessage = "웹캠에 접근할 수 없습니다.";
                
                if (error.name === 'NotAllowedError') {
                    errorMessage = "카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.";
                } else if (error.name === 'NotFoundError') {
                    errorMessage = "카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.";
                } else if (error.name === 'NotReadableError') {
                    errorMessage = "카메라가 다른 애플리케이션에서 사용 중입니다. 다른 앱을 종료해주세요.";
                } else if (error.name === 'OverconstrainedError') {
                    errorMessage = "카메라가 요청된 설정을 지원하지 않습니다. 다른 카메라를 시도해보세요.";
                } else if (error.name === 'SecurityError') {
                    errorMessage = "보안상의 이유로 카메라에 접근할 수 없습니다. HTTPS를 사용해주세요.";
                }
                
                this.showError(errorMessage);
            }
        } else {
            console.error("현재 브라우저는 getUserMedia를 지원하지 않습니다");
            this.showError("브라우저가 웹캠 접근을 지원하지 않습니다");
        }
    }
    
    // 화면 크기 변경 감지 이벤트 핸들러
    _handleResize() {
        this.containerWidth = window.innerWidth;
        this.containerHeight = window.innerHeight;
        
        // 활성화된 카메라가 있으면 리사이징 적용
        if (this.active && this.videoTexture) {
            this.resize();
        }
    }

    // 메인 초기화 함수
    async initialize() {
        // 사용 가능한 비디오 장치 가져오기
        this.availableDevices = await this._getVideoDevices();
        console.log("사용 가능한 비디오 장치:", this.availableDevices.length);
        
        if (this.availableDevices.length === 0) {
            this.showError("사용 가능한 카메라 장치가 없습니다.");
            return;
        }
        
        // 이미 활성화되어 있다면 중지하고 다시 시작
        if (this.active) {
            this.stopCamera();
        }
        
        // 현재 인덱스의 장치로 초기화 (기본값은 0)
        if (this.currentDeviceIndex === undefined || this.currentDeviceIndex < 0 || this.currentDeviceIndex >= this.availableDevices.length) {
            this.currentDeviceIndex = 0;
        }
        
        await this._initializeWithDevice(this.availableDevices[this.currentDeviceIndex].deviceId);
    }
    
    _setupVideoBackground() {
        // 원래 배경 저장
        this.originalBackground = this.scene.background;
        
        // 비디오 텍스처를 배경으로 사용하되, 비율 조정을 위한 설정
        this.videoTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.videoTexture.wrapT = THREE.ClampToEdgeWrapping;
        
        // 비디오 텍스처 설정 - 기본값 유지
        this.videoTexture.flipY = true;
        
        // 씬의 배경을 비디오 텍스처로 설정
        this.scene.background = this.videoTexture;
        
        // 화면 비율에 맞게 조정
        this._adjustBackgroundToFitScreen();
        
        console.log("씬 배경으로 비디오 텍스처 설정 완료 (비율 유지)");
    }
    
    _adjustBackgroundToFitScreen() {
        if (!this.videoElement || !this.videoTexture) return;
        
        // 비디오와 화면 비율 계산
        const videoAspect = this.videoElement.videoWidth / this.videoElement.videoHeight;
        const screenAspect = this.containerWidth / this.containerHeight;
        
        console.log(`비디오 비율: ${videoAspect.toFixed(2)}, 화면 비율: ${screenAspect.toFixed(2)}`);
        
        // 비디오 텍스처 설정
        this.videoTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.videoTexture.wrapT = THREE.ClampToEdgeWrapping;
        
        // 비율 유지를 위한 스케일링과 오프셋 계산
        let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;
        
        if (videoAspect > screenAspect) {
            // 비디오가 더 넓음 - 세로를 기준으로 하고 가로는 크롭
            scaleY = 1;
            scaleX = screenAspect / videoAspect;
            offsetX = (1 - scaleX) / 2;
        } else {
            // 비디오가 더 높음 - 가로를 기준으로 하고 세로는 크롭
            scaleX = 1;
            scaleY = videoAspect / screenAspect;
            offsetY = (1 - scaleY) / 2;
        }
        
        // 텍스처 매핑 설정
        this.videoTexture.repeat.set(scaleX, scaleY);
        this.videoTexture.offset.set(offsetX, offsetY);
        
        // 행렬 업데이트
        this.videoTexture.matrix.setUvTransform(offsetX, offsetY, scaleX, scaleY, 0, 0, 0);
        this.videoTexture.matrixAutoUpdate = false;
        
        // 씬의 배경을 비디오 텍스처로 유지
        this.scene.background = this.videoTexture;
        
        console.log(`비디오 비율 유지 설정: scale(${scaleX.toFixed(2)}, ${scaleY.toFixed(2)}), offset(${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})`);
    }
    
    showError(message) {
        console.error(message);
        alert(message);
        this.stopCamera();
    }

    stopCamera() {
        console.log("웹캠 중지");
        
        // 모든 비디오 트랙 중지
        if (this.stream) {
            this.stream.getTracks().forEach((track) => {
                track.stop();
            });
            this.stream = null;
        }

        // 비디오 요소 정리
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.srcObject = null;
            
            // DOM에서 비디오 요소 제거
            if (this.videoElement.parentNode) {
                this.videoElement.parentNode.removeChild(this.videoElement);
            }
            
            this.videoElement = null;
        }
        
        // 씬 배경 복원
        if (this.scene) {
            this.scene.background = this.originalBackground;
        }
        
        // 비디오 텍스처 정리
        if (this.videoTexture) {
            this.videoTexture.dispose();
            this.videoTexture = null;
        }
        
        // UI 정리
        if (this.cameraSelectButton) {
            document.body.removeChild(this.cameraSelectButton);
            this.cameraSelectButton = null;
        }
        
        this.active = false;
    }

    updateTheme(isDarkMode) {
        // 카메라가 활성화된 상태에서만 작업 수행
        if (this.active && this.videoTexture) {
            // 테마가 변경되어도 비디오 텍스처는 그대로 유지
            // 필요한 경우 텍스처의 특정 속성 업데이트 가능
            
            // 씬의 배경을 비디오 텍스처로 다시 설정
            if (this.scene) {
                this.scene.background = this.videoTexture;
            }
            
            console.log("CameraPlayer: 테마 변경 후 비디오 배경 재설정");
        }
    }

    /**
     * 카메라 활성화 상태를 순환하는 메서드
     * 2개 이상의 카메라가 있는 경우: 끄기 → 카메라1 → 카메라2 → ... → 끄기
     */
    async toggleCamera() {
        console.log("카메라 토글 호출, 현재 상태:", this.active);
        
        // 사용 가능한 카메라 장치를 가져옴 (아직 가져오지 않은 경우)
        if (this.availableDevices.length === 0) {
            this.availableDevices = await this._getVideoDevices();
            console.log("사용 가능한 비디오 장치:", this.availableDevices.length);
        }
        
        if (this.active) {
            // 현재 활성화된 상태이면 다음 카메라로 이동 또는 비활성화
            this.currentDeviceIndex = (this.currentDeviceIndex + 1) % (this.availableDevices.length + 1);
            
            // 인덱스가 devices 배열 범위 내에 있으면 해당 카메라로 전환, 그렇지 않으면 끄기
            if (this.currentDeviceIndex < this.availableDevices.length) {
                console.log(`카메라 ${this.currentDeviceIndex + 1}번으로 전환`);
                this.stopCamera();
                await this._initializeWithDevice(this.availableDevices[this.currentDeviceIndex].deviceId);
            } else {
                console.log("카메라 비활성화");
                this.stopCamera();
                // 다음 토글을 위해 인덱스 초기화
                this.currentDeviceIndex = -1;
            }
        } else {
            // 현재 비활성화 상태이면 첫 번째 카메라 활성화
            this.currentDeviceIndex = 0;
            await this.initialize();
        }
    }
    
    // LiverViewer의 애니메이션 루프에서 호출되어야 함
    update() {
        // 비디오 텍스처 업데이트
        if (this.videoTexture && this.active) {
            this.videoTexture.needsUpdate = true;
        }
    }
    
    // 크기 조정 시 호출
    resize() {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        
        // 크기가 실제로 변경되었을 때만 처리
        if (this.containerWidth !== newWidth || this.containerHeight !== newHeight) {
            this.containerWidth = newWidth;
            this.containerHeight = newHeight;
            
            console.log(`화면 크기 변경 감지: ${this.containerWidth}x${this.containerHeight}`);
            
            // 비디오 텍스처가 있고 활성화된 경우 비율 재조정
            if (this.videoTexture && this.active && this.videoElement) {
                this._adjustBackgroundToFitScreen();
                console.log("비디오 비율 재조정 완료");
            }
        }
    }

    dispose() {
        this.stopCamera();
        window.removeEventListener('resize', this._handleResize);
    }
}