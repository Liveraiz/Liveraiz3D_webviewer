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
| `LUNG`, `R_LUNG`, `L_LUNG`, `ROI_LUNG` | Lung Resection Plan |
| `_OTHER` / `_Other` / ` OTHER` | Other |
| `LT_OTHER`, `LDLT_OTHER` | LT Other |
| `CCC` | CCC Surgery |
| `HCC` | HCC Surgery |
| `LDKT` | LDKT Surgery |
| `KT` | KT Surgery |
| `LDLT`, `5-SECTION`, `RL` | LDLT Surgery (`HVT`가 포함된 LDLT 모델은 하위 종류인 HVT Table 사용) |
| `LEFT` | LEFT Surgery |

- 관련 코드: [src/utils/Constants.js](src/utils/Constants.js#L52-L102)

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
