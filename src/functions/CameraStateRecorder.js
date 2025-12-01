import CameraStateManager from "./CameraStateManager";

/**
 * 카메라 상태 자동 기록 클래스
 * 카메라 이동이 시작되면 자동으로 상태를 기록하고 JSON 파일로 저장
 */
export default class CameraStateRecorder {
    /**
     * 생성자
     * @param {THREE.Camera} camera - Three.js 카메라 객체
     * @param {THREE.ArcballControls|THREE.OrbitControls} controls - 카메라 컨트롤 객체
     * @param {ModelLoader} modelLoader - 모델 로더 (드롭박스 URL 추출용)
     * @param {ModelSelector} modelSelector - 모델 셀렉터 (드롭박스 JSON URL 추출용)
     */
    constructor(camera, controls, modelLoader = null, modelSelector = null) {
        if (!camera) {
            throw new Error("Camera is required for CameraStateRecorder");
        }
        if (!controls) {
            throw new Error("Controls is required for CameraStateRecorder");
        }

        this.camera = camera;
        this.controls = controls;
        this.modelLoader = modelLoader;
        this.modelSelector = modelSelector;
        this.stateManager = new CameraStateManager(camera, controls);

        // 기록 상태
        this.isRecording = false;
        this.recordedStates = [];
        this.lastRecordTime = 0;
        this.recordInterval = 100; // 100ms마다 기록 (10fps)
        this.isControlActive = false;
        
        // 자동 저장 관련
        this.autoSaveInterval = null;
        this.autoSaveIntervalMs = 5000; // 5초마다 자동 저장
        this.lastSaveTime = 0;
        this.isSaving = false;
        
        // 업로드 실패 플래그 (처음 실패하면 이후 시도 안 함)
        this.uploadFailed = false;

        // 드롭박스 폴더 URL
        this.dropboxFolderUrl = null;
        this.modelPath = null;

        // 이벤트 핸들러 바인딩
        this.onControlStart = this.onControlStart.bind(this);
        this.onControlChange = this.onControlChange.bind(this);
        this.onBeforeUnload = this.onBeforeUnload.bind(this);
        this.onPageHide = this.onPageHide.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);

        this.setupEventListeners();
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 컨트롤 시작 이벤트 (마우스 다운, 터치 시작)
        const domElement = this.controls.domElement || this.controls.object?.domElement;
        if (domElement) {
            domElement.addEventListener('mousedown', this.onControlStart);
            domElement.addEventListener('touchstart', this.onControlStart);
        } else {
            // domElement가 없으면 window에서 이벤트 감지
            window.addEventListener('mousedown', this.onControlStart);
            window.addEventListener('touchstart', this.onControlStart);
        }

        // 컨트롤 변경 이벤트
        if (this.controls.addEventListener) {
            this.controls.addEventListener('change', this.onControlChange);
        }

        // 창 닫힘 이벤트들
        window.addEventListener('beforeunload', this.onBeforeUnload);
        window.addEventListener('pagehide', this.onPageHide); // 더 안정적
        
        // 페이지 숨김 이벤트 (탭 전환 등)
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    /**
     * 컨트롤 시작 핸들러
     */
    onControlStart(event) {
        // 마우스 왼쪽 버튼 또는 터치만 기록
        if (event.button === 0 || event.type === 'touchstart') {
            this.isControlActive = true;
            this.startRecording();
        }
    }

    /**
     * 컨트롤 변경 핸들러
     */
    onControlChange() {
        if (this.isControlActive && this.isRecording) {
            const now = Date.now();
            if (now - this.lastRecordTime >= this.recordInterval) {
                this.recordState();
                this.lastRecordTime = now;
            }
        }
    }

    /**
     * 창 닫힘 이벤트 핸들러 (beforeunload)
     * beforeunload는 동기적으로만 처리 가능하므로 sendBeacon 사용
     */
    onBeforeUnload(event) {
        if (this.isRecording && this.recordedStates.length > 0) {
            // 마지막 상태 기록
            this.recordState();
            
            // sendBeacon을 사용하여 비동기 저장 시도
            this.saveToJsonSync();
        }
    }

