# 3D 모델 메쉬 네이밍 규칙 (Model Naming Conventions)

이 문서는 Blender/제작 단계에서 `.glb`/`.gltf` 모델을 만들 때 **메쉬 이름을 어떻게 짓느냐에 따라 뷰어에서 자동으로 적용되는 동작**을 정리한 것입니다.
뷰어 코드는 메쉬 이름(문자열)을 검사해서 투명도 조절 가능 여부, 이동/회전 가능 여부, 2D 라벨 부착 여부, 자동 셰이더 적용, 리스트 정렬/숨김 등을 자동으로 결정합니다. 새 모델을 제작하거나 기존 모델을 수정할 때 아래 규칙을 참고하세요.

> 매칭은 기본적으로 **대소문자 구분 없이**, 이름에 키워드 문자열이 **포함(includes)** 되어 있으면 적용됩니다 (정확히 일치해야 하는 경우는 별도 표시).

---

## 1. 투명도(Opacity) 조절 규칙

### 1-1. `T_` 접두사
이름이 `T_`로 **시작**하면 키워드 목록과 무관하게 오브젝트 패널에서 투명도 조절이 가능합니다.
- 예: `T_muscle`, `T_stomach` → 투명도 슬라이더 활성화
- 관련 코드: [src/utils/Constants.js](src/utils/Constants.js#L423) `isOpacityControllableMeshName()`

### 1-2. 키워드 매칭 (`OPACITY_CONTROLLABLE_KEYWORDS`)
아래 키워드가 이름에 포함되면 투명도 조절이 가능합니다. (구분자 `_`, `-`, 공백 차이는 무시하고 비교)
- **간(Liver) 계열** – `LIVER_KEYWORDS`: `liver`, `lobe`, `Rtlobe`, `Ltlobe`, `LLS`, `LMS`, `Spigelian`, `RAS`, `RPS`, `RHVt`, `MHVt`, `LHVt`, `V4t/V4at/V4bt/V5t/V58t/V8t`, `Remnant`, `Resection`, `Seg1`~`Seg8`(대소문자 변형 포함), `P1`~`P8`(v/d 변형), `S1`~`S8`, `front`, `back`
- **폐절제(Lung) 계열** – `LUNG_RESECTION_KEYWORDS`: `LLL`, `LUL`, `RLL`, `RML`, `RUL`, `LUL_Preserved`, `LUL_Target`, `S1`~`S10` 및 `S1a/S1b/S1c` 등 세그먼트 표기, `Target`, `margin`
- **PCD 계열** – `PCD_KEYWORDS`: `subcutaneous_Fat`, `fluid_collection`, `colon_ROI`
- **DIEP 계열** – `DIEP_KEYWORDS`: `muscle`, `T_muscle`, `body`
- **기타**: `myometrium`, `uterus`, `recipient_cavity`, `pancreas`, `bladder`, `tumor`, `cancer`, `glissonean_pedicle`, `fibroid`, `body`, `stomach wall`
- 관련 코드: [src/utils/Constants.js](src/utils/Constants.js#L376-L397)

### 1-3. 로드 시 자동 투명도 처리 (이름 기반, 패널과 무관하게 즉시 적용)
- 이름에 `pelvis` 포함 → `opacity = 0.2` 자동 적용 (아래 3-2번 일반 투명 규칙에서 제외됨)
- 그 외 `material.transparent === true`로 만들어진 메쉬는 로드 시 `opacity = 0.60`, `alphaTest = 0.30`이 자동으로 설정됨 (pelvis 제외)
- 관련 코드: [src/loaders/ModelLoader.js](src/loaders/ModelLoader.js#L783-L823)

---

## 2. 이동/회전 가능 규칙 (`mov`)

- 이름에 **`mov`가 포함**되어야 Translate/Rotate 컨트롤을 붙일 수 있습니다. `mov`가 없으면 콘솔에 경고를 남기고 attach가 무시됩니다.
  - 예: 소아 간이식 모델에서 **도너 그래프트(donor graft)** 메쉬를 움직이게 하려면 이름을 `donor_graft_mov`, `graft_mov`처럼 지어야 함
  - 위치는 상관없이 이름 어디에든 `mov` 문자열만 포함되면 됩니다 (접미사로 붙이는 것을 권장)
- `material.opacity <= 0.01`인 메쉬는 `mov`가 있어도 transform control이 적용되지 않습니다 (완전 투명 상태에서는 이동 불가).
- 관련 코드: [src/controls/TransformControlManager.js](src/controls/TransformControlManager.js#L147-L157) `attach()`

---

## 3. 2D 숫자 라벨 규칙 (Mass / Tumor 등)

자궁근종(myomectomy) 케이스처럼 `mass1`, `mass2`, `tumor1`처럼 이름을 지으면 뷰어가 자동으로 **숫자 라벨을 3D 위치 위에 표시**합니다.

- 대상 키워드 (`MASS_KEYWORDS`): `tumor`, `cancer`, `mass`, `cyst`
- 이름이 **숫자로 끝나야** 합니다: `mass1`, `mass_1`, `tumor2` 모두 가능 (정규식 `/.+?_?(\d+)$/`)
- 이름에 `hat` 이 포함되면 (예: 보조/캡 메쉬) 라벨 표시에서 **제외**됩니다
- 라벨 테두리 색상은 해당 메쉬의 머티리얼 색상을 그대로 사용합니다
- 관련 코드: [src/ui/MeshLabelManager.js](src/ui/MeshLabelManager.js#L18-L45) `addLabelToMesh()`

> 예시: `mass1`, `mass2` → 3D 뷰 상에 각각 "1", "2" 라벨 부착. `cyst3` 도 동일하게 "3" 라벨 부착됨.

---

## 4. 로드 시 자동 셰이더 적용 규칙

모델 로드 직후 이름에 특정 키워드가 포함된 메쉬는 자동으로 전용 셰이더 재질로 교체됩니다.

| 이름에 포함된 키워드 | 적용되는 셰이더 | 사용되는 수술/모델 |
| --- | --- | --- |
| `fibroid` | Fibrosis 셰이더 (`applyFibrosisShader`) | 자궁근종절제술(myomectomy) – 부인과(GYNECOLOGY) 모델의 근종(fibroid) 메쉬 |
| `muscle` | Muscle 셰이더 – 붉은 근섬유 질감 (`applyMuscleShader`) | DIEP 피판 유방재건술(DIEP flap) 모델의 복직근(muscle) 메쉬 – `DIEP_KEYWORDS`와 동일 대상 |
| `prostate` | Prostate 셰이더 (`applyProstateShader`) | 대장/직장 절제술(colectomy) 모델에서 랜드마크로 표시되는 Prostate 메쉬 |

- 관련 코드: [src/loaders/ModelLoader.js](src/loaders/ModelLoader.js#L757-L780)

---

## 5. 오브젝트 리스트 패널 – 제외 / 정렬 규칙

### 5-1. 목록에서 제외되는 이름
- `EXCLUDE_KEYWORDS`: `XY`, `YZ`, `XZ`, `START`, `END`, `EMPTY`, `Plane`, `Camera`, `Light`, `Empty`, `Cube`
- 관련 코드: [src/utils/Constants.js](src/utils/Constants.js#L440-L456)

### 5-2. 정렬 우선순위 (`getObjectSortOrder`)
1. `Right Group`, `Left Group`, `Superior Rectal` (그대로 일치) → 최상단 고정
2. Colectomy 케이스 전용 순서: `colon` → `Mesorectum` → `TME plane_L/R` → `Urinary_Bladder` → `Ureter` → `Prostate` → `Vas_Deferens` → `Common_Iliiac_Artery` → `Common_Illiac_Vein` → `Superior Rectal` → `Levator_ani` → `Obturator_Internus Muscle`
3. 이름에 `vol` 포함 → 맨 마지막
4. `LIVER_KEYWORDS` 포함 → 최우선
5. 혈관 키워드 (`ha`, `pv`, `bd`, `hv`) 포함 시 `hv → pv → ha → bd` 순서
6. `cancer` → `cyst` 순서로 그 다음
7. 나머지는 기본 순서
- 관련 코드: [src/ui/ObjectListPanel.js](src/ui/ObjectListPanel.js#L143-L196)

---

## 6. See-Through(투시) 모드 대상 메쉬

투시 모드 버튼을 켰을 때 반투명 처리되는 대상은 시술(procedure) 종류별로 다음 키워드를 사용합니다.

| 시술 | 대상 키워드 |
| --- | --- |
| LDLT (간이식) | `LIVER_KEYWORDS` (위 1-2 참고) |
| LUNG (폐암 절제술) | `LUNG_RESECTION_KEYWORDS` (위 1-2 참고) |
| PCD | `PCD_KEYWORDS` (위 1-2 참고) |
| GYNECOLOGY (부인과) | `myometrium`, `uterus` |

- 관련 코드: [src/functions/seeThrough.js](src/functions/seeThrough.js#L58-L73)

---

## 7. Lung Vessel ROI 모드

- **모델(파일)명**에 `ROI`가 포함되어 있으면 로드 후 자동으로 폐혈관 ROI 모드가 활성화됩니다. (메쉬 이름이 아니라 모델/파일 이름 기준)
- 타겟 영역 기준 메쉬 이름: `target a`, `target_a`, `target-a` (공백/언더스코어/하이픈 차이 무시하고 비교) → 이 메쉬들의 바운딩박스를 기준으로 교차하는 폐혈관만 컬러 유지
- 폐혈관으로 인식되는 이름 키워드: `pulmonary_artery`, `pulmonary_vein`, `bronchus`, `airway`, `airways`, `airways wall`, `vessel`, `artery`, `arteries`, `vein`, `veins`, `capillary`
- 항상 컬러 유지(흑백 desaturate 예외) 키워드: `nodules`, `nodule`, `nodules margin`, `nodule margin`, 그리고 이름에 `line` 또는 `label`이 포함된 메쉬
- 관련 코드: [src/functions/LungVesselROI.js](src/functions/LungVesselROI.js#L66-L120)

---

## 8. PCD / DIEP 모델 판정

- **모델(파일)명**에 `PCD` 또는 `DIEP`가 포함되면 해당 모델은 PCD/DIEP 전용 렌더링 모드로 처리됩니다 (`MaterialManager.setPCDModel(true)`).
- 이 모드에서는 `DIEP_KEYWORDS` (`muscle`, `T_muscle`, `body`)가 투명도 조절 가능 목록에 포함됩니다.

### 8-1. 일반 모델과의 렌더링 차이 (`updateTransparentMeshRenderOrder`)
카메라 거리 기반으로 메쉬의 렌더링 순서/깊이 처리 방식이 완전히 다르게 동작합니다.

| 구분 | PCD/DIEP 모델 | 일반 모델 |
| --- | --- | --- |
| 불투명 메쉬 (opacity ≥ 1) | `depthWrite=true`, `transparent=false` (동일) | `depthWrite=true`, `transparent=false` (동일) |
| 반투명 메쉬 (opacity < 1) | 카메라와의 거리 기준 **back-to-front로 정렬**하여 `renderOrder`를 매기고 `depthWrite=false`로 설정 | `renderOrder`를 건드리지 않고(기본값 0 유지) `depthWrite=true`로 설정 |
| 목적 | 여러 겹의 반투명 구조(예: 피하지방·체액저류 등 겹겹이 쌓인 PCD 레이어)가 서로 비쳐 보이도록 정확한 순서로 블렌딩 | 단일/소수 장기 위주라 겹침이 적어 일반 depth test로 충분하며, 뒤쪽 반투명 메쉬가 다른 반투명 메쉬에 가려 깜빡이는(blinking) 현상을 방지 |

- 관련 코드: [src/materials/MaterialManager.js](src/materials/MaterialManager.js#L387-L513) `updateTransparentMeshRenderOrder()`, [src/loaders/ModelLoader.js](src/loaders/ModelLoader.js#L487-L494)

### 8-2. `T_BD` 담관(bile duct) 예외 규칙 – 투명 간 실질 내부에서도 비쳐 보이게 하기

일반 모델은 "반투명 메시도 `depthWrite=true`로 설정"하는 정책 때문에, 담관(BD)처럼 투명한 간(liver) 실질 **내부에** 있는 반투명 메시는 앞쪽 간 메시에 가려져 보이지 않는 문제가 있었습니다. 이를 막기 위해 이름이 `T_`로 시작하고 `_`/공백/하이픈 등으로 분리했을 때 토큰 중 하나가 정확히 `bd`인 메시(예: `T_BD`, `T_BD_1`)는 opacity가 1보다 작을 때 다음과 같이 예외 처리됩니다.

- `renderOrder = -1` → 같은 투명 패스 안에서 다른 메시(간 등, 기본 `renderOrder = 0`)보다 먼저 그려짐
- `depthWrite = false` → 자신의 깊이를 깊이 버퍼에 쓰지 않아 뒤에 그려지는 간 메시가 이 메시를 가리지 않음
- `depthTest = true` 유지 → 실제로 앞을 가리는 불투명 오브젝트(피부, 다른 장기 등)에는 여전히 정상적으로 가려짐

즉 `T_BD`는 간 메시보다 먼저 그려지고 자신의 깊이를 남기지 않으므로, 뒤이어 그려지는 반투명 간 메시가 그 위에 알파 블렌딩되어 "간 속에 비치는 담관"처럼 보이면서도, 실제 깊이 관계(다른 불투명 구조에 가려지는 것)는 유지됩니다.

- 이름 판정 함수: [src/utils/Constants.js](src/utils/Constants.js#L459) `isBileDuctDepthThroughMeshName()`
- 적용 로직: [src/materials/MaterialManager.js](src/materials/MaterialManager.js) `updateTransparentMeshRenderOrder()` 일반 모델 분기

---

## 9. 신장(Kidney) 계층 구조 – 겹침 메쉬 처리

콩팥 관련 모델에서 여러 겹의 구조(피질/기둥/수질 등)가 겹칠 때 자동으로 하나만 보이도록 처리합니다.

- 계층 키워드 (`KIDNEY_HIERARCHY`, 큰 구조 → 작은 구조 순): `kidney`, `cortex`, `column`, `medulla`
- 혈관 키워드(`vein`, `artery`, `vessel`)가 포함된 메쉬는 이 겹침 처리에서 제외됨
- 이름에 `left` / `right`가 포함되어야 좌우 신장이 각각 그룹으로 분리되어 처리됨 (각 그룹에서 가장 큰 메쉬만 표시)
- 관련 코드: [src/materials/MaterialManager.js](src/materials/MaterialManager.js#L680-L720), [src/utils/Constants.js](src/utils/Constants.js#L465-L477)

---

## 10. 파일명 기반 규칙 (참고 – 메쉬 이름 아님)

아래는 메쉬 이름이 아니라 **모델/파일 이름**에 포함된 키워드로 UI에 표시되는 표(Table) 종류를 결정하는 규칙입니다 (`TABLE_TYPES`).

| 파일명 키워드 | 표 종류 |
| --- | --- |
| `CUSTOM` | **(최우선 적용)** Custom – 파일명에 `CUSTOM`이 포함되면 다른 키워드(HCC/LDLT 등)와 무관하게 항상 이 표가 사용됨 |
| `LUNG`, `R_LUNG`, `L_LUNG`, `ROI_LUNG` | Lung Resection Plan |
| `_OTHER` / `_Other` / ` OTHER` | Other |
| `LT_OTHER`, `LDLT_OTHER` | LT Other |
| `CCC` | CCC Surgery |
| `HCC` | HCC Surgery |
| `LDKT` | LDKT Surgery |
| `KT` | KT Surgery |
| `LDLT`, `5-SECTION`, `RL` | LDLT Surgery (`HVT`가 포함된 LDLT 모델은 하위 종류인 HVT Table 사용) |
| `LEFT` | LEFT Surgery |

- `CUSTOM` 판정은 `TABLE_TYPES`가 아니라 `TableGenerator.autoCreateTable()`에서 별도로 먼저 체크되는 예외 규칙이며, 다른 모든 규칙보다 먼저 검사됩니다.
- 관련 코드: [src/utils/Constants.js](src/utils/Constants.js#L52-L102), [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L197-L211) `autoCreateTable()`

### 10-1. 테이블 종류별 예시

실제 표는 **가로 2칸짜리 HTML 테이블**이며, 항목 이름(색상 배경 `<th>`)과 값(`<td>`)이 세로로 쌓이는 "행 묶음"이 반복되는 구조입니다. 아래 예시는 [src/ui/TableGenerator.js](src/ui/TableGenerator.js)의 `_generate*TableHTML()` 코드가 실제로 만들어내는 **행 순서 그대로** 재현한 것입니다 (마크다운 표의 왼쪽 열 = 테이블 1번째 칸, 오른쪽 열 = 2번째 칸).

#### Custom (`CUSTOM`)
- 예시 파일명: `261015_JJH_custom.glb`
- 파일명에 `CUSTOM`이 포함되면 `HCC`/`LDLT` 등 다른 키워드가 함께 있어도 **무조건 이 표가 먼저 적용**됨
- 표 자체는 HCC 전용 레이아웃이 아니라 **Lung 테이블과 동일한 로직(`createLungTable`)**을 재사용하며, 제목만 파일명(또는 감지된 surgeryType, 없으면 `HCC`)으로 표시
- CSV의 `Segment/Volume/Percent`를 순서대로 읽어 2개씩 짝지어 이름 행 → 볼륨 행 → 퍼센트 행을 반복하고, 첫 번째로 발견되는 전체 항목(`R Lung`/`L Lung` 등 전체 폐 키가 없으면 표시되지 않음)은 맨 마지막에 2칸 병합으로 표시
- 관련 코드: [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L207-L212) `autoCreateTable()` 내 `isCustomHccModel` 분기

| 왼쪽 칸 | 오른쪽 칸 |
| --- | --- |
| **261015_JJH_custom.glb** (헤더, 2칸 병합) |||
| RAS | RPS |
| 300.0cm³ | 250.0cm³ |
| 20.00% | 16.67% |
| LMS | LLS |
| 150.0cm³ | 200.0cm³ |
| 10.00% | 13.33% |

#### Lung Resection Plan (`LUNG`, `R_LUNG`, `L_LUNG`, `ROI_LUNG`)
- 예시 파일명: `R_LUNG_case01.glb`
- 상단 헤더는 surgeryType(예: `LUNG`)이 2칸 병합으로 표시
- 전체 폐 항목(`R Lung`/`L Lung`/`Right Lung`/`Left Lung`)을 제외한 나머지 세그먼트를 **2개씩 짝지어** 이름 행 → 볼륨 행 → 퍼센트 행 순으로 반복 표시하고, 전체 폐 항목은 맨 마지막에 2칸 병합으로 표시
- 관련 코드: [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L1993-L2132) `_generateLungTableHTML()`

| 왼쪽 칸 | 오른쪽 칸 |
| --- | --- |
| **LUNG** (헤더, 2칸 병합) |||
| S1 | S2 |
| 45.2cm³ | 38.7cm³ |
| 5.32% | 4.55% |
| Target | margin 10 |
| 12.3cm³ | 20.1cm³ |
| 1.45% | 2.36% |
| **R Lung** (2칸 병합) |||
| 850.0cm³ (2칸 병합) |||
| 100.00% (2칸 병합) |||

#### Other (`_OTHER`, `_Other`, ` OTHER`)
- 예시 파일명: `Pancreas_OTHER_case02.glb`
- Lung 테이블과 완전히 동일한 레이아웃(`_generateOtherTableHTML`)을 재사용하며, CSV의 **첫 번째 항목**을 전체(total)로 간주해 맨 마지막에 2칸 병합으로 표시
- 관련 코드: [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L2208-L2325) `_generateOtherTableHTML()`

| 왼쪽 칸 | 오른쪽 칸 |
| --- | --- |
| **OTHER** (헤더, 2칸 병합) |||
| Tumor | (빈 칸) |
| 5.2cm³ | (빈 칸) |
| 6.50% | (빈 칸) |
| **Pancreas** (2칸 병합, 전체 항목) |||
| 80.0cm³ (2칸 병합) |||
| 100.00% (2칸 병합) |||

#### LT Other (`LT_OTHER`, `LDLT_OTHER`, `LDLT Other`)
- 예시 파일명: `LDLT_OTHER_case03.glb`
- Other 테이블과 동일한 함수(`createOtherTable` → `_generateOtherTableHTML`)를 그대로 재사용하되, 간이식(LDLT) 케이스의 기타 장기용으로 표시명만 다름

#### CCC Surgery (`CCC`)
- 예시 파일명: `CCC_patient04.glb`
- 순서 고정: `Whole Liver`(2칸 병합) → `Spleen`/`cyst` 쌍 → `Rt.lobe`/`Lt.lobe` 쌍 → `Cancer`(있을 때만, 왼쪽 칸만 사용)
- 관련 코드: [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L1758-L1875) `_generateCCCTableHTML()`

| 왼쪽 칸 | 오른쪽 칸 |
| --- | --- |
| **CCC** (헤더, 2칸 병합) |||
| **Whole Liver** (2칸 병합) |||
| 1500.0cm³ (2칸 병합) |||
| Spleen | cyst |
| 120.0cm³ | 30.0cm³ |
| 8.00% | 2.00% |
| Rt.lobe | Lt.lobe |
| 900.0cm³ | 600.0cm³ |
| 60.00% | 40.00% |
| Cancer | (빈 칸) |
| 45.0cm³ | (빈 칸) |
| 3.00% | (빈 칸) |

#### HCC Surgery (`HCC`)
- 예시 파일명: `HCC_patient05.glb`
- 순서 고정: `Whole Liver`(단일 행) → `Rt.lobe`/`Lt.lobe` 쌍 → `RAS`/`LLS` 쌍 → `RPS`/`LMS` 쌍 → `Cancer`/`Spigelian` 쌍
- CSV에 `KNOWN_HCC_COLUMNS`(위 표 항목들) 외 추가 컬럼(예: `nodules_margin_10`)이 있으면 하단에 별도의 "Segment detail" 2칸 표가 추가로 붙음 (항목명은 rowspan 2, 위=볼륨/아래=퍼센트)
- CSV에 `Spleen` 컬럼과 0이 아닌 값이 있으면 별도의 "Spleen Volume" 표(제목 1행 + `Volume | 값` 1행)가 추가로 붙음
- 관련 코드: [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L1007-L1099) `_generateHCCTableHTML()`

| 왼쪽 칸 | 오른쪽 칸 |
| --- | --- |
| **HCC** (헤더, 2칸 병합) |||
| **Whole Liver** | 1500.0cm³ |
| Rt.lobe | Lt.lobe |
| 900.0cm³ | 600.0cm³ |
| 60.00% | 40.00% |
| RAS | LLS |
| 300.0cm³ | 200.0cm³ |
| 20.00% | 13.33% |
| RPS | LMS |
| 250.0cm³ | 150.0cm³ |
| 16.67% | 10.00% |
| Cancer | Spigelian |
| 45.0cm³ | 100.0cm³ |
| 3.00% | 6.67% |

별도로 붙는 Segment detail 표 예시 (rowspan 2):

| Segment detail (2칸 병합) ||
| --- | --- |
| margin 10 (rowspan 2) | 20.1cm³ |
| ^ | 2.36% |

별도로 붙는 Spleen Volume 표 예시:

| Spleen Volume (2칸 병합) ||
| --- | --- |
| Volume | 120.0cm³ |

#### LDKT Surgery / KT Surgery (`LDKT`, `KT`)
- 예시 파일명: `LDKT_donor06.glb`, `KT_case07.glb`
- 두 종류 모두 동일한 신장(Kidney) 테이블(`createKTTable` → `_generateKTTableHTML`)을 사용
- 상단 헤더가 `Whole Liver`처럼 병합되지 않고 **1번째 칸 = surgeryType(예: `KT`/`LDKT`), 2번째 칸 = 환자 이름(CSV 2번째 컬럼명)** 으로 각각 표시됨 (제목 행)
- 이후 `Cortex`/`Column`/`Medulla`/`Kidney`/`func.V` 5개 항목에 대해 `Rt.X`(왼쪽)/`Lt.X`(오른쪽) 이름 행 + 볼륨 행만 반복 (퍼센트 행 없음)
- 관련 코드: [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L1088-L1200) `_generateKTTableHTML()`

| 왼쪽 칸 | 오른쪽 칸 |
| --- | --- |
| **KT** (제목) | **PatientA** (제목, CSV 2번째 컬럼명) |
| Rt.Cortex | Lt.Cortex |
| 45.0cm³ | 42.0cm³ |
| Rt.Column | Lt.Column |
| 12.0cm³ | 10.0cm³ |
| Rt.Medulla | Lt.Medulla |
| 30.0cm³ | 28.0cm³ |
| Rt.Kidney | Lt.Kidney |
| 87.0cm³ | 80.0cm³ |
| Rt.func.V | Lt.func.V |
| 87.0cm³ | 80.0cm³ |

#### LDLT Surgery (`LDLT`, `5-SECTION`, `RL`)
파일명에 `SECTION`이 포함되는지에 따라 **두 가지 다른 표**가 표시됩니다.

**(A) 기본 LDLT 표** — 파일명에 `SECTION`이 없을 때 (예: `LDLT_RL_case08.glb`)
- 순서 고정: 제목 행(`LDLT` | 환자이름) → `Whole Liver`(단일 행) → `Rt.lobe`/`Lt.lobe` 쌍 → `GRWR`/`GRWR` 쌍(값은 `%` 포맷) → `Recip BW`(단일 행, `NN kg`)
- 관련 코드: [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L1275-L1316) `_generateLDLTTableHTML()`

| 왼쪽 칸 | 오른쪽 칸 |
| --- | --- |
| **LDLT** (제목) | **PatientA** (제목) |
| **whole Liver** | 1500.0cm³ |
| Rt.lobe | Lt.lobe |
| 900.0cm³ | 600.0cm³ |
| 60.00% | 40.00% |
| GRWR | GRWR |
| 1.20% | 1.15% |
| **Recip BW** | 70 kg |

**(B) 5-Section 표** — 파일명에 `SECTION`(예: `5-SECTION`)이 포함될 때
- 순서 고정: 제목(전체 2칸 병합) → `Rt.lobe`/`Lt.lobe` 쌍(RAS+RPS 합산 / LMS+LLS+Spigelian 합산, GRWR 행 포함) → `RAS`/`LLS` 쌍(GRWR 포함) → `RPS`/`LMS` 쌍(GRWR 포함) → `Spigelian`/`Recip BW` 쌍
- 관련 코드: [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L1516-L1704) `_generateLiver5SectionTableHTML()`

| 왼쪽 칸 | 오른쪽 칸 |
| --- | --- |
| **LDLT** (헤더, 2칸 병합) |||
| Rt.lobe | Lt.lobe |
| 550.0cm³ (RAS+RPS) | 450.0cm³ (LMS+LLS+Spigelian) |
| 55.00% | 45.00% |
| GRWR 1.10% | GRWR 0.90% |
| RAS | LLS |
| 300.0cm³ | 200.0cm³ |
| 20.00% | 13.33% |
| GRWR 0.60% | GRWR 0.40% |
| RPS | LMS |
| 250.0cm³ | 150.0cm³ |
| 16.67% | 10.00% |
| GRWR 0.50% | GRWR 0.30% |
| Spigelian | Recip BW |
| 100.0cm³ | 70 kg |
| 6.67% | (빈 칸) |
| GRWR 0.20% | (빈 칸) |

#### HVT Surgery (`HVT`)
- 예시 파일명: `LDLT_HVT_case09.glb`
- 제목 행(`LDLT` | 환자이름) 이후, 간정맥 재건 항목(`Rt.lobe`, `RHVt`, `RSHVt`, `RIHVt`, `RIHVpt`, `RIHVat`, `MHVt`, `V5t`, `V58t`, `V8t`) 중 **볼륨이 0보다 큰 항목만** 순서대로 표시
- 각 항목은 2행 1세트: 1행 = 이름(왼쪽) + 볼륨(오른쪽), 2행 = 퍼센트(왼쪽, 회색 배경) + GRWR(오른쪽, 볼드체, `%` 포맷) — 좌우로 다른 항목을 짝짓지 않고 **같은 항목의 이름/값**이 나란히 옴
- 마지막에 `Recip BW`가 있으면 이름(왼쪽) + `NN kg`(오른쪽) 행 추가
- 관련 코드: [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L1314-L1435) `_generateHVTTableHTML()`

| 왼쪽 칸 | 오른쪽 칸 |
| --- | --- |
| **HVT** (제목) | **PatientA** (제목) |
| Rt.lobe | 900.0cm³ |
| 60.00% | GRWR |
| RHVt | 50.0cm³ |
| 5.55% | 0.90% |
| MHVt | 30.0cm³ |
| 3.33% | (빈 값이면 `0.00%`) |
| Recip BW | 70 kg |

#### LEFT Surgery (`LEFT`)
- 예시 파일명: `LEFT_case10.glb`
- 좌엽(Left lobe) 전용 항목(`Lt.lobe`, `LHVt`, `V4t`, `V4at`, `V4bt`)에 대해 HVT와 동일한 2행 1세트 구조(이름+볼륨 행, 퍼센트+GRWR 행) 반복
- 마지막에 `Recip BW`가 있으면 단일 행(이름 | 값)으로 추가
- 관련 코드: [src/ui/TableGenerator.js](src/ui/TableGenerator.js#L679-L820) `createLeftTable()` / `_generateLeftTableHTML()`

| 왼쪽 칸 | 오른쪽 칸 |
| --- | --- |
| **LEFT** (제목) | **PatientA** (제목) |
| Lt.lobe | 600.0cm³ |
| 40.00% | (GRWR 값) |
| LHVt | 25.0cm³ |
| 4.16% | (GRWR 값) |
| V4t | 80.0cm³ |
| 13.33% | (GRWR 값) |
| Recip BW | 70kg |

#### FUSION Surgery (`FUSION`)
- 예시 파일명: `FUSION_case11.glb`
- `TABLE_TYPES.FUSION.method`가 `null`이므로 표(table) 자체가 생성되지 않고 기본 텍스트로만 표시됨

---

## 요약 치트시트

| 하고 싶은 것 | 이름 규칙 |
| --- | --- |
| 투명도 슬라이더 켜기 | 이름 앞에 `T_` 붙이기, 또는 위 1-2 키워드 포함 |
| 이동/회전 가능하게 하기 (도너 그래프트 등) | 이름에 `mov` 포함 (예: `graft_mov`) |
| 2D 숫자 라벨 붙이기 (종양/근종 등) | `mass`/`tumor`/`cancer`/`cyst` + 숫자로 끝내기 (예: `mass1`, `mass2`) |
| 근육 질감 자동 적용 | 이름에 `muscle` 포함 |
| 섬유종 질감 자동 적용 | 이름에 `fibroid` 포함 |
| 전립선 질감 자동 적용 | 이름에 `prostate` 포함 |
| 담관(BD)이 투명한 간 속에서 비쳐 보이게 하기 | 이름을 `T_BD`(토큰 `bd`)로 짓기 |
