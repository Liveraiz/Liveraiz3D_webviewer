// utils/TableGenerator.js

import { COLOR, tableColor } from "../utils/color.js";

export class TableGenerator {
    constructor(isDarkMode = false) {
        this.isDarkMode = isDarkMode;
    }

    setTheme(isDarkMode) {
        this.isDarkMode = isDarkMode;
    }

    // 공통 스타일 정의
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
                header: "#3A98B9",
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

    // HCC 테이블 생성 (기존 코드 그대로)
    createHCCTable(csvData, surgeryType = "HCC") {
        console.log("Creating HCC table with data:", csvData);

        var rows = csvData.replaceAll('"', "").split("\r\n");

        rows = rows.filter((row) => row.trim() !== "");

        if (rows.length === 0) return "<p>데이터가 없습니다.</p>";

        var parsedRows = rows.map((row) => row.split(","));
        var headers = parsedRows[0];

        var volumeData = {};
        var percentData = {};

        if (parsedRows.length > 1) {
            for (var i = 0; i < headers.length; i++) {
                var key = headers[i];
                var value = parsedRows[1][i] || "0";
                volumeData[key] = value;
            }
        }

        if (parsedRows.length > 2) {
            for (var i = 0; i < headers.length; i++) {
                var key = headers[i];
                var value = parsedRows[2][i] || "0";
                percentData[key] = value;
            }
        } else {
            percentData = { ...volumeData };
        }

        return this._generateHCCTableHTML(volumeData, percentData, surgeryType);
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
        var recipBW = "";

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
            "V58",
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
                                
                                // Rt.lobe의 경우 GRWR 처리
                                if (item === "Rt.lobe" && (nextFirstCol.toUpperCase() === "GRWR" || nextSecondCol.toUpperCase() === "GRWR")) {
                                    // GRWR 행은 퍼센트로 처리하지 않음
                                    // 첫 번째 컬럼이 퍼센트인지 확인
                                    var firstPercent = parseFloat(nextFirstCol.replace(/[^\d.]/g, "")) || 0;
                                    if (firstPercent > 0 && firstPercent <= 100) {
                                        percentData[item] = firstPercent.toString();
                                    }
                                    i++; // GRWR 행 건너뛰기
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

        return this._generateHVTTableHTML(volumeData, percentData, recipBW, patientName, surgeryType);
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
    _generateHCCTableHTML(volumeData, percentData, surgeryType) {
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
        table += "<td></td>";
        table += "<th class='spigelian'>Spigelian</th>";
        table += "</tr>";

        table += "<tr>";
        table += "<td></td>";
        table +=
            "<td class='value'>" +
            this.formatVolume(volumeData["Spigelian"]) +
            "</td>";
        table += "</tr>";

        table += "<tr>";
        table += "<td></td>";
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
    _generateHVTTableHTML(volumeData, percentData, recipBW, patientName, surgeryType) {
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
            "V58",
            "V8t",
        ];

        // 각 HVT 항목에 대해 테이블 행 생성 (볼륨이 0보다 큰 경우만 표시)
        hvtItems.forEach((item) => {
            const volume = volumeData[item];
            const percent = percentData[item];
            
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
                    table += "<td class='percent-row'>GRWR</td>";
                    table += "</tr>";
                } else if (percent) {
                    table += "<tr class='percent-row'>";
                    table += "<td class='percent-row'>" + this.formatPercent(percent) + "</td>";
                    table += "<td class='value'><strong>" + this.formatPercent(percent) + "</strong></td>";
                    table += "</tr>";
                } else {
                    // 퍼센트가 없어도 행은 표시 (0%로)
                    table += "<tr class='percent-row'>";
                    table += "<td class='percent-row'>0%</td>";
                    table += "<td class='value'><strong>0.00%</strong></td>";
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