    /**
     * 페이지 숨김 이벤트 핸들러 (pagehide)
     * beforeunload보다 더 안정적으로 작동
     */
    onPageHide(event) {
        if (this.isRecording && this.recordedStates.length > 0) {
            // 마지막 상태 기록
            this.recordState();
            
            // persisted가 false면 페이지가 완전히 닫히는 것
            if (!event.persisted) {
                // sendBeacon 사용
                this.saveToJsonSync();
            } else {
                // persisted가 true면 페이지가 백/포워드 캐시에 저장되는 것
                // 비동기 저장 가능
                this.saveToJson();
            }
        }
    }

    /**
     * 페이지 가시성 변경 이벤트 핸들러
     * 탭이 숨겨질 때도 저장 시도
     */
    onVisibilityChange() {
        if (document.hidden && this.isRecording && this.recordedStates.length > 0) {
            // 마지막 상태 기록
            this.recordState();
            // 비동기로 저장 (페이지가 완전히 닫히지 않았으므로)
            this.saveToJson();
        }
    }

    /**
     * 기록 시작
     */
    startRecording() {
        if (this.isRecording) return;

        this.isRecording = true;
        this.recordedStates = [];
        this.lastRecordTime = Date.now();
        this.lastSaveTime = Date.now();

        // 초기 상태 기록
        this.recordState();

        // 주기적 자동 저장 시작
        this.startAutoSave();

        console.log('카메라 상태 기록 시작');
    }

