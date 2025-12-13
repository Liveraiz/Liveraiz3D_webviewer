export default class LoadingBar {
    constructor(isDarkMode = false) {
        this.isDarkMode = isDarkMode;
        this.container = document.createElement('div');
        this.container.className = 'loading-bar-container';
        Object.assign(this.container.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            backgroundColor: this.isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
            borderRadius: '8px',
            padding: '20px',
            display: 'none',
            zIndex: '1009',
            boxShadow: this.isDarkMode 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                : '0 4px 12px rgba(0, 0, 0, 0.15)'
        });

        // 제목
        this.title = document.createElement('div');
        this.title.textContent = 'Loading Scene...';
        Object.assign(this.title.style, {
            color: this.isDarkMode ? 'white' : 'black',
            marginBottom: '10px',
            textAlign: 'center',
            fontSize: '16px'
        });

        // 프로그레스 바 컨테이너
        this.progressContainer = document.createElement('div');
        Object.assign(this.progressContainer.style, {
            width: '100%',
            height: '20px',
            backgroundColor: this.isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderRadius: '10px',
            overflow: 'hidden'
        });

        // 프로그레스 바
        this.progressBar = document.createElement('div');
        Object.assign(this.progressBar.style, {
            width: '0%',
            height: '100%',
            background: 'linear-gradient(90deg, #3b82f6 0%, #9333ea 100%)',
            transition: 'width 0.3s ease'
        });

        // 퍼센트 텍스트
        this.percentText = document.createElement('div');
        Object.assign(this.percentText.style, {
            color: this.isDarkMode ? 'white' : 'black',
            textAlign: 'center',
            marginTop: '5px',
            fontSize: '14px'
        });

        // 두 번째 진행 상태 표시 (전체 프로세스)
        this.totalProgressText = document.createElement('div');
        Object.assign(this.totalProgressText.style, {
            color: this.isDarkMode ? '#aaaaaa' : '#666666',
            textAlign: 'center',
            marginTop: '5px',
            fontSize: '12px'
        });
        this.totalProgressText.textContent = 'Loading scene...';

        // 컴포넌트 조립
        this.progressContainer.appendChild(this.progressBar);
        this.container.appendChild(this.title);
        this.container.appendChild(this.progressContainer);
        this.container.appendChild(this.percentText);
        this.container.appendChild(this.totalProgressText);
        document.body.appendChild(this.container);

        // 실제 진행 상황 추적 (내부 사용)
        this.modelProgress = 0; // 모델 로딩 진행률
        this.shaderProgress = 0; // 셰이더 컴파일 진행률
        this.hdriProgress = 0;   // HDRI 로딩 진행률
        
        // 각 단계별 가중치
        this.weights = {
            model: 0.6,    // 모델 로딩: 60%
            shader: 0.2,   // 셰이더 컴파일: 20%
            hdri: 0.2      // HDRI 로딩: 20%
        };
    }

    show() {
        this.container.style.display = 'block';
    }

    hide() {
        this.container.style.display = 'none';
        this.setProgress(0);
    }

    setProgress(percent) {
        // 진행률을 0-100 사이로 제한
        const clampedPercent = Math.min(Math.max(0, percent), 100);
        this.progressBar.style.width = `${clampedPercent}%`;
        this.percentText.textContent = `${Math.round(clampedPercent)}%`;
    }

    setTitle(text) {
        this.title.textContent = text;
    }

    updateTheme(isDarkMode) {
        this.isDarkMode = isDarkMode;
        this.container.style.backgroundColor = this.isDarkMode 
            ? 'rgba(0, 0, 0, 0.8)' 
            : 'rgba(255, 255, 255, 0.9)';
        this.container.style.boxShadow = this.isDarkMode 
            ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
            : '0 4px 12px rgba(0, 0, 0, 0.15)';
        this.title.style.color = this.isDarkMode ? 'white' : 'black';
        this.percentText.style.color = this.isDarkMode ? 'white' : 'black';
        this.totalProgressText.style.color = this.isDarkMode ? '#aaaaaa' : '#666666';
        this.progressContainer.style.backgroundColor = this.isDarkMode 
            ? 'rgba(255, 255, 255, 0.1)' 
            : 'rgba(0, 0, 0, 0.1)';
    }

    dispose() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }

    // 새 메서드: 모델 로딩 진행률 업데이트
    setModelProgress(percent) {
        this.modelProgress = Math.min(Math.max(0, percent), 100);
        this._updateTotalProgress();
    }

    // 새 메서드: 셰이더 컴파일 진행률 업데이트
    setShaderProgress(percent) {
        this.shaderProgress = Math.min(Math.max(0, percent), 100);
        this._updateTotalProgress();
    }

    // 새 메서드: HDRI 로딩 진행률 업데이트
    setHDRIProgress(percent) {
        this.hdriProgress = Math.min(Math.max(0, percent), 100);
        this._updateTotalProgress();
    }

    // 내부 메서드: 전체 진행률 계산 및 업데이트
    _updateTotalProgress() {
        // 가중치를 적용한 전체 진행률 계산
        const totalPercent = 
            this.modelProgress * this.weights.model + 
            this.shaderProgress * this.weights.shader + 
            this.hdriProgress * this.weights.hdri;
            
        // 프로그레스 바 업데이트
        this.setProgress(totalPercent);
        
        // 상태 메시지 업데이트 - 퍼센트 숫자 없이 텍스트만 표시
        if (this.modelProgress < 100) {
            this.totalProgressText.textContent = 'Loading model...';
        } else if (this.shaderProgress < 100) {
            this.totalProgressText.textContent = 'Compiling shaders...';
        } else if (this.hdriProgress < 100) {
            this.totalProgressText.textContent = 'Loading environment map...';
        } else {
            this.totalProgressText.textContent = 'Complete';
        }
    }
} 