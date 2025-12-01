# Liveraiz Web Viewer

고해상도 간 모델을 브라우저에서 조작할 수 있는 Three.js 기반 Web Viewer입니다. Dropbox 모델 라이브러리, 측정·변형 툴, 카메라 상태 자동 기록/공유, 실시간 웹캠 배경 등 시뮬레이션·프리뷰 환경에 필요한 기능을 한데 묶었습니다.

## 목차
- [Liveraiz Web Viewer](#liveraiz-web-viewer)
  - [목차](#목차)
  - [개요](#개요)
  - [주요 기능](#주요-기능)
  - [기술 스택](#기술-스택)
  - [폴더 구조](#폴더-구조)
  - [설치 \& 개발 서버](#설치--개발-서버)
    - [1. 요구 사항](#1-요구-사항)
    - [2. 패키지 설치](#2-패키지-설치)
    - [3. 개발 서버 실행](#3-개발-서버-실행)
  - [환경 변수](#환경-변수)
  - [빌드 \& 배포](#빌드--배포)
    - [Vite 빌드](#vite-빌드)
    - [Netlify](#netlify)
  - [Dropbox 모델 워크플로](#dropbox-모델-워크플로)
  - [카메라 상태 자동화](#카메라-상태-자동화)
  - [서버 \& Netlify Functions](#서버--netlify-functions)
    - [Express 서버 (선택)](#express-서버-선택)
    - [Netlify Functions](#netlify-functions)
  - [문제 해결](#문제-해결)
  - [추가 문서](#추가-문서)

## 개요
`src/core/LiverViewer.js`가 씬, 카메라, 렌더러, UI 패널, 측정/툴팁 등을 묶어 하나의 뷰어 인스턴스를 구성합니다. URL 파라미터로 전달된 Dropbox JSON을 로딩하거나 ModelSelector를 통해 모델을 교체할 수 있으며, 다크/라이트 테마와 모바일 대응 로직이 포함됩니다.

```30:210:src/core/LiverViewer.js
export default class LiverViewer {
    constructor(containerId) {
        try {
            initializeGlobalStyles();
            this.containerId = containerId;
            const deviceDetector = new DeviceDetector();
            this.isMobile = deviceDetector.isMobile();
            this.meshes = new Map();
            this.isDarkMode = true;
            this.viewerState = new ViewerState();
            this.panelManager = new PanelManager(this.isMobile);
            this.textPanel = new TextPanel({ isMobile: this.isMobile, panelManager: this.panelManager, isDarkMode: this.isDarkMode });
            this.objectListPanel = new ObjectListPanel({ liverViewer: this, panelManager: this.panelManager, isDarkMode: this.isDarkMode });
            this.meshTooltip = new MeshTooltip();
            this.initialize();
        } catch (error) {
            ErrorHandler.handle(error, "LiverViewer Constructor");
        }
    }
    // ...
}
```

## 주요 기능
- **Dropbox 모델 라이브러리**: 공유 링크 기반 `model.json`을 해석해 GLB/thumbnail을 직접 다운로드 가능한 URL로 변환, ModelSelector UI와 연동합니다. (`src/services/DropboxService.js`)
- **멀티 패널 UI**: TopBar, Toolbar, TextPanel, ObjectListPanel, Tooltip이 PanelManager를 통해 모바일/데스크톱 레이아웃을 전환합니다.
- **측정·변형 툴**: `MeasurementTool`, `MeshTransform`, `ControlManager`가 길이 측정, 이동/회전/스케일, HDRI 회전 등을 제공합니다.
- **카메라 상태 자동 기록**: `CameraStateRecorder`가 컨트롤 이벤트를 감지해 JSON으로 저장하고 sendBeacon/Dropbox 업로드까지 처리합니다.
- **CameraPlayer**: 브라우저 웹캠을 씬 배경으로 스트리밍하고 장치 전환 UI를 제공합니다.
- **테마 + 모바일 대응**: `Constants`에 정의된 색상/패딩/폰트 값을 기반으로 UI 동기화.
- **Netlify Functions**: Dropbox 업로드 전용 함수와 URL 단축 함수, dynamic OG 라우팅(향후 함수 추가 예정)을 제공합니다.

## 기술 스택
| Layer | Stack |
| --- | --- |
| Rendering | Three.js, custom materials, HDRI assets |
| Build Tool | Vite 6 (ESM, single bundle) |
| UI / Styling | Vanilla JS + CSS, Pretendard |
| Backend (local) | Express 4 + Axios proxy |
| Serverless | Netlify Functions (Axios, node-fetch) |
| External APIs | Dropbox content/sharing API, TinyURL, is.gd |

## 폴더 구조
```
├─src
│  ├─core          # Scene/Renderer/Camera orchestrators
│  ├─controls      # Orbit/Arcball control manager, MeshTransform
│  ├─functions     # Camera state recorder/player, measurement, utilities
│  ├─services      # DropboxService
│  ├─ui            # TopBar, Toolbar, panels, selector, tooltip, logo
│  └─utils         # Constants, device detection, error handling
├─server           # Express bridge for Dropbox/OG needs
├─functions        # Netlify Functions (dropbox upload, shorten-url)
├─public           # HDRI, models, icons
├─build            # Vite output (git-tracked for reference)
└─CAMERA_STATE_TEST_GUIDE.md
```

## 설치 & 개발 서버
### 1. 요구 사항
- Node.js 18 LTS 이상 (Vite 6 권장 사양)
- npm 9+ 또는 pnpm/yarn (예시는 npm 기준)
- Dropbox API 토큰 (카메라 상태 업로드 및 Dropbox API 호출 시)

### 2. 패키지 설치
```bash
npm install
npm install --prefix functions  # Netlify Functions 의존성 (배포 시)
```

### 3. 개발 서버 실행
1. **뷰어**: `npm run dev`
   - Vite dev server가 3000번 포트에서 실행되며, `/api` 요청은 `vite.config.js`에 정의된 대로 3001번 Express 서버로 프록시됩니다.
2. **로컬 API(선택)**: `npm run server`
   - Dropbox 토큰을 가진 Express 서버(`server/server.js`)가 3001번 포트에서 동작해 모델 JSON/파일/카메라 상태 업로드를 처리합니다.
3. **Camera State 가이드**: 동작 검증 절차는 `CAMERA_STATE_TEST_GUIDE.md`를 참고하세요.

## 환경 변수
| 위치 | 키 | 설명 |
| --- | --- | --- |
| `server/.env` | `dropbox_access_token` 또는 `dropbox.access.token` | Dropbox 사용자 액세스 토큰 (Netlify 제한으로 두 키 모두 지원) |
| `server/.env` | `PORT` (선택) | Express 서버 포트, 기본 3001 |
| Netlify env | `dropbox_access_token` | Functions에서 Dropbox API 호출 시 사용 |

예시:
```bash
# server/.env
dropbox_access_token=sl.BC-XXXXXXXXXXXXXXXXXXXX
PORT=3001
```

## 빌드 & 배포
### Vite 빌드
```bash
npm run build   # build/ 디렉터리에 산출물 생성
npm run preview # 로컬 서빙
```

`vite.config.js`는 싱글 번들, HDRI/GLB 포함, `/api` 프록시, `build/` 출력, `assetsInclude` 확장을 정의합니다.

### Netlify
`netlify.toml`은 빌드/배포 파이프라인과 API 리다이렉트를 아래와 같이 구성합니다.

```1:31:netlify.toml
[build]
  publish = "build"
  functions = "functions"
  command = "npm run build"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/og/*"
  to = "/.netlify/functions/dynamic-og"
  status = 200
  force = true
# ...
```

- `/api/*` → Netlify Functions
- `/*?json=...` → (향후) `dynamic-og` 함수로 라우팅 (함수 구현 시 주의)
- 나머지 라우팅은 SPA 규칙으로 `index.html`을 반환

배포 시 `functions` 디렉터리에 필요한 의존성을 설치하고(위 명령 참고) Netlify 환경 변수에 Dropbox 토큰을 등록합니다.

## Dropbox 모델 워크플로
`src/services/DropboxService.js`가 공유 링크를 직접 다운로드 링크로 변환하고 `model.json` 기반으로 ModelSelector 옵션을 구성합니다.

```3:95:src/services/DropboxService.js
export class DropboxService {
    getDirectDownloadUrl(shareUrl) {
        return shareUrl
            .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
            .replace('?dl=0', '?dl=1')
            .replace('&dl=0', '&dl=1');
    }
    async getFolderContents(jsonUrl) {
        const directUrl = this.getDirectDownloadUrl(jsonUrl);
        const response = await fetch(directUrl);
        const data = await response.json();
        return {
            folderInfo: data.folderInfo || { name: "기본 프로젝트", description: "모델 컬렉션" },
            models: data.models.map(model => ({
                name: model.name,
                description: model.description,
                glbPath: this.getDirectDownloadUrl(model.glbUrl),
                thumbnailPath: model.thumbnailUrl ? this.getDirectDownloadUrl(model.thumbnailUrl) : null
            }))
        };
    }
}
```

워크플로:
1. Dropbox에서 `model.json`, GLB, 썸네일을 업로드하고 공유 링크를 생성합니다.
2. Viewer 실행 시 URL 파라미터 `?json=https%3A%2F%2Fwww.dropbox.com%2F...%2Fmodel.json%3Fdl%3D0` 형태로 전달하거나, TopBar의 ModelSelector에서 폴더 URL을 입력합니다.
3. ModelSelector가 `model.json`을 파싱해 리스트를 갱신, 선택한 모델을 `ModelLoader`로 전달합니다.

## 카메라 상태 자동화
`src/functions/CameraStateRecorder.js`는 컨트롤 이벤트를 감지해 100ms 간격으로 카메라 상태를 축적하고, 탭 종료·숨김 시 JSON을 다운로드하거나 Dropbox로 업로드합니다.

```1:156:src/functions/CameraStateRecorder.js
export default class CameraStateRecorder {
    constructor(camera, controls, modelLoader = null, modelSelector = null) {
        this.stateManager = new CameraStateManager(camera, controls);
        this.recordInterval = 100;
        this.autoSaveIntervalMs = 5000;
        window.addEventListener('beforeunload', this.onBeforeUnload);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    startRecording() {
        if (this.isRecording) return;
        this.isRecording = true;
        this.recordedStates = [];
        this.recordState();
        this.startAutoSave();
    }
    onBeforeUnload() {
        if (this.isRecording && this.recordedStates.length > 0) {
            this.recordState();
            this.saveToJsonSync();
        }
    }
    // ...
}
```

사용 절차는 `CAMERA_STATE_TEST_GUIDE.md`에 상세히 기술되어 있으며, 브라우저 창을 닫는 순간 JSON이 자동 다운로드되거나 로컬 스토리지에 백업됩니다. Dropbox 업로드 실패 시에도 로컬 저장으로 폴백합니다.

## 서버 & Netlify Functions
### Express 서버 (선택)
`server/server.js`는 Dropbox API와 프런트 사이의 proxy/업로드 브리지입니다.

```1:205:server/server.js
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const DROPBOX_ACCESS_TOKEN = process.env['dropbox_access_token'] || process.env['dropbox.access.token'];
app.post('/api/dropbox/folder-contents', async (req, res) => {
    const { folderId, fileId, rlkey, st } = req.body;
    const modelJsonUrl = `https://dl.dropboxusercontent.com/scl/fo/${folderId}/${fileId}/model.json?rlkey=${rlkey}&st=${st}&raw=1`;
    const response = await axios.get(modelJsonUrl, { headers: { 'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}` }});
    res.json(response.data);
});
app.post('/api/dropbox/upload-camera-states', async (req, res) => {
    const { folderId, filename, data } = req.body;
    // 공유 폴더 경로 해석 → files/upload 호출
});
app.listen(port, () => console.log(`Server is running on port ${port}`));
```

주요 엔드포인트:
- `POST /api/dropbox/folder-contents`: 공유 폴더의 `model.json`을 프록시
- `GET /api/dropbox/file`: 개별 GLB/리소스 스트리밍
- `POST /api/dropbox/upload-camera-states`: 공유 폴더 경로를 찾아 카메라 상태 JSON 업로드

### Netlify Functions
- `functions/dropbox/upload-camera-states.js`: 브라우저에서 직접 Netlify Function으로 카메라 상태를 업로드할 때 사용 (Express 버전과 동일 로직).
- `functions/shorten-url.js`: TinyURL → is.gd 순으로 URL 단축, 실패 시 원본 URL 반환.

빌드 파이프라인에 포함되지 않으므로 Netlify에서 자동 설치하도록 `npm install --prefix functions`를 실행하거나 패키지 매니저 workspace를 사용할 수 있습니다.

## 문제 해결
- **모델이나 assets가 로드되지 않음**: 공유 링크가 `dl=0`인지 확인 후 `DropboxService`의 변환 규칙에 따라 `dl=1`로 바꾸세요.
- **카메라 상태 JSON이 다운로드되지 않음**: 브라우저 팝업 차단을 해제하고 `CAMERA_STATE_TEST_GUIDE.md`의 로컬 스토리지 복구 스크립트를 사용하세요.
- **Dropbox 업로드 실패**: 토큰 권한(files.content.write)과 서버/Netlify 함수 로그를 확인하세요.
- **웹캠이 배경에 표시되지 않음**: HTTPS에서 테스트하고 브라우저 권한을 부여한 뒤 CameraPlayer의 장치 전환 버튼으로 다른 장치를 시도하세요.

## 추가 문서
- `CAMERA_STATE_TEST_GUIDE.md`: 카메라 상태 자동 저장/업로드 테스트 플레이북
- `netlify.toml`: 배포 라우팅/헤더 정책
- `public/README(없음)`: 에셋은 `public/` 혹은 Dropbox에서 직접 로드됩니다.

필요 시 추가 가이드(예: dynamic OG 함수, 모델 JSON 스키마)를 요청해 주세요. README에 포함되지 않은 사용 시나리오가 있다면 제안도 환영합니다.