    /**
     * 주기적 자동 저장 시작
     */
    startAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        this.autoSaveInterval = setInterval(() => {
            if (this.isRecording && this.recordedStates.length > 0) {
                const now = Date.now();
                // 마지막 저장 후 일정 시간이 지났고, 새로운 상태가 기록되었으면 저장
                if (now - this.lastSaveTime >= this.autoSaveIntervalMs) {
                    this.autoSave();
                }
            }
        }, this.autoSaveIntervalMs);
    }

    /**
     * 주기적 자동 저장 중지
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    /**
     * 자동 저장 (주기적으로 호출)
     * 새로운 상태만 저장 (이미 저장된 상태는 제외)
     */
    async autoSave() {
        // 이전에 업로드가 실패했으면 자동 저장도 중단
        if (this.uploadFailed) {
            return;
        }

        if (this.isSaving) return; // 이미 저장 중이면 스킵
        if (this.recordedStates.length === 0) return; // 저장할 상태가 없으면 스킵
        
        this.isSaving = true;
        try {
            // 현재까지 기록된 상태를 저장 (상태 배열은 유지)
            const success = await this.saveToJson(false);
            if (success) {
                this.lastSaveTime = Date.now();
                console.log(`✅ 자동 저장 완료: ${this.recordedStates.length}개 상태`);
            }
        } catch (error) {
            console.warn('❌ 자동 저장 실패:', error);
            this.uploadFailed = true;
        } finally {
            this.isSaving = false;
        }
    }

    /**
     * 현재 상태 기록
     */
    recordState() {
        if (!this.isRecording) return;

        const state = this.stateManager.saveCameraState(Date.now());
        this.recordedStates.push(state);
    }

    /**
     * 기록 종료 (저장은 하지 않음, 창 닫힘 시 저장)
     */
    stopRecording() {
        if (!this.isRecording) return;
        this.isRecording = false;
        
        // 자동 저장 중지
        this.stopAutoSave();
        
        console.log(`카메라 상태 기록 중지: ${this.recordedStates.length}개 상태 기록됨`);
    }

    /**
     * 드롭박스 폴더 URL 추출
     * @param {string} modelPath - 모델 경로
     * @returns {string|null} 드롭박스 폴더 URL
     */
    extractDropboxFolderUrl(modelPath) {
        if (!modelPath || typeof modelPath !== 'string') {
            console.warn('❌ extractDropboxFolderUrl: modelPath가 유효하지 않습니다', modelPath);
            return null;
        }

        // dropbox.com 또는 dropboxusercontent.com 체크
        if (!modelPath.includes('dropbox.com') && !modelPath.includes('dropboxusercontent.com')) {
            console.warn('❌ extractDropboxFolderUrl: dropbox URL이 아닙니다', modelPath);
            return null;
        }

        try {
            // Dropbox 공유 링크에서 폴더 URL 추출
            // 예: https://www.dropbox.com/scl/fo/xxx/yyy/model.glb?dl=0
            // -> https://www.dropbox.com/scl/fo/xxx/?dl=0
            // 예: https://dl.dropboxusercontent.com/scl/fi/xxx/yyy/model.glb?dl=1
            // -> https://www.dropbox.com/scl/fi/xxx/?dl=0
            // 예: https://www.dropbox.com/scl/fo/xxx/?dl=0 (이미 폴더 URL)
            // -> https://www.dropbox.com/scl/fo/xxx/?dl=0
            
            const url = new URL(modelPath);
            const pathParts = url.pathname.split('/').filter(part => part); // 빈 문자열 제거
            
            console.log('🔍 URL 파싱:', {
                hostname: url.hostname,
                pathname: url.pathname,
                pathParts: pathParts
            });
            
            // scl/fo/folderId/fileId 또는 scl/fi/folderId/fileId 형식에서 folderId까지 추출
            const sclIndex = pathParts.indexOf('scl');
            if (sclIndex !== -1) {
                const sclType = pathParts[sclIndex + 1]; // 'fo' 또는 'fi'
                if (sclType === 'fo' || sclType === 'fi') {
                    const folderId = pathParts[sclIndex + 2];
                    if (folderId) {
                        // 항상 www.dropbox.com 형식으로 변환
                        const baseUrl = `https://www.dropbox.com/scl/${sclType}/${folderId}`;
                        const folderUrl = `${baseUrl}/?dl=0`;
                        console.log('✅ 폴더 URL 추출 성공:', folderUrl);
                        return folderUrl;
                    } else {
                        console.warn('❌ folderId를 찾을 수 없습니다', pathParts);
                    }
                } else {
                    console.warn('❌ scl 다음에 fo 또는 fi가 없습니다', pathParts);
                }
            } else {
                console.warn('❌ scl을 찾을 수 없습니다', pathParts);
            }

            return null;
        } catch (error) {
            console.warn('❌ 드롭박스 URL 추출 실패:', error, modelPath);
            return null;
        }
    }

    /**
     * 모델 로더/셀렉터에서 드롭박스 URL 가져오기
     */
    updateDropboxUrl() {
        console.log('🔍 드롭박스 URL 업데이트 시작', {
            hasModelSelector: !!this.modelSelector,
            hasModelLoader: !!this.modelLoader,
            lastJsonUrl: this.modelSelector?.lastJsonUrl,
            modelPath: this.modelLoader?.modelPath
        });

        // 1. ModelSelector의 lastJsonUrl 우선 사용 (가장 정확한 폴더 URL)
        if (this.modelSelector && this.modelSelector.lastJsonUrl) {
            const jsonUrl = this.modelSelector.lastJsonUrl;
            console.log('📋 ModelSelector.lastJsonUrl 사용:', jsonUrl);
            
            this.dropboxFolderUrl = this.extractDropboxFolderUrl(jsonUrl);
            this.modelPath = jsonUrl;
            
            if (this.dropboxFolderUrl) {
                console.log('✅ 드롭박스 폴더 URL (ModelSelector):', this.dropboxFolderUrl);
                return;
            } else {
                console.warn('⚠️ ModelSelector.lastJsonUrl에서 폴더 URL 추출 실패:', jsonUrl);
            }
        } else {
            console.warn('⚠️ ModelSelector 또는 lastJsonUrl이 없습니다');
        }

        // 2. ModelLoader의 modelPath 사용 (fallback)
        if (this.modelLoader && this.modelLoader.modelPath) {
            this.modelPath = this.modelLoader.modelPath;
            console.log('📋 ModelLoader.modelPath 사용:', this.modelPath);
            
            // modelPath가 변환된 URL(dl.dropboxusercontent.com)인 경우 원본 URL 찾기
            let originalUrl = this.modelPath;
            
            // 변환된 URL에서 원본 공유 링크로 변환 시도
            if (this.modelPath.includes('dl.dropboxusercontent.com')) {
                // dl.dropboxusercontent.com/scl/fo/folderId/fileId 또는
                // dl.dropboxusercontent.com/scl/fi/folderId/fileId 형식에서
                // www.dropbox.com/scl/fo/folderId 또는 www.dropbox.com/scl/fi/folderId 형식으로 변환
                try {
                    const url = new URL(this.modelPath);
                    const pathParts = url.pathname.split('/').filter(part => part);
                    const sclIndex = pathParts.indexOf('scl');
                    if (sclIndex !== -1) {
                        const sclType = pathParts[sclIndex + 1]; // 'fo' 또는 'fi'
                        if (sclType === 'fo' || sclType === 'fi') {
                            const folderId = pathParts[sclIndex + 2];
                            if (folderId) {
                                originalUrl = `https://www.dropbox.com/scl/${sclType}/${folderId}/?dl=0`;
                                console.log('🔄 변환된 URL:', originalUrl);
                            }
                        }
                    }
                } catch (error) {
                    console.warn('❌ URL 변환 실패:', error);
                }
            }
            
            this.dropboxFolderUrl = this.extractDropboxFolderUrl(originalUrl);
            
            if (this.dropboxFolderUrl) {
                console.log('✅ 드롭박스 폴더 URL (ModelLoader):', this.dropboxFolderUrl);
            } else {
                console.warn('⚠️ ModelLoader.modelPath에서 폴더 URL 추출 실패:', originalUrl);
            }
        } else {
            console.warn('⚠️ ModelLoader 또는 modelPath가 없습니다');
        }

        // 최종 확인
        if (!this.dropboxFolderUrl) {
            console.error('❌ 드롭박스 폴더 URL을 찾을 수 없습니다', {
                modelSelector: {
                    exists: !!this.modelSelector,
                    lastJsonUrl: this.modelSelector?.lastJsonUrl
                },
                modelLoader: {
                    exists: !!this.modelLoader,
                    modelPath: this.modelLoader?.modelPath
                }
            });
        }
    }

    /**
     * JSON 파일로 저장 (비동기) - 드롭박스에만 저장
     * @param {boolean} clearStates - 저장 후 상태 배열 비울지 여부 (기본: false)
     */
    async saveToJson(clearStates = false) {
        // 이전에 업로드가 실패했으면 더 이상 시도하지 않음
        if (this.uploadFailed) {
            console.log('⏭️ 이전 업로드 실패로 인해 업로드 시도를 건너뜁니다.');
            return false;
        }

        // 드롭박스 URL 업데이트
        this.updateDropboxUrl();

        // 드롭박스 폴더 URL이 없으면 저장하지 않음
        if (!this.dropboxFolderUrl) {
            console.warn('드롭박스 폴더 URL이 없어 카메라 상태를 저장할 수 없습니다.');
            return false;
        }

        // 저장할 상태가 없으면 스킵
        if (this.recordedStates.length === 0) {
            return false;
        }

        const data = {
            metadata: {
                recordedAt: new Date().toISOString(),
                totalStates: this.recordedStates.length,
                modelPath: this.modelPath || null,
                dropboxFolderUrl: this.dropboxFolderUrl || null,
                recordInterval: this.recordInterval
            },
            states: [...this.recordedStates] // 복사본 사용
        };

        const jsonString = JSON.stringify(data, null, 2);
        
        // 파일명 생성
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `camera_states_${timestamp}.json`;

        console.log(`카메라 상태 JSON 파일 드롭박스 업로드 시작: ${filename} (${this.recordedStates.length}개 상태)`);

        // 드롭박스에 업로드
        const success = await this.uploadToDropbox(jsonString, filename);
        
        // 업로드 실패 시 플래그 설정 (이후 시도 안 함)
        if (!success) {
            this.uploadFailed = true;
            console.warn('❌ 업로드 실패로 인해 이후 업로드 시도를 중단합니다.');
        }
        
        // 저장 성공 시 상태 배열 비우기 (선택사항)
        if (success && clearStates) {
            this.recordedStates = [];
        }
        
        return success;
    }

    /**
     * JSON 파일로 저장 (동기, beforeunload/pagehide용)
     * sendBeacon을 사용하여 페이지가 닫히는 중에도 전송 가능
     */
    saveToJsonSync() {
        // 이전에 업로드가 실패했으면 더 이상 시도하지 않음
        if (this.uploadFailed) {
            console.log('⏭️ 이전 업로드 실패로 인해 업로드 시도를 건너뜁니다.');
            return false;
        }

        // 드롭박스 URL 업데이트 (이미 업데이트되었을 수 있지만 안전을 위해)
        this.updateDropboxUrl();

        // 드롭박스 폴더 URL이 없으면 저장하지 않음
        if (!this.dropboxFolderUrl) {
            console.warn('드롭박스 폴더 URL이 없어 카메라 상태를 저장할 수 없습니다.');
            return false;
        }

        // 저장할 상태가 없으면 스킵
        if (this.recordedStates.length === 0) {
            return false;
        }

        const data = {
            metadata: {
                recordedAt: new Date().toISOString(),
                totalStates: this.recordedStates.length,
                modelPath: this.modelPath || null,
                dropboxFolderUrl: this.dropboxFolderUrl || null,
                recordInterval: this.recordInterval
            },
            states: [...this.recordedStates] // 복사본 사용
        };

        const jsonString = JSON.stringify(data, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `camera_states_${timestamp}.json`;

        // sendBeacon을 사용하여 서버로 전송 (페이지가 닫히는 중에도 작동)
        if (navigator.sendBeacon) {
            const folderInfo = this.parseDropboxFolderUrl(this.dropboxFolderUrl);
            if (folderInfo) {
                try {
                    const blob = new Blob([JSON.stringify({
                        folderId: folderInfo.folderId,
                        filename: filename,
                        data: jsonString
                    })], { type: 'application/json' });
                    
                    const sent = navigator.sendBeacon('/api/dropbox/upload-camera-states', blob);
                    if (sent) {
                        console.log(`✅ 카메라 상태 서버 전송 완료 (sendBeacon): ${filename} (${this.recordedStates.length}개 상태)`);
                        return true;
                    } else {
                        console.warn('❌ 카메라 상태 서버 전송 실패 (sendBeacon)');
                        this.uploadFailed = true;
                        console.warn('❌ 업로드 실패로 인해 이후 업로드 시도를 중단합니다.');
                        return false;
                    }
                } catch (error) {
                    console.error('❌ sendBeacon 오류:', error);
                    return false;
                }
            } else {
                console.warn('❌ 드롭박스 폴더 정보 파싱 실패');
                return false;
            }
        } else {
            console.warn('❌ sendBeacon을 지원하지 않는 브라우저입니다.');
            return false;
        }
    }

    /**
     * 드롭박스에 업로드 (서버 API 사용)
     */
    async uploadToDropbox(jsonString, filename) {
        try {
            // 드롭박스 폴더 URL에서 필요한 정보 추출
            const folderInfo = this.parseDropboxFolderUrl(this.dropboxFolderUrl);
            if (!folderInfo) {
                console.warn('드롭박스 폴더 URL 파싱 실패');
                return;
            }

            // 서버 API 엔드포인트 호출
            const response = await fetch('/api/dropbox/upload-camera-states', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    folderId: folderInfo.folderId,
                    filename: filename,
                    data: jsonString
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ 드롭박스 업로드 성공:', result);
                return true;
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.warn('❌ 드롭박스 업로드 실패:', response.status, errorData);
                return false;
            }
        } catch (error) {
            console.warn('❌ 드롭박스 업로드 중 오류:', error);
            return false;
        }
    }

    /**
     * 드롭박스 폴더 URL 파싱
     * @param {string} folderUrl - 드롭박스 폴더 URL
     * @returns {Object|null} { folderId, rlkey, st } 또는 null
     */
    parseDropboxFolderUrl(folderUrl) {
        if (!folderUrl || (!folderUrl.includes('dropbox.com') && !folderUrl.includes('dropboxusercontent.com'))) {
            console.warn('❌ parseDropboxFolderUrl: dropbox URL이 아닙니다', folderUrl);
            return null;
        }

        try {
            const url = new URL(folderUrl);
            const pathParts = url.pathname.split('/').filter(part => part); // 빈 문자열 제거
            
            console.log('🔍 parseDropboxFolderUrl 파싱:', {
                pathname: url.pathname,
                pathParts: pathParts,
                searchParams: url.searchParams.toString()
            });
            
            // scl/fo/folderId 또는 scl/fi/folderId 형식에서 folderId 추출
            const sclIndex = pathParts.indexOf('scl');
            if (sclIndex !== -1) {
                const sclType = pathParts[sclIndex + 1]; // 'fo' 또는 'fi'
                if (sclType === 'fo' || sclType === 'fi') {
                    const folderId = pathParts[sclIndex + 2];
                    if (folderId) {
                        const rlkey = url.searchParams.get('rlkey');
                        const st = url.searchParams.get('st');
                        
                        console.log('✅ parseDropboxFolderUrl 성공:', { folderId, rlkey, st, sclType });
                        return { folderId, rlkey, st, sclType };
                    } else {
                        console.warn('❌ parseDropboxFolderUrl: folderId를 찾을 수 없습니다', pathParts);
                    }
                } else {
                    console.warn('❌ parseDropboxFolderUrl: scl 다음에 fo 또는 fi가 없습니다', pathParts);
                }
            } else {
                console.warn('❌ parseDropboxFolderUrl: scl을 찾을 수 없습니다', pathParts);
            }

            return null;
        } catch (error) {
            console.warn('❌ 드롭박스 URL 파싱 실패:', error, folderUrl);
            return null;
        }
    }

    /**
     * 모델 로더 설정
     */
    setModelLoader(modelLoader) {
        this.modelLoader = modelLoader;
        this.updateDropboxUrl();
    }

    /**
     * 모델 셀렉터 설정
     */
    setModelSelector(modelSelector) {
        this.modelSelector = modelSelector;
        this.updateDropboxUrl();
    }

    /**
     * 리소스 정리
     */
    dispose() {
        const domElement = this.controls?.domElement || this.controls?.object?.domElement;
        if (domElement) {
            domElement.removeEventListener('mousedown', this.onControlStart);
            domElement.removeEventListener('touchstart', this.onControlStart);
        } else {
            window.removeEventListener('mousedown', this.onControlStart);
            window.removeEventListener('touchstart', this.onControlStart);
        }

        if (this.controls && this.controls.removeEventListener) {
            this.controls.removeEventListener('change', this.onControlChange);
        }
        
        window.removeEventListener('beforeunload', this.onBeforeUnload);
        window.removeEventListener('pagehide', this.onPageHide);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);

        // 자동 저장 중지
        this.stopAutoSave();

        // dispose 시에도 저장
        if (this.isRecording && this.recordedStates.length > 0) {
            this.recordState();
            this.saveToJson(true); // 저장 후 상태 비우기
        }

        this.isRecording = false;
        this.recordedStates = [];
    }
}

