// utils/DeviceDetector.js
export class DeviceDetector {
  /**
   * 디바이스 감지 클래스 생성자
   * 사용자 에이전트 문자열을 초기화하여 디바이스 타입 감지에 사용
   */
  constructor() {
      this.userAgent = navigator.userAgent || navigator.vendor || window.opera;
  }

  /**
   * 모바일 기기 감지
   * 최신 모바일 기기 및 폴더블 디바이스 포함
   * @returns {boolean} 모바일 기기 여부
   */
  isMobile() {
      // 기존 모바일 기기
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Samsung|LG|Huawei|Xiaomi|Oppo|Vivo|OnePlus|Nothing|Pixel/i;
      
      // 폴더블/플립 디바이스 감지
      const foldableRegex = /Galaxy Z|Galaxy Fold|Galaxy Flip|Mate X|Mix Fold|Find N|Razr/i;
      
      // 화면 크기 기반 감지 (viewport width가 768px 미만)
      const isMobileViewport = window.innerWidth < 768;
      
      return mobileRegex.test(this.userAgent) || 
             foldableRegex.test(this.userAgent) || 
             isMobileViewport;
  }

  /**
   * 태블릿 기기 감지
   * 최신 태블릿 및 폴더블 태블릿 포함
   * @returns {boolean} 태블릿 기기 여부
   */
  isTablet() {
      // 기존 태블릿 기기
      const tabletRegex = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i;
      
      // 최신 태블릿 모델
      const modernTabletRegex = /iPad Pro|Galaxy Tab|MatePad|Mi Pad|Surface|iPad Air|iPad mini|Galaxy Z Fold/i;
      
      // 화면 크기 기반 감지 (768px 이상 1024px 미만)
      const isTabletViewport = window.innerWidth >= 768 && window.innerWidth < 1024;
      
      return tabletRegex.test(this.userAgent) || 
             modernTabletRegex.test(this.userAgent) || 
             isTabletViewport;
  }

  /**
   * 데스크톱 기기 감지
   * 모바일이나 태블릿이 아닌 데스크톱 기기인지 확인
   * @returns {boolean} 데스크톱 기기 여부
   */
  isDesktop() {
      return !this.isMobile() && !this.isTablet();
  }
}