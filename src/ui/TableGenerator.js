// utils/TableGenerator.js

import { COLOR, tableColor } from "../utils/color.js";
import { Constants } from "../utils/Constants";

const KNOWN_HCC_COLUMNS = [
    "Measure",
    "Whole Liver",
    "Rt.lobe",
    "Lt.lobe",
    "RAS",
    "RPS",
    "LLS",
    "LMS",
    "Spigelian",
    "Cancer",
    "Spleen",
];

const SEG_DETAIL_COLORS = [
    "#F7D8C4",
    "#D9EDD8",
    "#D7E8F7",
    "#E8D9F7",
    "#F8D9E3",
    "#E7D8CC",
    "#D8F1F4",
];

export class TableGenerator {
    constructor(isDarkMode = false) {
        this.isDarkMode = isDarkMode;
    }

    setTheme(isDarkMode) {
        this.isDarkMode = isDarkMode;
    }

    // Common style definition
    getCommonStyles() {
        return {
            light: {
                header: "#2c3e50",
                headerText: "#ffffff",
                tableBorder: "#e2e8f0",
                textColor: "#2d3748",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                valueBg: "#ffffff",
            },
            dark: {
                header: Constants.COLORS.PRIMARY_ACCENT,
                headerText: "#e6e6e6",
                tableBorder: "#4a5568",
                textColor: "#000000",
                boxShadow: "0 4px 6px rgba(255,255,255,0.3)",
                valueBg: "#ffffff",
            },
        };
    }

    // 볼륨 포맷팅 함수
    formatVolume(value) {
        if (value === undefined || value === null || value === "")
            return "0cm³";

        if (typeof value === "string" && value.includes("cm")) {
            return value;
        }

        const numValue = parseFloat(value);
        return isNaN(numValue) ? "0cm³" : numValue.toFixed(1) + "cm³";
    }

    // 퍼센트 포맷팅 함수
    formatPercent(value) {
        if (value === undefined || value === null || value === "")
            return "0.00%";

        if (typeof value === "string" && value.includes("%")) {
            return value;
        }

        return value + "%";
    }

    /**
     * 파일명 기반으로 Surgery Type 감지
     * Constants.TABLE_TYPES에 정의된 매핑을 사용
     * LUNG 키워드는 최우선으로 확인 (파일명에 lung이 있으면 case와 상관없이 lung table 적용)
     * @param {string} fileName - 파일명
     * @returns {string} Surgery Type (HCC, CCC, KT, LDKT, LDLT 등)
     */
    detectSurgeryType(fileName, folderPath = "") {
        if (!fileName) {
            console.log('[TableGenerator.detectSurgeryType] No fileName provided');
            return null;
        }

        const name = fileName.toUpperCase();
        const context = `${folderPath || ""}`.toUpperCase();

        console.log(`[TableGenerator.detectSurgeryType] Checking: fileName="${fileName}", name="${name}"`);
        console.log(`[TableGenerator.detectSurgeryType] TABLE_TYPES.LUNG exists:`, !!Constants.TABLE_TYPES['LUNG']);

        // LUNG을 최우선으로 확인 (파일명에 LUNG/R Lung/L Lung이 있으면 항상 LUNG 테이블 적용)
        const lungConfig = Constants.TABLE_TYPES['LUNG'];
        if (lungConfig && lungConfig.keywords) {
            console.log(`[TableGenerator.detectSurgeryType] LUNG keywords:`, lungConfig.keywords);
            for (const keyword of lungConfig.keywords) {
                const keywordUpper = keyword.toUpperCase();
                if (name.includes(keywordUpper)) {
                    console.log(`[TableGenerator] ✓ DETECTED: LUNG (matched keyword: "${keyword}" in "${fileName}")`);
                    return 'LUNG';
                }
            }
        }

        // LDLT folders commonly contain a generic section file name.
        // Prefer LDLT over the default HCC fallback when the folder path says so.
        if (context.includes("LDLT") && name.includes("SECTION")) {
            console.log(`[TableGenerator] ✓ DETECTED: LDLT (folder + SECTION)`);
            return "LDLT";
        }

        // Search in the order defined in Constants.TABLE_TYPES (LUNG 제외)
        // (object iteration order maintained as defined)
        for (const [typeKey, typeConfig] of Object.entries(Constants.TABLE_TYPES)) {
            if (typeKey === 'LUNG') continue; // LUNG은 이미 위에서 확인했으므로 건너뛰기
            
            if (!typeConfig || !typeConfig.keywords) continue;
            
            for (const keyword of typeConfig.keywords) {
                const keywordUpper = keyword.toUpperCase();
                if (name.includes(keywordUpper)) {
                    console.log(`[TableGenerator] ✓ DETECTED: ${typeKey} (matched keyword: "${keyword}" in "${fileName}")`);
                    return typeKey;
                }
            }
        }

        console.log(`[TableGenerator] ✗ NO MATCH: No type detected for "${fileName}"`);
        return null;
    }

    /**
     * 파일명과 CSV 데이터를 기반으로 자동 테이블 생성
     * @param {string} csvData - CSV 데이터
     * @param {string} fileName - 파일명
     * @returns {Object} { html: string, surgeryType: string }
     */
    autoCreateTable(csvData, fileName, folderPath = "") {
        const surgeryType = this.detectSurgeryType(fileName, folderPath);
        let tableHTML = '';

        if (surgeryType && Constants.TABLE_TYPES[surgeryType]) {
            const typeConfig = Constants.TABLE_TYPES[surgeryType];
            const methodName = typeConfig.method;
            
            // Check if method exists and call it
            if (typeof this[methodName] === 'function') {
                tableHTML = this[methodName](csvData, surgeryType);
            } else {
                console.warn(`[TableGenerator] Method not found: ${methodName}`);
                tableHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace;">${csvData}</pre>`;
            }
        } else {
            // Default display
            tableHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace;">${csvData}</pre>`;
        }

        return {
            html: tableHTML,
            surgeryType: surgeryType
        };
    }

    // Spleen Volume 별도 표 생성
    createSpleenVolumeTable(csvData) {
        var rows = csvData.replaceAll('"', "").split("\r\n");
        rows = rows.filter((row) => row.trim() !== "");
        if (rows.length === 0) return "";
        var parsedRows = rows.map((row) => row.split(","));
        var headers = parsedRows[0];
        let spleenIdx = -1;
        for (let i = 0; i < headers.length; i++) {
            if (headers[i].toLowerCase().includes("spleen")) {
                spleenIdx = i;
                break;
            }
        }
        if (spleenIdx === -1) return "";
        // 볼륨값은 두 번째 row에 있다고 가정
        let spleenVolume = parsedRows[1]?.[spleenIdx] || "";
        if (!spleenVolume || spleenVolume === "0") return "";

        // 별도 테이블 스타일 및 표 생성
        const theme = this.isDarkMode ? this.getCommonStyles().dark : this.getCommonStyles().light;
        const style = `
        <style>
            .spleen-table { border-collapse: collapse; width: 100%; max-width: 350px; font-family: Arial, sans-serif; margin: 16px 0 0 0; box-shadow: ${theme.boxShadow}; color: ${theme.textColor}; table-layout: fixed; }
            .spleen-table th, .spleen-table td { border: 1px solid ${theme.tableBorder}; padding: 8px; text-align: center; }
            .spleen-table th { background-color: #8e44ad; color: #fff; font-weight: bold; }
            .spleen-table td { background-color: #fff; color: #222; font-size: 15px; }
        </style>
        `;
        let table = style + "<table class='spleen-table'>";
        table += "<thead><tr><th colspan='2'>Spleen Volume</th></tr></thead>";
        table += "<tbody>";
        table += `<tr><td>Volume</td><td>${this.formatVolume(spleenVolume)}</td></tr>`;
        table += "</tbody></table>";
        return table;
    }

    // Create HCC table (main HCC + Segment Detail + separate Spleen Volume table)
    createHCCTable(csvData, surgeryType = "HCC") {
        console.log("Creating HCC table with data:", csvData);

        const rows = csvData.replaceAll('"', "").split("\r\n");
        const filteredRows = rows.filter((row) => row.trim() !== "");

        if (filteredRows.length === 0) return "<p>데이터가 없습니다.</p>";

        const parsedRows = filteredRows.map((row) => row.split(/\t|,/).map((value) => value.trim()));
        const headers = parsedRows[0];

        const volumeData = {};
        const percentData = {};
        let recipBW = "";

        if (parsedRows.length > 1) {
            for (let i = 0; i < headers.length; i++) {
                volumeData[headers[i]] = parsedRows[1][i] || "0";
            }
        }

        if (parsedRows.length > 2) {
            for (let i = 0; i < headers.length; i++) {
                percentData[headers[i]] = parsedRows[2][i] || "0";
            }
        } else {
            Object.assign(percentData, volumeData);
        }

        for (let i = 1; i < parsedRows.length; i++) {
            const row = parsedRows[i];
            const firstCol = row[0]?.trim() || "";
            const secondCol = row[1]?.trim() || "";

            if (firstCol.toLowerCase().includes("recip") || firstCol.toLowerCase().includes("bw")) {
                if (!secondCol && i + 1 < parsedRows.length) {
                    recipBW = parsedRows[i + 1][1]?.trim() || "";
                } else {
                    recipBW = secondCol || "";
                }
            }
        }

        const extraColumns = headers.filter(
            (header) => !KNOWN_HCC_COLUMNS.includes(header.trim())
        );

        const mainTable = this._generateHCCTableHTML(
            volumeData,
            percentData,
            recipBW,
            surgeryType
        );

        let segDetailTable = "";
        if (extraColumns.length > 0) {
            segDetailTable = this._generateSegDetailTableHTML(
                extraColumns,
                volumeData,
                percentData
            );
        }

        const spleenTable = this.createSpleenVolumeTable(csvData);

        return (
            mainTable +
            (segDetailTable ? `<div style='margin-top:12px;'>${segDetailTable}</div>` : "") +
            (spleenTable ? `<div style='margin-top:12px;'>${spleenTable}</div>` : "")
        );
    }

