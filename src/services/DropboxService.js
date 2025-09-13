

export class DropboxService {
    /**
     * DropboxService 클래스 생성자
     * 모델 로더 초기화
     */
    constructor() {
        this.modelLoader = null;
    }

    /**
     * 모델 로더 설정 함수
     * 외부에서 모델 로더 인스턴스를 주입받아 설정
     * @param {ModelLoader} modelLoader - 모델 로딩을 담당할 로더 인스턴스
     */
    setModelLoader(modelLoader) {
        this.modelLoader = modelLoader;
    }

    /**
     * Dropbox 공유 URL을 직접 다운로드 URL로 변환
     * www.dropbox.com을 dl.dropboxusercontent.com으로 변경하고
     * dl 파라미터를 1로 설정하여 직접 다운로드 가능한 URL 생성
     * @param {string} shareUrl - Dropbox 공유 URL
     * @returns {string} 변환된 직접 다운로드 URL
     */
    getDirectDownloadUrl(shareUrl) {
        if (!shareUrl) return null;
        
        return shareUrl
            .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
            .replace('?dl=0', '?dl=1')
            .replace('&dl=0', '&dl=1');
    }

    /**
     * 폴더 내용 가져오기
     * model.json 파일을 다운로드하고 모델 정보를 파싱
     * 각 모델 파일의 URL을 직접 다운로드 URL로 변환
     * @param {string} jsonUrl - model.json 파일의 Dropbox 공유 URL
     * @returns {Promise<Object>} 모델 정보가 담긴 객체
     * @throws {Error} 파일 접근 실패 시 에러
     */
    async getFolderContents(jsonUrl) {
        try {
            // model.json 파일의 공유 링크를 다운로드 링크로 변환
            const directUrl = this.getDirectDownloadUrl(jsonUrl);
            console.log('📄 model.json 요청:', directUrl);

            const response = await fetch(directUrl);
            
            if (!response.ok) {
                console.error('❌ model.json 로드 실패:', response.status);
                throw new Error(`model.json 파일 접근 실패 (${response.status})`);
            }

            const data = await response.json();
            console.log('✅ model.json 로드 완료');

            // 각 모델 파일의 URL도 같은 방식으로 변환
            return {
                folderInfo: data.folderInfo || { name: "기본 프로젝트", description: "모델 컬렉션" },
                models: data.models.map(model => ({
                    name: model.name,
                    description: model.description,
                    glbPath: this.getDirectDownloadUrl(model.glbUrl),
                    thumbnailPath: model.thumbnailUrl ? this.getDirectDownloadUrl(model.thumbnailUrl) : null
                }))
            };

        } catch (error) {
            console.error('❌ 모델 정보 로드 실패:', error);
            throw error;
        }
    }

    /**
     * 모델 로드 함수
     * 지정된 URL의 3D 모델을 로드
     * @param {string} modelUrl - 모델 파일의 URL
     * @throws {Error} ModelLoader가 설정되지 않았거나 로드 실패 시 에러
     */
    async loadModel(modelUrl) {
        if (!this.modelLoader) {
            throw new Error('ModelLoader가 설정되지 않았습니다.');
        }

        try {
            this.modelLoader.modelPath = modelUrl;
            await this.modelLoader.loadModel();
        } catch (error) {
            console.error('❌ 모델 로드 실패:', error);
            throw error;
        }
    }

    /**
     * 모델 정보에서 JSON 파일 생성
     * 주어진 모델 정보로 JSON 구조를 만들어 반환
     * @param {Object} projectInfo - 프로젝트 정보 (이름, 설명 등)
     * @param {Array} modelItems - 모델 항목 배열
     * @returns {string} 생성된 JSON 문자열
     */
    generateModelJson(projectInfo, modelItems) {
        try {
            const jsonData = {
                folderInfo: {
                    name: projectInfo.name || "기본 프로젝트",
                    description: projectInfo.description || "3D 모델 컬렉션",
                    lastUpdated: new Date().toISOString().split('T')[0]
                },
                models: modelItems.map(item => ({
                    name: item.name,
                    description: item.description,
                    glbUrl: item.glbUrl,
                    thumbnailUrl: item.thumbnailUrl || null
                }))
            };
            
            return JSON.stringify(jsonData, null, 2);
        } catch (error) {
            console.error('❌ JSON 생성 실패:', error);
            throw new Error(`JSON 생성 실패: ${error.message}`);
        }
    }
}
