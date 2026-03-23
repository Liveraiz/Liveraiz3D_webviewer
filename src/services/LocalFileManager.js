/**
 * LocalFileManager.js
 * 로컬 파일 처리 및 매칭 관리 클래스
 * GLB 파일과 CSV 파일을 파일명 기반으로 자동 매칭
 */

export class LocalFileManager {
    constructor() {
        this.fileGroups = new Map(); // {fileName: {glb: File, csv: File}}
        this.sortedModels = []; // 정렬된 모델 목록
    }

    /**
     * 파일 목록 처리 및 매핑
     * @param {FileList} files - 선택된 파일 목록
     * @returns {Array} 매칭된 모델 배열 [{name, glbFile, csvFile}, ...]
     */
    processFiles(files) {
        this.fileGroups.clear();
        this.sortedModels = [];

        // 1단계: 파일 분류
        for (let file of files) {
            const baseFileName = this.getBaseFileName(file.name);
            const ext = this.getFileExtension(file.name);

            if (!this.fileGroups.has(baseFileName)) {
                this.fileGroups.set(baseFileName, {});
            }

            const group = this.fileGroups.get(baseFileName);
            
            if (ext.toLowerCase() === 'glb' || ext.toLowerCase() === 'gltf') {
                group.glb = file;
                group.glbName = file.name;
            } else if (ext.toLowerCase() === 'csv') {
                group.csv = file;
                group.csvName = file.name;
            }
        }

        // 2단계: GLB 파일만 있는 모델 필터링 및 정렬
        const models = [];
        for (const [baseFileName, group] of this.fileGroups) {
            if (group.glb) {
                models.push({
                    name: baseFileName,
                    glbFile: group.glb,
                    csvFile: group.csv || null,
                    hasData: !!group.csv
                });
            }
        }

        // 3단계: 모델명으로 알파벳 정렬
        models.sort((a, b) => a.name.localeCompare(b.name));
        
        this.sortedModels = models;
        
        console.log('[LocalFileManager] 처리된 파일:', {
            groupCount: this.fileGroups.size,
            modelCount: models.length,
            models: models.map(m => ({ name: m.name, hasData: m.hasData }))
        });

        return models;
    }

    /**
     * 파일명에서 확장자 제거
     * @param {string} fileName 
     * @returns {string} 기본 파일명
     */
    getBaseFileName(fileName) {
        return fileName.replace(/\.(glb|gltf|csv)$/i, '');
    }

    /**
     * 파일 확장자 추출
     * @param {string} fileName 
     * @returns {string} 확장자
     */
    getFileExtension(fileName) {
        const parts = fileName.split('.');
        return parts.length > 1 ? parts[parts.length - 1] : '';
    }

    /**
     * CSV 파일을 텍스트로 읽기
     * @param {File} csvFile 
     * @returns {Promise<string>} CSV 텍스트 데이터
     */
    readCSVFile(csvFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(csvFile);
        });
    }

    /**
     * 정렬된 모델 목록 반환
     * @returns {Array} 정렬된 모델 배열
     */
    getSortedModels() {
        return this.sortedModels;
    }

    /**
     * 특정 모델의 데이터 가져오기
     * @param {string} modelName 
     * @returns {Object} {glbFile, csvFile, csvData} (없으면 null)
     */
    async getModelData(modelName) {
        const model = this.sortedModels.find(m => m.name === modelName);
        if (!model) return null;

        let csvData = null;
        if (model.csvFile) {
            csvData = await this.readCSVFile(model.csvFile);
        }

        return {
            glbFile: model.glbFile,
            csvFile: model.csvFile,
            csvData: csvData,
            name: model.name,
            hasData: !!csvData
        };
    }

    /**
     * 모든 모델 데이터 반환 (비동기)
     * @returns {Promise<Array>}
     */
    async getAllModelsData() {
        const results = [];
        for (const model of this.sortedModels) {
            const data = await this.getModelData(model.name);
            results.push(data);
        }
        return results;
    }

    /**
     * 초기화
     */
    clear() {
        this.fileGroups.clear();
        this.sortedModels = [];
    }
}