    _generateSegDetailTableHTML(extraColumns, volumeData, percentData) {
        // 긴 이름 축약 헬퍼 함수
        const abbreviateName = (name) => {
            // "nodules_margin_10" → "margin 10"
            // "nodules_margin_20" → "margin 20"
            if (name.includes('_margin_')) {
                const parts = name.split('_margin_');
                const marginValue = parts[1];
                return `margin ${marginValue}`;
            }
            // 언더스코어를 공백으로 변경
            return name.replace(/_/g, ' ');
        };

        const theme = this.isDarkMode
            ? this.getCommonStyles().dark
            : this.getCommonStyles().light;

        const style = `
        <style>
            .seg-detail-table {
                border-collapse: collapse;
                width: 100%;
                max-width: 600px;
                font-family: Arial, sans-serif;
                margin: 0;
                box-shadow: ${theme.boxShadow};
                color: ${theme.textColor};
                table-layout: fixed;
            }
            .seg-detail-table th,
            .seg-detail-table td {
                border: 1px solid ${theme.tableBorder};
                padding: 8px;
                text-align: center;
                width: 50%;
            }
            .seg-detail-table thead th {
                background-color: #AFC7DD;
                color: #ffffff;
                font-weight: bold;
            }
            .seg-detail-table .seg-name {
                color: ${theme.textColor};
                font-weight: bold;
                vertical-align: middle;
                white-space: normal;
                overflow-wrap: anywhere;
                word-break: break-word;
                line-height: 1.2;
            }
            .seg-detail-table .seg-value {
                background-color: ${theme.valueBg};
                color: ${theme.textColor};
                white-space: normal;
                overflow-wrap: anywhere;
            }
        </style>
        `;

        let table = style + "<table class='seg-detail-table'>";

        table += "<thead><tr>";
        table += "<th colspan='2'>Segment detail</th>";
        table += "</tr></thead>";

        table += "<tbody>";

        const escapeHtml = (value) =>
            String(value)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#39;");

        extraColumns.forEach((column, index) => {
            const columnName = column.trim();
            const displayName = escapeHtml(abbreviateName(columnName));
            const bgColor = SEG_DETAIL_COLORS[index % SEG_DETAIL_COLORS.length];

            table += "<tr>";
            table += `<th rowspan='2' class='seg-name' style='background-color: ${bgColor};'>${displayName}</th>`;
            table += `<td class='seg-value'>${this.formatVolume(volumeData[columnName])}</td>`;
            table += "</tr>";

            table += "<tr>";
            table += `<td class='seg-value'>${this.formatPercent(percentData[columnName])}</td>`;
            table += "</tr>";
        });

        table += "</tbody></table>";

        return table;
    }

    // LDLT RL 테이블 생성
    createLDLTTable(csvData, surgeryType = "LDLT") {
        console.log("Creating LDLT table with data:", csvData);

        var rows = csvData.replaceAll('"', "").split("\r\n");
        rows = rows.filter((row) => row.trim() !== "");

        if (rows.length === 0) return "<p>데이터가 없습니다.</p>";

        var parsedRows = rows.map((row) => row.split(","));
        var headers = parsedRows[0];

        // 첫 번째 컬럼이 LDLT, 두 번째 컬럼이 환자 이름
        var patientName = headers.length > 1 ? headers[1].trim() : "Patient";

        var volumeData = {};
        var percentData = {};
        var grwrData = { LDLT: "0", Patient: "0" };
        var recipBW = "";

        // HCC 방식과 유사하게 파싱
        // 헤더 기반으로 데이터 추출
        if (parsedRows.length > 1) {
            var headerCol0 = headers[0]?.trim() || "";
            var headerCol1 = headers[1]?.trim() || patientName;

            // 각 행을 순회하며 데이터 추출
            for (var i = 1; i < parsedRows.length; i++) {
                var row = parsedRows[i];
                var firstCol = row[0]?.trim() || "";
                var secondCol = row[1]?.trim() || "";

                // Whole Liver 처리
                if (firstCol.toLowerCase().includes("whole liver") || firstCol.toLowerCase() === "whole liver") {
                    volumeData["Whole Liver"] = secondCol || "0";
                }
                // Rt.lobe / Lt.lobe 헤더 행 처리
                else if ((firstCol.toLowerCase() === "rt.lobe" || firstCol === "Rt.lobe") && 
                         (secondCol.toLowerCase() === "lt.lobe" || secondCol === "Lt.lobe")) {
                    // 다음 행이 볼륨값
                    if (i + 1 < parsedRows.length) {
                        var volRow = parsedRows[i + 1];
                        volumeData["Rt.lobe"] = volRow[0]?.trim() || "0";
                        volumeData["Lt.lobe"] = volRow[1]?.trim() || "0";
                    }
                    // 그 다음 행이 퍼센트값
                    if (i + 2 < parsedRows.length) {
                        var percentRow = parsedRows[i + 2];
                        percentData["Rt.lobe"] = percentRow[0]?.trim() || "0";
                        percentData["Lt.lobe"] = percentRow[1]?.trim() || "0";
                    }
                }
                // GRWR 처리
                else if (firstCol.toLowerCase() === "grwr" && secondCol.toLowerCase() === "grwr") {
                    if (i + 1 < parsedRows.length) {
                        var grwrRow = parsedRows[i + 1];
                        grwrData["LDLT"] = grwrRow[0]?.trim() || "0";
                        grwrData["Patient"] = grwrRow[1]?.trim() || "0";
                    }
                }
                // Recip BW 처리 (Recip BW 행에서 두 번째 컬럼이 비어있고, 다음 행의 두 번째 컬럼에 값이 있음)
                else if (firstCol.toLowerCase().includes("recip") || firstCol.toLowerCase().includes("bw")) {
                    // 현재 행의 두 번째 컬럼이 비어있으면 다음 행 확인
                    if (!secondCol && i + 1 < parsedRows.length) {
                        var nextRow = parsedRows[i + 1];
                        recipBW = nextRow[1]?.trim() || "";
                    } else {
                        recipBW = secondCol || "";
                    }
                }
            }

            // HCC 방식으로도 시도: 헤더 기반 직접 매핑
            if (Object.keys(volumeData).length === 0 && parsedRows.length > 1) {
                // 두 번째 행부터 데이터 행으로 간주
                for (var i = 1; i < parsedRows.length; i++) {
                    var row = parsedRows[i];
                    if (row.length >= 2) {
                        var label = row[0]?.trim() || "";
                        var value = row[1]?.trim() || "";
                        
                        if (label.toLowerCase().includes("whole")) {
                            volumeData["Whole Liver"] = value;
                        } else if (label.toLowerCase().includes("rt.lobe")) {
                            volumeData["Rt.lobe"] = value;
                        } else if (label.toLowerCase().includes("lt.lobe")) {
                            volumeData["Lt.lobe"] = value;
                        }
                    }
                }
            }
        }

        // 퍼센트 데이터가 없으면 볼륨 데이터에서 계산
        if ((!percentData["Rt.lobe"] || !percentData["Lt.lobe"]) && volumeData["Whole Liver"]) {
            const wholeLiver = parseFloat(volumeData["Whole Liver"].toString().replace(/[^\d.]/g, "")) || 1;
            const rtLobe = parseFloat(volumeData["Rt.lobe"]?.toString().replace(/[^\d.]/g, "") || "0") || 0;
            const ltLobe = parseFloat(volumeData["Lt.lobe"]?.toString().replace(/[^\d.]/g, "") || "0") || 0;
            if (!percentData["Rt.lobe"]) {
                percentData["Rt.lobe"] = ((rtLobe / wholeLiver) * 100).toFixed(2);
            }
            if (!percentData["Lt.lobe"]) {
                percentData["Lt.lobe"] = ((ltLobe / wholeLiver) * 100).toFixed(2);
            }
        }

        return this._generateLDLTTableHTML(volumeData, percentData, grwrData, recipBW, patientName, surgeryType);
    }

