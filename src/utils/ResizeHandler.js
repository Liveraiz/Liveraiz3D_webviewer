// utils/ResizeHandler.js
export class ResizeHandler {
  /**
   * 리사이즈 핸들러 생성자
   * 카메라, 렌더러, 모바일 여부를 초기화하고 방향 감지 이벤트 설정
   * @param {Object} params - 초기화 매개변수
   * @param {THREE.Camera} params.camera - Three.js 카메라
   * @param {Renderer} params.renderer - Renderer 클래스 인스턴스
   * @param {boolean} params.isMobile - 모바일 기기 여부
   */
  constructor({ camera, renderer, isMobile }) {
      this.camera = camera;
      this.renderer = renderer.renderer; // THREE.WebGLRenderer 인스턴스 참조
      this.labelRenderer = renderer.labelRenderer; // CSS2DRenderer 인스턴스 참조
      this.isMobile = isMobile;
      
      // 모바일인 경우 방향 변경 이벤트 리스너 추가
      if (this.isMobile) {
          this.setupOrientationListener();
      }
  }

  /**
   * 방향 변경 이벤트 리스너 설정
   * 모바일 기기의 가로/세로 전환 감지
   */
  setupOrientationListener() {
      window.addEventListener('orientationchange', () => {
          // 방향 전환 애니메이션이 완료될 때까지 약간의 지연
          setTimeout(() => {
              this.handleResize(window.innerWidth, window.innerHeight);
              this.adjustForOrientation();
          }, 100);
      });
  }

  /**
   * 화면 방향에 따른 조정
   * 가로/세로 모드에 따라 카메라 및 UI 조정
   */
  adjustForOrientation() {
      const isLandscape = window.innerWidth > window.innerHeight;
      
      if (isLandscape) {
          // 가로 모드일 때의 조정
          this.camera.fov = 45; // 더 넓은 시야각
          this.camera.position.z *= 0.8; // 카메라를 더 가깝게
      } else {
          // 세로 모드일 때의 조정
          this.camera.fov = 60; // 더 좁은 시야각
          this.camera.position.z *= 1.2; // 카메라를 더 멀게
      }
      
      this.camera.updateProjectionMatrix();
  }

  /**
   * 리사이즈 처리
   * 화면 크기 변경 시 카메라와 렌더러 크기 조정
   * @param {number} width - 새로운 화면 너비
   * @param {number} height - 새로운 화면 높이
   */
  handleResize(width, height) {
      const aspect = width / height;

      // 모바일이고 가로 모드일 때 특별한 처리
      if (this.isMobile && width > height) {
          // 가로 모드에서의 특별한 조정이 필요한 경우
          this.camera.updateAspect(width, height, true); // 가로 모드 플래그 전달
      } else {
          this.camera.updateAspect(width, height);
      }

      // WebGL 렌더러 크기 업데이트
      if (this.renderer) {
          this.renderer.setSize(width, height);
          this.renderer.setPixelRatio(window.devicePixelRatio);
      }

      // CSS2D 렌더러 크기 업데이트
      if (this.labelRenderer) {
          this.labelRenderer.setSize(width, height);
      }
  }

  /**
   * 리소스 정리
   * 등록된 이벤트 리스너 제거
   */
  dispose() {
      if (this.isMobile) {
          window.removeEventListener('orientationchange', this.handleOrientationChange);
      }
  }
}