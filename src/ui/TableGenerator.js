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

                // 두 번째 컬럼 이름이 환자 이름
                if (columnNames.length >= 2) {
                    patientNameFromCSV = columnNames[1];
                }

                // CSV 데이터 구조 분석 및 파싱 (React 컴포넌트와 동일)
                for (let i = 0; i < parsedCsvData.length; i += 2) {
                    const segmentRow = parsedCsvData[i];
                    const volumeRow = parsedCsvData[i + 1];

                    if (segmentRow && volumeRow) {
                        // KT 컬럼과 환자이름 컬럼에서 데이터 추출
                        const leftSegment = segmentRow.KT;
                        const rightSegment = segmentRow[patientNameFromCSV];
                        const leftVolume = volumeRow.KT;
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
}