    // HVT 테이블 생성
    createHVTTable(csvData, surgeryType = "LDLT") {
        console.log("Creating HVT table with data:", csvData);

        var rows = csvData.replaceAll('"', "").split("\r\n");
        rows = rows.filter((row) => row.trim() !== "");

        if (rows.length === 0) return "<p>데이터가 없습니다.</p>";

        var parsedRows = rows.map((row) => row.split(","));
        var headers = parsedRows[0];

        // 첫 번째 컬럼이 LDLT, 두 번째 컬럼이 환자 이름
        var patientName = headers.length > 1 ? headers[1].trim() : "Patient";

        var volumeData = {};
        var percentData = {};
        var grwrData = {};
        var recipBW = "";

        const parseNumericValue = (value) => {
            const numericValue = parseFloat(String(value || "").replace(/[^\d.]/g, ""));
            return isNaN(numericValue) ? 0 : numericValue;
        };

        const sumValues = (...values) =>
            values.reduce((total, value) => total + parseNumericValue(value), 0);

        // HVT 항목 목록 (볼륨이 0이어도 색상은 유지하기 위해 정의)
        const hvtItems = [
            "Rt.lobe",
            "RHVt",
            "RSHVt",
            "RIHVt",
            "RIHVpt",
            "RIHVat",
            "MHVt",
            "V5t",
            "V58t",
            "V8t",
        ];

        // 각 행을 순회하며 데이터 추출
        if (parsedRows.length > 1) {
            for (var i = 1; i < parsedRows.length; i++) {
                var row = parsedRows[i];
                var firstCol = row[0]?.trim() || "";
                var secondCol = row[1]?.trim() || "";

                // HVT 항목 확인
                for (var j = 0; j < hvtItems.length; j++) {
                    var item = hvtItems[j];
                    if (firstCol === item || firstCol.toLowerCase() === item.toLowerCase()) {
                        // 볼륨값 추출
                        var volume = secondCol || "0";
                        var numVolume = parseFloat(volume.toString().replace(/[^\d.]/g, "")) || 0;
                        
                        // 볼륨이 0보다 큰 경우에만 저장
                        if (secondCol !== "" && secondCol !== undefined && numVolume > 0) {
                            volumeData[item] = volume;
                            
                            // 다음 행이 퍼센트값인지 확인
                            if (i + 1 < parsedRows.length) {
                                var nextRow = parsedRows[i + 1];
                                var nextFirstCol = nextRow[0]?.trim() || "";
                                var nextSecondCol = nextRow[1]?.trim() || "";
                                
                                // 다음 행의 오른쪽 값은 GRWR로 저장
                                var grwrValue = nextSecondCol;
                                var grwrValueNum = parseFloat(grwrValue.replace(/[^\d.]/g, "")) || 0;

                                if (nextSecondCol && nextSecondCol.toLowerCase() !== "grwr" && grwrValueNum > 0) {
                                    grwrData[item] = grwrValue;
                                } else if (nextFirstCol && nextFirstCol.toLowerCase() !== "grwr" && grwrValueNum === 0) {
                                    var fallbackGrwrNum = parseFloat(nextFirstCol.replace(/[^\d.]/g, "")) || 0;
                                    if (fallbackGrwrNum > 0) {
                                        grwrData[item] = nextFirstCol;
                                    }
                                }

                                if (item === "Rt.lobe" && (nextFirstCol.toUpperCase() === "GRWR" || nextSecondCol.toUpperCase() === "GRWR")) {
                                    i++; // GRWR 마커 행 건너뛰기
                                } else {
                                    // 퍼센트 행인 경우 (숫자 + % 또는 0-100 사이의 숫자)
                                    var nextFirstNum = parseFloat(nextFirstCol.replace(/[^\d.]/g, "")) || 0;
                                    var nextSecondNum = parseFloat(nextSecondCol.replace(/[^\d.]/g, "")) || 0;
                                    
                                    if (nextFirstCol.includes("%") || (nextFirstNum > 0 && nextFirstNum <= 100 && !nextFirstCol.toLowerCase().includes("cm"))) {
                                        percentData[item] = nextFirstCol.replace(/[^\d.]/g, "") || "0";
                                        i++; // 퍼센트 행 건너뛰기
                                    } else if (nextSecondCol.includes("%") || (nextSecondNum > 0 && nextSecondNum <= 100 && !nextSecondCol.toLowerCase().includes("cm"))) {
                                        percentData[item] = nextSecondCol.replace(/[^\d.]/g, "") || "0";
                                        i++; // 퍼센트 행 건너뛰기
                                    }
                                }
                            }
                        }
                        break;
                    }
                }

                // Recip BW 처리
                if (firstCol.toLowerCase().includes("recip") || firstCol.toLowerCase().includes("bw")) {
                    if (!secondCol && i + 1 < parsedRows.length) {
                        var nextRow = parsedRows[i + 1];
                        recipBW = nextRow[1]?.trim() || "";
                    } else {
                        recipBW = secondCol || "";
                    }
                }
            }
        }

        return this._generateHVTTableHTML(volumeData, percentData, grwrData, recipBW, patientName, surgeryType);
    }

    // LEFT 테이블 생성 (Left Lobe 전용)
    createLeftTable(csvData, surgeryType = "LDLT") {
        console.log("Creating LEFT table with data:", csvData);

        // 항목 목록
        const leftItems = ["Lt.lobe", "LHVt", "V4t", "V4at", "V4bt"];

        // CSV 파싱
        var rows = csvData ? csvData.replaceAll('"', "").split(/\r?\n/).filter(row => row.trim() !== "") : [];
        var parsedRows = rows.map(row => row.split(","));
        var headers = parsedRows[0] || [];
        var patientName = headers.length > 1 ? headers[1].trim() : "Patient";

        // 값 추출 (hvt 방식)
        var volumeData = {};
        var percentData = {};
        var recipBW = "";
        
        // 헤더 인덱스 파악
        const segIdx = headers.findIndex(h => h.toLowerCase().includes("segment") || h.trim() === headers[0]);
        const volIdx = headers.findIndex(h => h.toLowerCase().includes("volume"));
        const pctIdx = headers.findIndex(h => h.toLowerCase().includes("percent"));
        const grwrIdx = headers.findIndex(h => h.toLowerCase().includes("grwr"));

        for (let i = 1; i < parsedRows.length; i++) {
            const row = parsedRows[i];
            // Recip BW 별도 처리
            if (row[0]?.toLowerCase().includes("recip")) {
                recipBW = row[1] ? row[1].trim() : "";
                continue;
            }
            // left 항목만 추출
            const segment = row[segIdx]?.trim();
            if (leftItems.includes(segment)) {
                const item = segment;
                volumeData[item] = row[volIdx]?.trim() || "";
                percentData[item] = row[pctIdx]?.trim() || "";
                percentData[item + "_grwr"] = row[grwrIdx]?.trim() || "";
            }
        }

        return this._generateLeftTableHTML(volumeData, percentData, recipBW, patientName, surgeryType);
    }

    // LEFT 테이블 HTML 생성
    _generateLeftTableHTML(volumeData, percentData, recipBW, patientName, surgeryType) {
        const theme = this.isDarkMode
            ? this.getCommonStyles().dark
            : this.getCommonStyles().light;

        const leftColors = {
            "Lt.lobe": "#ffe6b1",
            "LHVt": "#fff2aa",
            "V4t": "#c9ffb3",
            "V4at": "#92cd93",
            "V4bt": "#8eb09a"
        };

        const style = `
        <style>
            .left-table {
                border-collapse: collapse;
                width: 100%;
                max-width: 600px;
                font-family: Arial, sans-serif;
                margin: 20px 0;
                box-shadow: ${theme.boxShadow};
                color: ${theme.textColor};
                table-layout: fixed;
            }
            
            .left-table th, 
            .left-table td {
                border: 1px solid ${theme.tableBorder};
                padding: 8px;
                text-align: center;
                width: 50%;
            }
            
            .left-table th {
                font-weight: bold;
            }
            
            .left-table thead th {
                background-color: ${theme.header};
                color: ${theme.headerText};
            }
            
            .value { background-color: ${theme.valueBg}; }
            .percent-row { background-color: #E5E5E5; }
        </style>
        `;

        let table = style + "<table class='left-table'>";
        
        // 헤더
        table += "<thead><tr>";
        table += "<th>" + surgeryType + "</th>";
        table += "<th>" + patientName + "</th>";
        table += "</tr></thead>";
        
        table += "<tbody>";

        // 각 left 항목
        const leftItems = ["Lt.lobe", "LHVt", "V4t", "V4at", "V4bt"];
        leftItems.forEach((item) => {
            const volume = volumeData[item];
            const percent = percentData[item];
            const grwr = percentData[item + "_grwr"];
            const bgColor = leftColors[item] || "#FFFFFF";
            
            if (volume || percent || grwr) {
                // 항목 이름 행
                table += "<tr>";
                table += `<th style='background-color: ${bgColor};'>${item}</th>`;
                table += `<td class='value'>${this.formatVolume(volume)}</td>`;
                table += "</tr>";
                
                // 퍼센트/GRWR 행
                table += "<tr class='percent-row'>";
                table += `<td class='percent-row'>${percent ? percent + "%" : ""}</td>`;
                table += `<td class='percent-row'>${grwr ? grwr : ""}</td>`;
                table += "</tr>";
            }
        });

        // Recip BW 행 (있는 경우만)
        if (recipBW) {
            table += `<tr><th style='background-color: #D4D4D4;'>Recip BW</th><td class='value'>${recipBW}</td></tr>`;
        }

        table += "</tbody></table>";
        return table;
    }

    // KT 테이블 생성
    createKTTable(csvData, surgeryType = "KT") {
        console.log("Creating KT table with data:", csvData);

        let volumeData = {};
        let patientNameFromCSV = "환자";

        if (csvData && typeof csvData === "string") {
            // CSV를 파싱해서 객체 배열로 변환 (React 컴포넌트처럼)
            const rows = csvData
                .replaceAll('"', "")
                .split("\r\n")
                .filter((row) => row.trim() !== "");

            if (rows.length === 0) return "<p>데이터가 없습니다.</p>";

            // CSV를 객체 배열로 변환
            const headers = rows[0].split(",");
            const parsedCsvData = [];

            for (let i = 1; i < rows.length; i++) {
                const rowData = rows[i].split(",");
                const rowObj = {};
                headers.forEach((header, index) => {
                    rowObj[header.trim()] = rowData[index] || "";
                });
                parsedCsvData.push(rowObj);
            }

            if (parsedCsvData.length > 0) {
                // 첫 번째 행에서 컬럼 이름 가져오기
                const firstRow = parsedCsvData[0];
                const columnNames = Object.keys(firstRow);

                // 첫 번째 컬럼 이름 확인 (KT 또는 LDKT)
                let firstColumnName = "KT";
                if (columnNames.includes("LDKT")) {
                    firstColumnName = "LDKT";
                } else if (columnNames.includes("KT")) {
                    firstColumnName = "KT";
                } else if (columnNames.length > 0) {
                    firstColumnName = columnNames[0];
                }

                // 두 번째 컬럼 이름이 환자 이름
                if (columnNames.length >= 2) {
                    patientNameFromCSV = columnNames[1];
                }

                // CSV 데이터 구조 분석 및 파싱 (React 컴포넌트와 동일)
                for (let i = 0; i < parsedCsvData.length; i += 2) {
                    const segmentRow = parsedCsvData[i];
                    const volumeRow = parsedCsvData[i + 1];

                    if (segmentRow && volumeRow) {
                        // 첫 번째 컬럼(KT 또는 LDKT)과 환자이름 컬럼에서 데이터 추출
                        const leftSegment = segmentRow[firstColumnName];
                        const rightSegment = segmentRow[patientNameFromCSV];
                        const leftVolume = volumeRow[firstColumnName];
                        const rightVolume = volumeRow[patientNameFromCSV];

                        // 볼륨 값에서 숫자만 추출
                        const cleanLeftVolume =
                            leftVolume?.toString().replace(/[^\d.]/g, "") ||
                            "0";
                        const cleanRightVolume =
                            rightVolume?.toString().replace(/[^\d.]/g, "") ||
                            "0";

                        // volumeData 객체에 저장
                        if (leftSegment) {
                            volumeData[leftSegment] = cleanLeftVolume;
                        }
                        if (rightSegment) {
                            volumeData[rightSegment] = cleanRightVolume;
                        }
                    }
                }
            }
        } else {
            // 기본값 설정
            volumeData = {
                "Rt.Cortex": "",
                "Rt.Column": "",
                "Rt.Medulla": "",
                "Rt.Kidney": "",
                "Rt.func.V": "",
                "Lt.Cortex": "",
                "Lt.Column": "",
                "Lt.Medulla": "",
                "Lt.Kidney": "",
                "Lt.func.V": "",
            };
        }

        return this._generateKTTableHTML(
            volumeData,
            patientNameFromCSV,
            surgeryType
        );
    }

