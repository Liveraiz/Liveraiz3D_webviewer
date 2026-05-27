/**
 * LocalFileManager.js
 * 로컬 폴더 내의 파일들을 자동으로 그룹핑하고 관리
 * jpg, glb, csv 파일을 같은 파일명으로 묶음
 */

import { Constants } from './Constants.js';

export class LocalFileManager {
    constructor() {
        this.fileGroups = new Map(); // 파일명 -> {jpg, glb, csv}
        this.allFiles = [];
    }

    /**
     * 파일명에서 확장자를 제외한 파일명 추출
     * @param {string} filename - 파일명
     * @returns {string} 확장자 제외한 파일명
     */
    getBaseName(filename) {
        return filename.substring(0, filename.lastIndexOf('.')) || filename;
    }

    /**
     * 파일명에서 확장자 추출
     * @param {string} filename - 파일명
     * @returns {string} 확장자 (소문자)
     */
    getExtension(filename) {
        const match = filename.match(/\.([^.]+)$/);
        return match ? match[1].toLowerCase() : '';
    }

    /**
     * 파일명을 정규화 (공백 제거, 특수문자 정렬)
     * @param {string} filename - 파일명
     * @returns {string} 정규화된 파일명
     */
    normalizeFileName(filename) {
        return filename
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^\w._-]/g, '');
    }

    /**
     * 폴더 내 모든 파일을 읽고 그룹핑
     * @param {FileList} fileList - input[type="file"][webkitdirectory]에서 받은 파일 리스트
     * @returns {Array} 그룹핑된 모델 정보 배열
     */
    groupFilesByName(fileList) {
        this.fileGroups.clear();
        this.allFiles = Array.from(fileList);

        // 허용된 확장자
        const allowedExtensions = ['glb', 'gltf', 'csv', 'jpg', 'jpeg', 'png'];

        // 파일 필터링 및 그룹핑
        for (const file of this.allFiles) {
            const filename = file.name;
            const ext = this.getExtension(filename);

            // 허용된 확장자만 처리
            if (!allowedExtensions.includes(ext)) {
                continue;
            }

            const baseName = this.getBaseName(filename);
            const normalizedName = this.normalizeFileName(baseName);

            // 그룹 생성 또는 기존 그룹 가져오기
            if (!this.fileGroups.has(normalizedName)) {
                this.fileGroups.set(normalizedName, {
                    baseName: baseName,
                    glb: null,
                    gltf: null,
                    csv: null,
                    jpg: null,
                    jpeg: null,
                    png: null,
                    path: file.webkitRelativePath.split('/')[0] // 폴더 경로
                });
            }

            const group = this.fileGroups.get(normalizedName);

            // 파일 타입별로 저장
            if (ext === 'glb' || ext === 'gltf') {
                group[ext] = file;
            } else if (ext === 'csv') {
                group.csv = file;
            } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
                // 이미지는 jpg > jpeg > png 우선순위로 저장
                if (!group.jpg && ext === 'jpg') {
                    group.jpg = file;
                } else if (!group.jpeg && ext === 'jpeg') {
                    group.jpeg = file;
                } else if (!group.png && ext === 'png') {
                    group.png = file;
                }
            }
        }

        // 그룹핑된 데이터를 배열로 변환
        return this.convertGroupsToArray();
    }

    /**
     * 그룹핑된 데이터를 모델 배열로 변환
     * @returns {Array} 모델 정보 배열
     */
    convertGroupsToArray() {
        const models = [];

        for (const [key, group] of this.fileGroups) {
            // GLB 또는 GLTF 파일이 있는 그룹만 모델로 간주
            if (!group.glb && !group.gltf) {
                continue;
            }

            const model = {
                id: key,
                name: group.baseName,
                glbFile: group.glb || group.gltf,
                csvFile: group.csv || null,
                imageFile: group.jpg || group.jpeg || group.png || null,
                folderPath: group.path || null,
                modelPath: null, // Blob URL로 나중에 설정
                csvData: null,
                imageUrl: null,
                isLocal: true,
                timestamp: Date.now()
            };

            models.push(model);
        }

        // 이름순으로 정렬
        models.sort((a, b) => a.name.localeCompare(b.name));

        return models;
    }

    /**
     * 파일을 Blob URL로 변환
     * @param {File} file - 파일 객체
     * @returns {string} Blob URL
     */
    createBlobUrl(file) {
        return URL.createObjectURL(file);
    }

    /**
     * 모든 Blob URL 해제
     */
    revokeBlobUrls() {
        for (const [key, group] of this.fileGroups) {
            // 필요시 URL 정리
        }
    }

    /**
     * 모델 배열에 Blob URL 및 CSV 데이터 추가
     * @param {Array} models - 모델 정보 배열
     * @returns {Promise<Array>} 완전한 모델 데이터 배열
     */
    /**
     * 파일명 기반으로 Surgery Type 감지
     * Constants.TABLE_TYPES에 정의된 매핑을 사용
     * @param {string} fileName - 파일명
     * @returns {string} Surgery Type (HCC, CCC, KT, LDKT, LDLT 등)
     */
    detectSurgeryType(fileName) {
        if (!fileName) return null;
        
        const name = fileName.toUpperCase();
        
        // Constants.TABLE_TYPES에서 정의한 순서대로 탐색
        for (const [typeKey, typeConfig] of Object.entries(Constants.TABLE_TYPES)) {
            for (const keyword of typeConfig.keywords) {
                if (name.includes(keyword)) {
                    return typeKey;
                }
            }
        }
        
        return null;
    }

    async prepareModels(models) {
        const preparedModels = [];

        for (const model of models) {
            try {
                // GLB 파일 Blob URL
                if (model.glbFile) {
                    model.modelPath = this.createBlobUrl(model.glbFile);
                }

                // 이미지 URL
                if (model.imageFile) {
                    model.imageUrl = this.createBlobUrl(model.imageFile);
                }

                // CSV 데이터 읽기
                if (model.csvFile) {
                    model.csvData = await this.readCsvFile(model.csvFile);
                }

                // Surgery Type 감지 및 추가
                model.surgeryType = this.detectSurgeryType(model.name);

                preparedModels.push(model);
            } catch (error) {
                console.error(`모델 준비 중 오류 (${model.name}):`, error);
            }
        }

        return preparedModels;
    }

    /**
     * CSV 파일 읽기
     * @param {File} csvFile - CSV 파일
     * @returns {Promise<string>} CSV 데이터 문자열
     */
    readCsvFile(csvFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('CSV 파일 읽기 실패'));
            reader.readAsText(csvFile);
        });
    }

    /**
     * GLB 파일 읽기 (ArrayBuffer)
     * @param {File} glbFile - GLB 파일
     * @returns {Promise<ArrayBuffer>} GLB 파일 데이터
     */
    readGlbFile(glbFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('GLB 파일 읽기 실패'));
            reader.readAsArrayBuffer(glbFile);
        });
    }

    /**
     * 로컬 모델 필터링 (GLB만 있는 경우도 포함)
     * @param {Array} models - 모든 파일 그룹
     * @returns {Array} 로드 가능한 모델들
     */
    filterLoadableModels(models) {
        return models.filter(model => model.glbFile).sort((a, b) => {
            // CSV가 있는 모델을 우선순위로
            if (model.csvFile && !b.csvFile) return -1;
            if (!model.csvFile && b.csvFile) return 1;
            return a.name.localeCompare(b.name);
        });
    }

    /**
     * 그룹 정보 가져오기
     * @returns {Map} 파일명 -> {glb, csv, jpg} 그룹
     */
    getFileGroups() {
        return this.fileGroups;
    }

    /**
     * 특정 모델의 정보 가져오기
     * @param {string} modelId - 모델 ID
     * @returns {Object} 모델 정보
     */
    getModelInfo(modelId) {
        return this.fileGroups.get(modelId) || null;
    }
}