    // HCC 테이블 HTML 생성
    _generateHCCTableHTML(volumeData, percentData, recipBW, surgeryType) {
        const theme = this.isDarkMode
            ? this.getCommonStyles().dark
            : this.getCommonStyles().light;

        const colors = {
            wholeLiverBg: this.isDarkMode ? "#e2e3e5" : "#f8f9fa",
            rtlobeBg: "#FFDFC1",
            ltlobeBg: "#FFFFD5",
            rasBg: "#FFC1CC",
            rpsBg: "#E6CCEF",
            llsBg: "#FFE0A3",
            lmsBg: "#FFF9C4",
            spigelianBg: "#C8E6C9",
            cancerBg: "#F8BBD0",
        };

        const style = `
        <style>
            .hcc-table {
                border-collapse: collapse;
                width: 100%;
                max-width: 600px;
                font-family: Arial, sans-serif;
                margin: 20px 0;
                box-shadow: ${theme.boxShadow};
                color: ${theme.textColor};
                table-layout: fixed;
            }
            
            .hcc-table th, 
            .hcc-table td {
                border: 1px solid ${theme.tableBorder};
                padding: 8px;
                text-align: center;
                width: 50%;
            }
            
            .hcc-table th {
                font-weight: bold;
            }
            
            .hcc-table thead th {
                background-color: ${theme.header};
                color: ${theme.headerText};
            }
            
            .whole-liver { background-color: ${colors.wholeLiverBg}; }
            .rt-lobe { background-color: ${colors.rtlobeBg}; }
            .lt-lobe { background-color: ${colors.ltlobeBg}; }
            .ras { background-color: ${colors.rasBg}; }
            .rps { background-color: ${colors.rpsBg}; }
            .lls { background-color: ${colors.llsBg}; }
            .lms { background-color: ${colors.lmsBg}; }
            .spigelian { background-color: ${colors.spigelianBg}; }
            .cancer { background-color: ${colors.cancerBg}; }
            .value { background-color: ${theme.valueBg}; }
            
            .surgery-header {
                background-color: ${theme.header};
                color: ${theme.headerText};
                text-align: center;
                font-weight: bold;
                padding: 10px;
            }
        </style>
        `;

        let table = style + "<table class='hcc-table'>";

        table += "<thead><tr>";
        table +=
            "<th colspan='2' class='surgery-header'>" + surgeryType + "</th>";
        table += "</tr></thead>";

        table += "<tbody>";

        table += "<tr class='whole-liver'>";
        table += "<th>Whole Liver</th>";
        table +=
            "<td>" + this.formatVolume(volumeData["Whole Liver"]) + "</td>";
        table += "</tr>";

        table += "<tr>";
        table += "<th class='rt-lobe'>Rt.lobe</th>";
        table += "<th class='lt-lobe'>Lt.lobe</th>";
        table += "</tr>";

        table += "<tr>";
        table +=
            "<td class='value'>" +
            this.formatVolume(volumeData["Rt.lobe"]) +
            "</td>";
        table +=
            "<td class='value'>" +
            this.formatVolume(volumeData["Lt.lobe"]) +
            "</td>";
        table += "</tr>";

        table += "<tr>";
        table +=
            "<td class='value'>" +
            this.formatPercent(percentData["Rt.lobe"]) +
            "</td>";
        table +=
            "<td class='value'>" +
            this.formatPercent(percentData["Lt.lobe"]) +
            "</td>";
        table += "</tr>";

        table += "<tr>";
        table += "<th class='ras'>RAS</th>";
        table += "<th class='lls'>LLS</th>";
        table += "</tr>";

        table += "<tr>";
        table +=
            "<td class='value'>" +
            this.formatVolume(volumeData["RAS"]) +
            "</td>";
        table +=
            "<td class='value'>" +
            this.formatVolume(volumeData["LLS"]) +
            "</td>";
        table += "</tr>";

        table += "<tr>";
        table +=
            "<td class='value'>" +
            this.formatPercent(percentData["RAS"]) +
            "</td>";
        table +=
            "<td class='value'>" +
            this.formatPercent(percentData["LLS"]) +
            "</td>";
        table += "</tr>";

        table += "<tr>";
        table += "<th class='rps'>RPS</th>";
        table += "<th class='lms'>LMS</th>";
        table += "</tr>";

        table += "<tr>";
        table +=
            "<td class='value'>" +
            this.formatVolume(volumeData["RPS"]) +
            "</td>";
        table +=
            "<td class='value'>" +
            this.formatVolume(volumeData["LMS"]) +
            "</td>";
        table += "</tr>";

        table += "<tr>";
        table +=
            "<td class='value'>" +
            this.formatPercent(percentData["RPS"]) +
            "</td>";
        table +=
            "<td class='value'>" +
            this.formatPercent(percentData["LMS"]) +
            "</td>";
        table += "</tr>";

        table += "<tr>";
        table += "<th class='cancer'>Cancer</th>";
        table += "<th class='spigelian'>Spigelian</th>";
        table += "</tr>";

        table += "<tr>";
        table += "<td class='value'>" + this.formatVolume(volumeData["Cancer"]) + "</td>";
        table += "<td class='value'>" + this.formatVolume(volumeData["Spigelian"]) + "</td>";
        table += "</tr>";

        table += "<tr>";
        table += "<td class='value'>" + this.formatPercent(percentData["Cancer"]) + "</td>";
        table +=
            "<td class='value'>" +
            this.formatPercent(percentData["Spigelian"]) +
            "</td>";
        table += "</tr>";

        table += "</tbody></table>";

        return table;
    }

    // KT 테이블 HTML 생성
    _generateKTTableHTML(volumeData, patientName, surgeryType) {
        const theme = this.isDarkMode
            ? this.getCommonStyles().dark
            : this.getCommonStyles().light;

        const style = `
        <style>
            .kt-table {
                border-collapse: collapse;
                width: 100%;
                max-width: 600px;
                font-family: Arial, sans-serif;
                margin: 20px 0;
                box-shadow: ${theme.boxShadow};
                color: ${theme.textColor};
                table-layout: fixed;
            }
            
            .kt-table th, 
            .kt-table td {
                border: 1px solid ${theme.tableBorder};
                padding: 8px;
                text-align: center;
                width: 50%;
            }
            
            .kt-table th {
                font-weight: bold;
            }
            
            .kt-table thead th {
                background-color: "#FFFFFF";
                color: "#000000";
            }
            
            .patient-info {
                background-color: ${theme.valueBg};
                color: ${theme.textColor};
                padding: 10px;
            }
            
            .value-cell { 
                background-color: ${theme.valueBg}; 
                color: ${theme.textColor};
            }
        </style>
        `;

        let table = style + "<table class='kt-table'>";

        table += "<thead>";
        table += "<tr>";
        table += "<th class='patient-info'>" + surgeryType + "</th>";
        table += "<th class='patient-info'>" + patientName + "</th>";
        table += "</tr>";
        table += "</thead>";

        table += "<tbody>";

        const segments = [
            ["Rt.Cortex", "Lt.Cortex"],
            ["Rt.Column", "Lt.Column"],
            ["Rt.Medulla", "Lt.Medulla"],
            ["Rt.Kidney", "Lt.Kidney"],
            ["Rt.func.V", "Lt.func.V"],
        ];

        segments.forEach(([leftSegment, rightSegment]) => {
            table += "<tr>";
            table +=
                "<th style='background-color: " +
                COLOR.Kidney[leftSegment] +
                ";'>" +
                leftSegment +
                "</th>";
            table +=
                "<th style='background-color: " +
                COLOR.Kidney[rightSegment] +
                ";'>" +
                rightSegment +
                "</th>";
            table += "</tr>";

            table += "<tr>";
            table +=
                "<td class='value-cell'>" +
                this.formatVolume(volumeData[leftSegment] || "0") +
                "</td>";
            table +=
                "<td class='value-cell'>" +
                this.formatVolume(volumeData[rightSegment] || "0") +
                "</td>";
            table += "</tr>";
        });

        table += "</tbody></table>";

        return table;
    }

    // LDLT 테이블 HTML 생성
    _generateLDLTTableHTML(volumeData, percentData, grwrData, recipBW, patientName, surgeryType) {
        const theme = this.isDarkMode
            ? this.getCommonStyles().dark
            : this.getCommonStyles().light;

        const colors = {
            wholeLiverBg: this.isDarkMode ? "#e2e3e5" : "#f8f9fa",
            rtlobeBg: "#FFDFC1",
            ltlobeBg: "#FFFFD5",
            grwrBg: "#BFBFBF",
            recipBWBg: "#B3D9FF",
        };

        const style = `
        <style>
            .ldlt-table {
                border-collapse: collapse;
                width: 100%;
                max-width: 600px;
                font-family: Arial, sans-serif;
                margin: 20px 0;
                box-shadow: ${theme.boxShadow};
                color: ${theme.textColor};
                table-layout: fixed;
            }
            
            .ldlt-table th, 
            .ldlt-table td {
                border: 1px solid ${theme.tableBorder};
                padding: 8px;
                text-align: center;
                width: 50%;
            }
            
            .ldlt-table th {
                font-weight: bold;
            }
            
            .ldlt-table thead th {
                background-color: ${theme.header};
                color: ${theme.headerText};
            }
            
            .whole-liver { background-color: ${colors.wholeLiverBg}; }
            .rt-lobe { background-color: ${colors.rtlobeBg}; }
            .lt-lobe { background-color: ${colors.ltlobeBg}; }
            .grwr { background-color: ${colors.grwrBg}; }
            .recip-bw { background-color: ${colors.recipBWBg}; }
            .value { background-color: ${theme.valueBg}; }
        </style>
        `;

        let table = style + "<table class='ldlt-table'>";

        // 헤더: LDLT | 환자이름
        table += "<thead><tr>";
        table += "<th>" + surgeryType + "</th>";
        table += "<th>" + patientName + "</th>";
        table += "</tr></thead>";

        table += "<tbody>";

        // Whole Liver 행
        table += "<tr class='whole-liver'>";
        table += "<th>whole Liver</th>";
        table += "<td>" + this.formatVolume(volumeData["Whole Liver"]) + "</td>";
        table += "</tr>";

        // Rt.lobe / Lt.lobe 헤더 행
        table += "<tr>";
        table += "<th class='rt-lobe'>Rt.lobe</th>";
        table += "<th class='lt-lobe'>Lt.lobe</th>";
        table += "</tr>";

        // 볼륨 행
        table += "<tr>";
        table += "<td class='value'>" + this.formatVolume(volumeData["Rt.lobe"]) + "</td>";
        table += "<td class='value'>" + this.formatVolume(volumeData["Lt.lobe"]) + "</td>";
        table += "</tr>";

        // 퍼센트 행
        table += "<tr>";
        table += "<td class='value'>" + this.formatPercent(percentData["Rt.lobe"]) + "</td>";
        table += "<td class='value'>" + this.formatPercent(percentData["Lt.lobe"]) + "</td>";
        table += "</tr>";

        // GRWR 행
        table += "<tr>";
        table += "<th class='grwr'>GRWR</th>";
        table += "<th class='grwr'>GRWR</th>";
        table += "</tr>";

        table += "<tr>";
        table += "<td class='value'>" + this.formatPercent(grwrData["LDLT"] || "0") + "</td>";
        table += "<td class='value'>" + this.formatPercent(grwrData["Patient"] || "0") + "</td>";
        table += "</tr>";

        // Recip BW 행
        table += "<tr>";
        table += "<th class='recip-bw'>Recip BW</th>";
        // CSV에 이미 kg가 포함되어 있으면 추가하지 않음
        const recipBWDisplay = recipBW ? (recipBW.toLowerCase().includes("kg") ? recipBW : recipBW + " kg") : "";
        table += "<td class='value'>" + recipBWDisplay + "</td>";
        table += "</tr>";

        table += "</tbody></table>";

        return table;
    }

    // HVT 테이블 HTML 생성
    _generateHVTTableHTML(volumeData, percentData, grwrData, recipBW, patientName, surgeryType) {
        const theme = this.isDarkMode
            ? this.getCommonStyles().dark
            : this.getCommonStyles().light;

        const style = `
        <style>
            .hvt-table {
                border-collapse: collapse;
                width: 100%;
                max-width: 600px;
                font-family: Arial, sans-serif;
                margin: 20px 0;
                box-shadow: ${theme.boxShadow};
                color: ${theme.textColor};
                table-layout: fixed;
            }
            
            .hvt-table th, 
            .hvt-table td {
                border: 1px solid ${theme.tableBorder};
                padding: 8px;
                text-align: center;
                width: 50%;
            }
            
            .hvt-table th {
                font-weight: bold;
            }
            
            .hvt-table thead th {
                background-color: ${theme.header};
                color: ${theme.headerText};
            }
            
            .value { background-color: ${theme.valueBg}; }
            .percent-row { background-color: #E5E5E5; }
        </style>
        `;

        let table = style + "<table class='hvt-table'>";

        // 헤더: LDLT | 환자이름
        table += "<thead><tr>";
        table += "<th>" + surgeryType + "</th>";
        table += "<th>" + patientName + "</th>";
        table += "</tr></thead>";

        table += "<tbody>";

        // HVT 항목 목록 (순서대로)
        const hvtItems = [
            "Rt.lobe",
            "RHVt",
            "RSHVt",
            "RIHVt",
            "RIHVpt",
            "RIHVat",
            "MHVt",
            "V5t",
            "V58t",
            "V8t",
        ];

        // 각 HVT 항목에 대해 테이블 행 생성 (볼륨이 0보다 큰 경우만 표시)
        hvtItems.forEach((item) => {
            const volume = volumeData[item];
            const percent = percentData[item];
            const grwr = grwrData[item];
            
            // 볼륨이 0보다 큰 경우에만 표시
            if (volume !== undefined && volume !== null) {
                const numVolume = parseFloat(volume.toString().replace(/[^\d.]/g, "")) || 0;
                if (numVolume > 0) {
                const bgColor = COLOR.HVT[item] || "#FFFFFF";
                
                // 항목 이름 행 (색상 배경 유지)
                table += "<tr>";
                table += "<th style='background-color: " + bgColor + ";'>" + item + "</th>";
                table += "<td class='value'>" + this.formatVolume(volume) + "</td>";
                table += "</tr>";

                // 퍼센트 행 (첫 번째 컬럼은 회색, 두 번째 컬럼은 흰색)
                // Rt.lobe의 경우 특별 처리 (GRWR 표시)
                if (item === "Rt.lobe") {
                    table += "<tr class='percent-row'>";
                    table += "<td class='percent-row'>" + (percent ? this.formatPercent(percent) : "100.00%") + "</td>";
                    table += "<td class='percent-row'>" + (grwr ? this.formatPercent(grwr) : "GRWR") + "</td>";
                    table += "</tr>";
                } else if (percent) {
                    table += "<tr class='percent-row'>";
                    table += "<td class='percent-row'>" + this.formatPercent(percent) + "</td>";
                    table += "<td class='value'><strong>" + (grwr ? this.formatPercent(grwr) : "") + "</strong></td>";
                    table += "</tr>";
                } else {
                    // 퍼센트가 없어도 행은 표시 (0%로)
                    table += "<tr class='percent-row'>";
                    table += "<td class='percent-row'>0%</td>";
                    table += "<td class='value'><strong>" + (grwr ? this.formatPercent(grwr) : "0.00%") + "</strong></td>";
                    table += "</tr>";
                }
                }
            }
        });

        // Recip BW 행 (있는 경우만)
        if (recipBW) {
            const recipBgColor = COLOR.HVT["Recip BW"] || "#D4D4D4";
            // CSV에 이미 kg가 포함되어 있으면 추가하지 않음
            const recipBWDisplay = recipBW.toLowerCase().includes("kg") ? recipBW : recipBW + " kg";
            table += "<tr>";
            table += "<th style='background-color: " + recipBgColor + ";'>Recip BW</th>";
            table += "<td class='value'>" + recipBWDisplay + "</td>";
            table += "</tr>";
        }

        table += "</tbody></table>";

        return table;
    }

    // Liver 5-Section Volume 테이블 생성
    createLiver5SectionTable(csvData, surgeryType = "Liver 5-Section") {
        console.log("Creating Liver 5-Section table with data:", csvData);

        var rows = csvData.replaceAll('"', "").split("\r\n");
        rows = rows.filter((row) => row.trim() !== "");

        if (rows.length === 0) return "<p>데이터가 없습니다.</p>";

        const splitRow = (row) => row.split(/\t|,/).map((value) => value.trim());

        var parsedRows = rows.map((row) => splitRow(row));
        var headers = parsedRows[0];

        // CSV 헤더 분석: Segment, Volume (cm³), Percentage (%), GRWR (%)
        const segIdx = headers.findIndex(h => h.toLowerCase().includes("segment"));
        const volIdx = headers.findIndex(h => h.toLowerCase().includes("volume"));
        const pctIdx = headers.findIndex(h => h.toLowerCase().includes("percent") && !h.toLowerCase().includes("grwr"));
        const grwrIdx = headers.findIndex(h => h.toLowerCase().includes("grwr"));

        var volumeData = {};
        var percentData = {};
        var grwrData = {};
        var recipBW = "";

        const extractRecipBW = (row) => {
            const normalized = row.map((value) => String(value || "").trim());
            const labelIndex = normalized.findIndex((value) => {
                const lower = value.toLowerCase();
                return lower.includes("recip") || lower.includes("bw");
            });

            if (labelIndex === -1) return "";

            for (let index = labelIndex + 1; index < normalized.length; index++) {
                if (normalized[index]) return normalized[index];
            }

            return "";
        };

        // 데이터 추출
        for (let i = 1; i < parsedRows.length; i++) {
            const row = parsedRows[i];
            const segment = row[segIdx]?.trim();
            if (segment) {
                volumeData[segment] = row[volIdx]?.trim() || "0";
                percentData[segment] = row[pctIdx]?.trim() || "0";
                grwrData[segment] = row[grwrIdx]?.trim() || "0";
            }

            const firstCol = row[0]?.trim() || "";
            const secondCol = row[1]?.trim() || "";

            const extractedRecipBW = extractRecipBW(row);
            if (extractedRecipBW) {
                recipBW = extractedRecipBW;
            } else if (firstCol.toLowerCase().includes("recip") || firstCol.toLowerCase().includes("bw")) {
                if (!secondCol && i + 1 < parsedRows.length) {
                    const nextRow = parsedRows[i + 1];
                    recipBW = nextRow[1]?.trim() || "";
                } else {
                    recipBW = secondCol || "";
                }
            }
        }

        return this._generateLiver5SectionTableHTML(volumeData, percentData, grwrData, recipBW, surgeryType);
    }

    // Liver 5-Section 테이블 HTML 생성
    _generateLiver5SectionTableHTML(volumeData, percentData, grwrData, recipBW, surgeryType) {
        const theme = this.isDarkMode
            ? this.getCommonStyles().dark
            : this.getCommonStyles().light;
        const displaySurgeryType = String(surgeryType || "").toUpperCase();

        const parseNumericValue = (value) => {
            const numericValue = parseFloat(String(value || "").replace(/[^\d.]/g, ""));
            return isNaN(numericValue) ? 0 : numericValue;
        };

        const sumValues = (...values) =>
            values.reduce((total, value) => total + parseNumericValue(value), 0);

        // HCC 색상 참조
        const colors = COLOR.HCC || {
            wholeLiverBg: "#FFE5E5",
            rtlobeBg: "#FFE0E0",
            ltlobeBg: "#FFFFD5",
            rasBg: "#FFB3BA",
            rpsBg: "#dfc3e6",      // 연한 보라
            llsBg: "#FFD9B3",      // 연한 주황
            lmsBg: "#FFFACD",      // 연한 노랑 (레몬 쉬폰)
            spigelianBg: "#B3F0FF", // 연한 네온 하늘색
            cancerBg: "#FFB6C6",
            grwrBg: "#BFBFBF",
            recipBWBg: "#B3D9FF"
        };

        const style = `
        <style>
            .liver-5section-table {
                border-collapse: collapse;
                width: 100%;
                max-width: 600px;
                font-family: Arial, sans-serif;
                margin: 20px 0;
                box-shadow: ${theme.boxShadow};
                color: ${theme.textColor};
                table-layout: fixed;
            }
            
            .liver-5section-table th, 
            .liver-5section-table td {
                border: 1px solid ${theme.tableBorder};
                padding: 8px;
                text-align: center;
                width: 50%;
            }
            
            .liver-5section-table th {
                font-weight: bold;
            }
            
            .liver-5section-table thead th {
                background-color: ${theme.header};
                color: ${theme.headerText};
            }
            
            .ras { background-color: ${colors.rasBg}; }
            .rps { background-color: ${colors.rpsBg}; }
            .lls { background-color: ${colors.llsBg}; }
            .lms { background-color: ${colors.lmsBg}; }
            .rt-lobe { background-color: ${colors.rtlobeBg}; }
            .lt-lobe { background-color: ${colors.ltlobeBg}; }
            .spigelian { background-color: ${colors.spigelianBg}; }
            .grwr { background-color: ${colors.grwrBg}; }
            .recip-bw { background-color: ${colors.recipBWBg}; }
            .value { background-color: ${theme.valueBg}; }
            
            .surgery-header {
                background-color: ${theme.header};
                color: ${theme.headerText};
                text-align: center;
                font-weight: bold;
                padding: 10px;
            }
        </style>
        `;

        let table = style + "<table class='liver-5section-table'>";

        // 헤더
        table += "<thead><tr>";
        table += "<th colspan='2' class='surgery-header'>" + displaySurgeryType + "</th>";
        table += "</tr></thead>";

        table += "<tbody>";

        const rtLobeVolume = sumValues(volumeData["RAS"], volumeData["RPS"]);
        const ltLobeVolume = sumValues(volumeData["LMS"], volumeData["LLS"], volumeData["Spigelian"]);
        const totalLobeVolume = rtLobeVolume + ltLobeVolume;
        const rtLobePercent = totalLobeVolume > 0 ? ((rtLobeVolume / totalLobeVolume) * 100).toFixed(2) : "0.00";
        const ltLobePercent = totalLobeVolume > 0 ? ((ltLobeVolume / totalLobeVolume) * 100).toFixed(2) : "0.00";

        return table;
    }

    // CCC 테이블 생성 (Segment, Volume, Percentage 형식)
    createCCCTable(csvData, surgeryType = "CCC") {
        console.log("Creating CCC table with data:", csvData);

        var rows = csvData.replaceAll('"', "").split("\r\n");
        rows = rows.filter((row) => row.trim() !== "");

        if (rows.length === 0) return "<p>데이터가 없습니다.</p>";

        var parsedRows = rows.map((row) => row.split(","));
        var headers = parsedRows[0];

        // 헤더 인덱스 찾기
        let segmentIdx = 0;
        let volumeIdx = 1;
        let percentIdx = 2;

        // 헤더 기반으로 정확한 인덱스 찾기
        for (let i = 0; i < headers.length; i++) {
            const headerLower = headers[i].toLowerCase().trim();
            if (headerLower.includes("segment")) {
                segmentIdx = i;
            } else if (headerLower.includes("volume")) {
                volumeIdx = i;
            } else if (headerLower.includes("percent") || headerLower.includes("%")) {
                percentIdx = i;
            }
        }

        var volumeData = {};
        var percentData = {};

        // 데이터 추출
        if (parsedRows.length > 1) {
            for (let i = 1; i < parsedRows.length; i++) {
                const row = parsedRows[i];
                const segment = row[segmentIdx]?.trim() || "";
                const volume = row[volumeIdx]?.trim() || "";
                const percent = row[percentIdx]?.trim() || "";

                if (segment && volume) {
                    volumeData[segment] = volume;
                    percentData[segment] = percent;
                }
            }
        }

        return this._generateCCCTableHTML(volumeData, percentData, surgeryType);
    }

    // CCC 테이블 HTML 생성
    _generateCCCTableHTML(volumeData, percentData, surgeryType) {
        const theme = this.isDarkMode
            ? this.getCommonStyles().dark
            : this.getCommonStyles().light;

        const colors = COLOR.CCC || {
            "Whole Liver": "#BFBFBF",
            "Rt.lobe": "#FFDFC1",
            "Lt.lobe": "#FFFFD5",
            "Spleen": "#E6CCEF",
            "cyst": "#B8E6B8",
            "Cancer": "#FFCCCC",
        };

        const style = `
        <style>
            .ccc-table {
                border-collapse: collapse;
                width: 100%;
                max-width: 600px;
                font-family: Arial, sans-serif;
                margin: 20px 0;
                box-shadow: ${theme.boxShadow};
                color: ${theme.textColor};
                table-layout: fixed;
            }
            
            .ccc-table th, 
            .ccc-table td {
                border: 1px solid ${theme.tableBorder};
                padding: 8px;
                text-align: center;
                width: 50%;
            }
            
            .ccc-table th {
                font-weight: bold;
            }
            
            .ccc-table thead th {
                background-color: ${theme.header};
                color: ${theme.headerText};
            }
            
            .value { background-color: ${theme.valueBg}; }
            
            .surgery-header {
                background-color: ${theme.header};
                color: ${theme.headerText};
                text-align: center;
                font-weight: bold;
                padding: 10px;
            }
        </style>
        `;

        let table = style + "<table class='ccc-table'>";

        // 헤더행
        table += "<thead><tr>";
        table += "<th colspan='2' class='surgery-header'>" + surgeryType + "</th>";
        table += "</tr></thead>";

        table += "<tbody>";

        // Whole Liver 행
        const wholeLiverBg = colors["Whole Liver"];
        table += "<tr>";
        table += `<th colspan='2' style='background-color: ${wholeLiverBg};'>Whole Liver</th>`;
        table += "</tr>";
        table += "<tr>";
        table += `<td colspan='2' class='value'>${this.formatVolume(volumeData["Whole Liver"])}</td>`;
        table += "</tr>";

        // Spleen / cyst 행
        table += "<tr>";
        table += `<th style='background-color: ${colors["Spleen"]};'>Spleen</th>`;
        table += `<th style='background-color: ${colors["cyst"]};'>cyst</th>`;
        table += "</tr>";
        table += "<tr>";
        table += `<td class='value'>${this.formatVolume(volumeData["Spleen"])}</td>`;
        table += `<td class='value'>${this.formatVolume(volumeData["cyst"])}</td>`;
        table += "</tr>";
        table += "<tr>";
        table += `<td class='value'>${this.formatPercent(percentData["Spleen"])}</td>`;
        table += `<td class='value'>${this.formatPercent(percentData["cyst"])}</td>`;
        table += "</tr>";

        // Rt.lobe / Lt.lobe 행
        table += "<tr>";
        table += `<th style='background-color: ${colors["Rt.lobe"]};'>Rt.lobe</th>`;
        table += `<th style='background-color: ${colors["Lt.lobe"]};'>Lt.lobe</th>`;
        table += "</tr>";
        table += "<tr>";
        table += `<td class='value'>${this.formatVolume(volumeData["Rt.lobe"])}</td>`;
        table += `<td class='value'>${this.formatVolume(volumeData["Lt.lobe"])}</td>`;
        table += "</tr>";
        table += "<tr>";
        table += `<td class='value'>${this.formatPercent(percentData["Rt.lobe"])}</td>`;
        table += `<td class='value'>${this.formatPercent(percentData["Lt.lobe"])}</td>`;
        table += "</tr>";

        // Cancer 행 (있는 경우만)
        if (volumeData["Cancer"]) {
            table += "<tr>";
            table += `<th style='background-color: ${colors["Cancer"]};'>Cancer</th>`;
            table += "<th style='background-color: #FFFFFF;'></th>";
            table += "</tr>";
            table += "<tr>";
            table += `<td class='value'>${this.formatVolume(volumeData["Cancer"])}</td>`;
            table += "<td class='value'></td>";
            table += "</tr>";
            table += "<tr>";
            table += `<td class='value'>${this.formatPercent(percentData["Cancer"])}</td>`;
            table += "<td class='value'></td>";
            table += "</tr>";
        }

        table += "</tbody></table>";

        return table;
    }

    // Lung 폐절제 계획 테이블 생성
    createLungTable(csvData, surgeryType = "LUNG") {
        console.log("Creating Lung table with data:", csvData);

        var rows = csvData.replaceAll('"', "").split("\r\n");
        rows = rows.filter((row) => row.trim() !== "");

        if (rows.length === 0) return "<p>데이터가 없습니다.</p>";

        var parsedRows = rows.map((row) => row.split(","));
        var headers = parsedRows[0];

        var volumeData = {};
        var percentData = {};
        var segmentOrder = []; // CSV의 순서 유지

        // 헤더 기반 인덱스 찾기
        let segmentIdx = -1;
        let volumeIdx = -1;
        let percentIdx = -1;

        for (let i = 0; i < headers.length; i++) {
            const headerLower = headers[i].toLowerCase().trim();
            if (headerLower.includes("segment") || i === 0) {
                segmentIdx = i;
            } else if (headerLower.includes("volume")) {
                volumeIdx = i;
            } else if (headerLower.includes("percent") || headerLower.includes("%")) {
                percentIdx = i;
            }
        }

        // 헤더만 있는 경우 처리
        if (volumeIdx === -1 && headers.length > 1) {
            volumeIdx = 1;
        }
        if (percentIdx === -1 && headers.length > 2) {
            percentIdx = 2;
        }

        // 데이터 추출
        if (parsedRows.length > 1) {
            for (let i = 1; i < parsedRows.length; i++) {
                const row = parsedRows[i];
                const segment = row[segmentIdx]?.trim() || "";
                const volume = row[volumeIdx]?.trim() || "";
                const percent = percentIdx >= 0 ? row[percentIdx]?.trim() || "" : "";

                if (segment && volume) {
                    volumeData[segment] = volume;
                    if (percent) {
                        percentData[segment] = percent;
                    }
                    segmentOrder.push(segment); // 순서 기록
                }
            }
        }

        // 전체 폐 부피 찾기 (R_Lung, L_Lung, Right Lung, Left Lung 등)
        let totalLungVolume = 0;
        let lungType = "";
        let totalLungKey = "";

        if (volumeData["R Lung"]) {
            totalLungVolume = parseFloat(volumeData["R Lung"].toString().replace(/[^\d.]/g, "")) || 0;
            lungType = "R";
            totalLungKey = "R Lung";
        } else if (volumeData["L Lung"]) {
            totalLungVolume = parseFloat(volumeData["L Lung"].toString().replace(/[^\d.]/g, "")) || 0;
            lungType = "L";
            totalLungKey = "L Lung";
        } else if (volumeData["R_Lung"]) {
            totalLungVolume = parseFloat(volumeData["R_Lung"].toString().replace(/[^\d.]/g, "")) || 0;
            lungType = "R";
            totalLungKey = "R_Lung";
        } else if (volumeData["L_Lung"]) {
            totalLungVolume = parseFloat(volumeData["L_Lung"].toString().replace(/[^\d.]/g, "")) || 0;
            lungType = "L";
            totalLungKey = "L_Lung";
        } else if (volumeData["Right Lung"]) {
            totalLungVolume = parseFloat(volumeData["Right Lung"].toString().replace(/[^\d.]/g, "")) || 0;
            lungType = "R";
            totalLungKey = "Right Lung";
        } else if (volumeData["Left Lung"]) {
            totalLungVolume = parseFloat(volumeData["Left Lung"].toString().replace(/[^\d.]/g, "")) || 0;
            lungType = "L";
            totalLungKey = "Left Lung";
        }

        // CSV에 퍼센트가 없으면 계산 (전체 폐 항목 제외)
        if (Object.keys(percentData).length === 0 && totalLungVolume > 0) {
            for (const segment of segmentOrder) {
                // 전체 폐(R_Lung, L_Lung 등)는 제외
                if (segment !== totalLungKey) {
                    const segmentVolume = parseFloat(volumeData[segment].toString().replace(/[^\d.]/g, "")) || 0;
                    const percent = ((segmentVolume / totalLungVolume) * 100).toFixed(2);
                    percentData[segment] = percent;
                }
            }
        }

        return this._generateLungTableHTML(volumeData, percentData, segmentOrder, totalLungKey, surgeryType);
    }

    // Lung 테이블 HTML 생성
    _generateLungTableHTML(volumeData, percentData, segmentOrder, totalLungKey, surgeryType) {
        // 긴 이름 축약 헬퍼 함수
        const abbreviateName = (name) => {
            // "nodules_margin_10" → "margin 10"
            // "nodules_margin_20" → "margin 20"
            if (name.includes('_margin_')) {
                const parts = name.split('_margin_');
                const marginValue = parts[1];
                return `margin ${marginValue}`;
            }
            // 언더스코어를 공백으로 변경
            return name.replace(/_/g, ' ');
        };

        const theme = this.isDarkMode
            ? this.getCommonStyles().dark
            : this.getCommonStyles().light;

        // 폐 엽별 색상
        const lungColors = {
            RUL: "#FFB6C1", // 연한 핑크 (우상엽)
            RML: "#87CEEB", // 하늘색 (우중엽)
            RLL: "#90EE90", // 연한 초록 (우하엽)
            LUL: "#FFD700", // 금색 (좌상엽)
            LLL: "#FFA500", // 주황색 (좌하엽)
        };

        const style = `
        <style>
            .lung-table {
                border-collapse: collapse;
                width: 100%;
                max-width: 600px;
                font-family: Arial, sans-serif;
                margin: 20px 0;
                box-shadow: ${theme.boxShadow};
                color: ${theme.textColor};
                table-layout: fixed;
            }
            
            .lung-table th, 
            .lung-table td {
                border: 1px solid ${theme.tableBorder};
                padding: 8px;
                text-align: center;
                width: 50%;
            }
            
            .lung-table th {
                font-weight: bold;
            }
            
            .lung-table thead th {
                background-color: ${theme.header};
                color: ${theme.headerText};
            }
            
            .rul { background-color: ${lungColors.RUL}; }
            .rml { background-color: ${lungColors.RML}; }
            .rll { background-color: ${lungColors.RLL}; }
            .lul { background-color: ${lungColors.LUL}; }
            .lll { background-color: ${lungColors.LLL}; }
            .value { background-color: ${theme.valueBg}; }
            .percent-row { background-color: #E5E5E5; }
            .surgery-header {
                background-color: ${theme.header};
                color: ${theme.headerText};
                text-align: center;
                font-weight: bold;
                padding: 10px;
            }
        </style>
        `;

        let table = style + "<table class='lung-table'>";

        // 헤더
        table += "<thead><tr>";
        table += "<th colspan='2' class='surgery-header'>" + surgeryType + "</th>";
        table += "</tr></thead>";

        table += "<tbody>";

        // 전체 폐 항목(R_Lung, L_Lung)을 제외한 항목들 표시
        const dataItems = segmentOrder.filter(segment => segment !== totalLungKey);
        
        for (let i = 0; i < dataItems.length; i += 2) {
            const item1 = dataItems[i];
            const item2 = dataItems[i + 1] || null;

            // 항목 이름 행 (축약된 이름으로 표시)
            table += "<tr>";
            table += `<th style='background-color: #E8E8E8;'>${abbreviateName(item1)}</th>`;
            if (item2) {
                table += `<th style='background-color: #E8E8E8;'>${abbreviateName(item2)}</th>`;
            } else {
                table += "<th></th>";
            }
            table += "</tr>";

            // 부피 행
            table += "<tr>";
            table += `<td class='value'>${this.formatVolume(volumeData[item1] || "")}</td>`;
            if (item2) {
                table += `<td class='value'>${this.formatVolume(volumeData[item2] || "")}</td>`;
            } else {
                table += "<td class='value'></td>";
            }
            table += "</tr>";

            // 백분율 행
            table += "<tr>";
            table += `<td class='percent-row'>${this.formatPercent(percentData[item1] || "0.00")}</td>`;
            if (item2) {
                table += `<td class='percent-row'>${this.formatPercent(percentData[item2] || "0.00")}</td>`;
            } else {
                table += "<td class='percent-row'></td>";
            }
            table += "</tr>";
        }

        // 전체 폐 항목 표시 (R_Lung, L_Lung 등)
        if (totalLungKey && volumeData[totalLungKey]) {
            table += "<tr>";
            table += `<th style='background-color: #D0D0D0;' colspan='2'>${totalLungKey}</th>`;
            table += "</tr>";

            table += "<tr>";
            table += `<td class='value' colspan='2'>${this.formatVolume(volumeData[totalLungKey])}</td>`;
            table += "</tr>";

            // 전체 폐의 퍼센트 (있으면 표시)
            if (percentData[totalLungKey]) {
                table += "<tr>";
                table += `<td class='percent-row' colspan='2'>${this.formatPercent(percentData[totalLungKey])}</td>`;
                table += "</tr>";
            }
        }

        table += "</tbody></table>";

        return table;
    }

    // Other 테이블 생성 (Lung 포맷과 동일 - 모든 수술 유형에 적용 가능)
    createOtherTable(csvData, surgeryType = "OTHER") {
        console.log("Creating Other table with data:", csvData);

        var rows = csvData.replaceAll('"', "").split("\r\n");
        rows = rows.filter((row) => row.trim() !== "");

        if (rows.length === 0) return "<p>데이터가 없습니다.</p>";

        var parsedRows = rows.map((row) => row.split(","));
        var headers = parsedRows[0];

        var volumeData = {};
        var percentData = {};
        var segmentOrder = []; // CSV의 순서 유지

        // 헤더 기반 인덱스 찾기
        let segmentIdx = -1;
        let volumeIdx = -1;
        let percentIdx = -1;

        for (let i = 0; i < headers.length; i++) {
            const headerLower = headers[i].toLowerCase().trim();
            if (headerLower.includes("segment") || i === 0) {
                segmentIdx = i;
            } else if (headerLower.includes("volume")) {
                volumeIdx = i;
            } else if (headerLower.includes("percent") || headerLower.includes("%")) {
                percentIdx = i;
            }
        }

        // 헤더만 있는 경우 처리
        if (volumeIdx === -1 && headers.length > 1) {
            volumeIdx = 1;
        }
        if (percentIdx === -1 && headers.length > 2) {
            percentIdx = 2;
        }

        // 데이터 추출
        if (parsedRows.length > 1) {
            for (let i = 1; i < parsedRows.length; i++) {
                const row = parsedRows[i];
                const segment = row[segmentIdx]?.trim() || "";
                const volume = row[volumeIdx]?.trim() || "";
                const percent = percentIdx >= 0 ? row[percentIdx]?.trim() || "" : "";

                if (segment && volume) {
                    volumeData[segment] = volume;
                    if (percent) {
                        percentData[segment] = percent;
                    }
                    segmentOrder.push(segment); // 순서 기록
                }
            }
        }

        // 첫 번째 항목을 total로 간주 (R_Lung, L_Lung 같은 전체 항목)
        let totalKey = segmentOrder[0] || "";
        let totalVolume = totalKey ? parseFloat(volumeData[totalKey].toString().replace(/[^\d.]/g, "")) || 0 : 0;

        // CSV에 퍼센트가 없으면 계산 (첫 번째 항목 제외)
        if (Object.keys(percentData).length === 0 && totalVolume > 0) {
            for (const segment of segmentOrder) {
                if (segment !== totalKey) {
                    const segmentVolume = parseFloat(volumeData[segment].toString().replace(/[^\d.]/g, "")) || 0;
                    const percent = ((segmentVolume / totalVolume) * 100).toFixed(2);
                    percentData[segment] = percent;
                }
            }
        }

        return this._generateOtherTableHTML(volumeData, percentData, segmentOrder, totalKey, surgeryType);
    }

    // Other 테이블 HTML 생성
    _generateOtherTableHTML(volumeData, percentData, segmentOrder, totalKey, surgeryType) {
        // 긴 이름 축약 헬퍼 함수
        const abbreviateName = (name) => {
            if (name.includes('_margin_')) {
                const parts = name.split('_margin_');
                const marginValue = parts[1];
                return `margin ${marginValue}`;
            }
            return name.replace(/_/g, ' ');
        };

        const theme = this.isDarkMode
            ? this.getCommonStyles().dark
            : this.getCommonStyles().light;

        const style = `
        <style>
            .other-table {
                border-collapse: collapse;
                width: 100%;
                max-width: 600px;
                font-family: Arial, sans-serif;
                margin: 20px 0;
                box-shadow: ${theme.boxShadow};
                color: ${theme.textColor};
                table-layout: fixed;
            }
            
            .other-table th, 
            .other-table td {
                border: 1px solid ${theme.tableBorder};
                padding: 8px;
                text-align: center;
                width: 50%;
            }
            
            .other-table th {
                font-weight: bold;
            }
            
            .other-table thead th {
                background-color: ${theme.header};
                color: ${theme.headerText};
            }
            
            .value { background-color: ${theme.valueBg}; }
            .percent-row { background-color: #E5E5E5; }
            .surgery-header {
                background-color: ${theme.header};
                color: ${theme.headerText};
                text-align: center;
                font-weight: bold;
                padding: 10px;
            }
        </style>
        `;

        let table = style + "<table class='other-table'>";

        // 헤더
        table += "<thead><tr>";
        table += "<th colspan='2' class='surgery-header'>" + surgeryType + "</th>";
        table += "</tr></thead>";

        table += "<tbody>";

        // 전체 항목(첫 항목)을 제외한 항목들 표시
        const dataItems = segmentOrder.filter(segment => segment !== totalKey);
        
        for (let i = 0; i < dataItems.length; i += 2) {
            const item1 = dataItems[i];
            const item2 = dataItems[i + 1] || null;

            // 항목 이름 행 (축약된 이름으로 표시)
            table += "<tr>";
            table += `<th style='background-color: #E8E8E8;'>${abbreviateName(item1)}</th>`;
            if (item2) {
                table += `<th style='background-color: #E8E8E8;'>${abbreviateName(item2)}</th>`;
            } else {
                table += "<th></th>";
            }
            table += "</tr>";

            // 부피 행
            table += "<tr>";
            table += `<td class='value'>${this.formatVolume(volumeData[item1] || "")}</td>`;
            if (item2) {
                table += `<td class='value'>${this.formatVolume(volumeData[item2] || "")}</td>`;
            } else {
                table += "<td class='value'></td>";
            }
            table += "</tr>";

            // 백분율 행
            table += "<tr>";
            table += `<td class='percent-row'>${this.formatPercent(percentData[item1] || "0.00")}</td>`;
            if (item2) {
                table += `<td class='percent-row'>${this.formatPercent(percentData[item2] || "0.00")}</td>`;
            } else {
                table += "<td class='percent-row'></td>";
            }
            table += "</tr>";
        }

        // 전체 항목 표시 (첫 항목)
        if (totalKey && volumeData[totalKey]) {
            table += "<tr>";
            table += `<th style='background-color: #D0D0D0;' colspan='2'>${totalKey}</th>`;
            table += "</tr>";

            table += "<tr>";
            table += `<td class='value' colspan='2'>${this.formatVolume(volumeData[totalKey])}</td>`;
            table += "</tr>";

            // 전체 항목의 퍼센트 (있으면 표시)
            if (percentData[totalKey]) {
                table += "<tr>";
                table += `<td class='percent-row' colspan='2'>${this.formatPercent(percentData[totalKey])}</td>`;
                table += "</tr>";
            }
        }

        table += "</tbody></table>";

        return table;
    }

    // HVT 테이블을 이미지로 변환 (Canvas 사용)
    async createHVTTableImage(csvData, surgeryType = "LDLT") {
        // 먼저 HTML 테이블 생성
        const tableHTML = this.createHVTTable(csvData, surgeryType);
        
        // 임시 컨테이너 생성 및 렌더링
        const tempContainer = document.createElement("div");
        tempContainer.style.position = "absolute";
        tempContainer.style.left = "-9999px";
        tempContainer.style.top = "0";
        tempContainer.style.width = "600px";
        tempContainer.innerHTML = tableHTML;
        document.body.appendChild(tempContainer);

        // 렌더링 대기
        await new Promise(resolve => setTimeout(resolve, 100));

        // 테이블 요소 찾기
        const tableElement = tempContainer.querySelector("table");
        if (!tableElement) {
            document.body.removeChild(tempContainer);
            throw new Error("테이블을 찾을 수 없습니다.");
        }

        // Canvas를 사용하여 이미지 생성
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        // 테이블 크기 계산
        const rect = tableElement.getBoundingClientRect();
        const scale = 2; // 고해상도를 위한 스케일
        const padding = 20;
        canvas.width = (rect.width + padding * 2) * scale;
        canvas.height = (rect.height + padding * 2) * scale;
        
        // 배경색 설정
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.scale(scale, scale);
        ctx.translate(padding, padding);

        // 테이블 행 렌더링
        const rows = tableElement.querySelectorAll("tr");
        let currentY = 0;
        const cellWidth = rect.width / 2;

        rows.forEach((row) => {
            const cells = row.querySelectorAll("th, td");
            let currentX = 0;
            let maxCellHeight = 0;

            // 먼저 최대 셀 높이 계산
            cells.forEach((cell) => {
                const cellRect = cell.getBoundingClientRect();
                if (cellRect.height > maxCellHeight) {
                    maxCellHeight = cellRect.height;
                }
            });

            cells.forEach((cell, cellIndex) => {
                const cellComputedStyle = window.getComputedStyle(cell);
                const bgColor = cellComputedStyle.backgroundColor || "#FFFFFF";
                const textColor = cellComputedStyle.color || "#000000";
                const text = cell.textContent.trim();
                const fontWeight = cellComputedStyle.fontWeight || "normal";
                const fontSize = parseInt(cellComputedStyle.fontSize) || 12;
                const fontFamily = cellComputedStyle.fontFamily || "Arial";

                // 셀 배경색 그리기
                ctx.fillStyle = bgColor;
                ctx.fillRect(currentX, currentY, cellWidth, maxCellHeight);

                // 셀 테두리 그리기
                ctx.strokeStyle = "#E2E8F0";
                ctx.lineWidth = 1;
                ctx.strokeRect(currentX, currentY, cellWidth, maxCellHeight);

                // 텍스트 그리기
                ctx.fillStyle = textColor;
                ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                
                // 텍스트가 길면 줄바꿈 처리
                const maxWidth = cellWidth - 10;
                const words = text.split(" ");
                let line = "";
                let lineY = currentY + maxCellHeight / 2 - (words.length > 1 ? (words.length - 1) * fontSize / 2 : 0);
                
                words.forEach((word) => {
                    const testLine = line + word + " ";
                    const metrics = ctx.measureText(testLine);
                    if (metrics.width > maxWidth && line !== "") {
                        ctx.fillText(line.trim(), currentX + cellWidth / 2, lineY);
                        line = word + " ";
                        lineY += fontSize;
                    } else {
                        line = testLine;
                    }
                });
                ctx.fillText(line.trim(), currentX + cellWidth / 2, lineY);

                currentX += cellWidth;
            });

            currentY += maxCellHeight;
        });

        // 임시 컨테이너 제거
        document.body.removeChild(tempContainer);

        // Canvas를 이미지로 변환
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    const imageUrl = URL.createObjectURL(blob);
                    resolve(imageUrl);
                } else {
                    reject(new Error("이미지 생성 실패"));
                }
            }, "image/png");
        });
    }
}
