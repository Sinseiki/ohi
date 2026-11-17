# 온라인 한글 입력기 (Online HanGeul IME)

**온라인 한글 입력기(OHI)**는 운영체제에 별도의 한글 입력기를 설치하지 않고 웹에서 한글·영문 자판을 사용하거나 화상 자판으로 문자를 입력할 수 있는 입력기입니다.

이 저장소의 입력기는 **이호석 님의 온라인 한글 입력(Online Hangul Input)**을 바탕으로 **팥알 님의 수정판**과 **신세기 수정판**을 거쳐 여러 자판 및 입력 편의 기능을 더한 판입니다. 기존 한글 조합 기능을 최대한 유지하면서, 두벌식의 겹받침 갈마들이·순아래·나눠치기 기능은 별도 확장 파일로 관리합니다.

- **신세기 수정판:** https://ssgi.kr/ohi
- **팥알 수정판:** https://ohi.pat.im
- **이호석 원판:** http://ohi.pat.im/org
- **팥알 님의 OHI 설명:** https://pat.im/910
- **신세기 수정판 저장소:** https://github.com/sinseiki/ohi

> 이 문서는 **2026년 11월 16일의 소스 구성**(`index.html`, `keyboard_layouts.js`, `additional_layouts.js`, `ohi.js`, `ohi-extension.ts`, `ohi-extension.js`)을 기준으로 작성한 **개발·유지보수 안내서**입니다. 자판의 사용법을 모두 열거하기보다는 코드의 구성, 연결 관계, 변경 위치, 검증 절차에 중점을 둡니다.

## 1. 실행과 개발 환경

이 판은 별도의 프레임워크나 번들러 없이 동작하는 **정적 HTML + 일반 JavaScript** 프로젝트입니다. 웹페이지를 사용하는 데 Node.js나 TypeScript가 필요하지 않습니다. 다만 확장 소스를 수정하고 다시 생성할 때에는 TypeScript 컴파일러가 필요합니다.

```text
.
├── index.html             # 사용자 화면, 메뉴, 화면 모양, 스크립트 불러오기
├── keyboard_layouts.js    # 주요 한글·영문 자판 배열 및 관련 조합 규칙
├── additional_layouts.js  # 기타·옛 배열·실험적 배열과 관련 규칙
├── ohi.js                 # OHI 본체: 글쇠 이벤트, 문자 조합, 화면 자판, 옵션
├── ohi-extension.ts       # 두벌식 부가기능·나눠치기의 TypeScript 원본
└── ohi-extension.js       # 브라우저에서 실행할 컴파일 결과
```

### 실행

여섯 파일을 같은 폴더에 두고 `index.html`을 열면 됩니다. 로컬 환경에서 HTTP 서버를 사용하려면 해당 폴더에서 다음 명령을 실행할 수 있습니다.

```bash
python -m http.server 8000
```

그다음 `http://localhost:8000/`에 접속합니다. 기본 설정은 **한국 표준 두벌식**, 영문 **QWERTY**, 기준 자판 **QWERTY**, 한글 입력 상태입니다.

### 확장 파일 컴파일

확장 기능을 바꿀 때에는 **`ohi-extension.ts`만 직접 수정**하고 다음 명령으로 브라우저용 파일을 다시 생성합니다.

```bash
tsc ohi-extension.ts --target ES2015 --module none --lib DOM,ES2015 --outFile ohi-extension.js
```

이 명령으로 생성한 결과는 문서 작성 시점에 제공된 `ohi-extension.js`와 **바이트 단위로 일치함을 확인**했습니다. `ohi-extension.js`를 수작업으로 수정하면 다음 컴파일 때 덮어써지므로 원본 수정은 TypeScript 파일에서 진행합니다.

`namespace OHIExtension`을 브라우저의 전역 이름으로 사용하므로, **ES 모듈로 전환하거나 `import`/`export` 모듈 방식으로 임의 변경하지 않습니다.** 모듈 구조로 바꾸려면 `ohi.js`와 `index.html`의 연동을 함께 설계해야 합니다.

## 2. 파일별 역할

| 파일 | 담당 기능 | 수정하는 경우 |
| --- | --- | --- |
| `index.html` | 자판 메뉴, 설명, 글상자, 옵션·배열표 자리, CSS, 밝고 어두운 화면 | 화면 배치, 메뉴 명칭, 도움말, 화면 모양 변경 |
| `keyboard_layouts.js` | 주된 자판 배열, 자판 메타데이터, 기본 조합표·줄임말표 | 기본 제공 자판이나 그 조합 규칙 변경 |
| `additional_layouts.js` | 보조·이전·연구용 자판 및 조합표 | 추가 제공 자판 변경 |
| `ohi.js` | 이벤트 연결, 한글 조합, 선택 영역, 화상 자판, 옵션, 상태 표시 | 기존 입력 엔진 및 확장 연결 지점 변경 |
| `ohi-extension.ts` | 두겹이·두줄이 순아래, 겹받침 갈마들이, 두벌식 나눠치기 | 해당 확장 기능과 호환 규칙 변경 |
| `ohi-extension.js` | `ohi-extension.ts`를 컴파일한 실행 파일 | **직접 수정하지 않음** |

### 스크립트를 불러오는 순서

`index.html`은 아래 순서로 스크립트를 불러옵니다.

```html
<script src="keyboard_layouts.js"></script>
<script src="additional_layouts.js"></script>
<script src="ohi.js"></script>
<script src="ohi-extension.js"></script>
```

OHI 본체는 전역 변수와 함수를 사용하고, 확장 파일은 본체의 전역 기능을 참조합니다. 따라서 이 순서를 유지해야 합니다. 본체 `ohi.js`는 끝부분에서 `ohiStart()`와 `url_query()`를 호출하며, 페이지의 `onload`에서는 `show_keyboard_layout(1)` 등을 실행합니다.

`index.html`에는 별도의 HTML 틀, 자판 메뉴, 고정 너비 중심의 CSS가 들어 있습니다. 화면 너비·체크박스 이름을 변경할 때는 **옵션 생성 함수뿐 아니라 CSS의 가로 공간 제약**도 확인해야 합니다.

## 3. OHI 본체 구조

### 3.1 글쇠 입력 흐름

`ohiStart()`가 입력 대상에 필요한 처리를 준비하고 `document`에 `keydown`, `keypress`, `keyup` 이벤트를 등록합니다. **두벌식 나눠치기 글쇠와 일부 단축키만 `keydown`에서 먼저 처리**합니다. 그 밖의 일반 문자 및 세모이 입력은 기존 `keypress` 경로를 사용합니다.

```text
물리 글쇠 입력
    │
    ├─ ohiKeydown()
    │      ├─ OHIExtension.tryKeydown() → 단축키·두벌식 나눠치기 글쇠 우선 처리
    │      │      └─ 처리했으면 preventDefault()로 keypress 중복 방지
    │      └─ 그 밖의 글쇠 → 기존 되걸음쇠·줄바꾸개·이동 글쇠 처리
    ├─ ohiKeypress() : 일반 문자의 변환 및 입력 경로 선택
    │      ├─ 영문 → ohiRoman()
    │      └─ 한글
    │           ├─ 세벌식 모아치기 → pressed_key_accumulation()
    │           ├─ 두벌식 나눠치기 → OHIExtension.tryPartialKeypress() (옛 경로 대응)
    │           ├─ 일반 두벌식 → ohiHangeul2()
    │           └─ 일반 세벌식 → ohiHangeul3()
    └─ ohiKeyup()    : 모아친 글쇠의 확정·상태 해제
                           └─ OHIExtension.tryPartialKeyup()
```

입력 함수는 자판 배열에서 문자값을 읽고 한글 조합 상태를 갱신합니다. 실제 글상자 값·선택 영역 반영에는 `ohiInsert()`, `ohiInput()`, `ohiSelection()` 등이 사용됩니다.

**주의:** `keydown`에서 처리한 글쇠는 원래의 `keypress`를 건너뛰며, 처리하지 않은 글쇠는 기존 경로로 돌아갑니다. 실제 키 이벤트는 브라우저·운영체제·입력기·키보드 동시 입력 가능 수에 따라 다르며, 운영체제나 브라우저가 먼저 차지한 단축키는 웹 페이지에서 받지 못할 수 있습니다.

### 3.2 주요 함수

| 함수 | 역할 |
| --- | --- |
| `ohiStart()` | 초기화, 상태 표시, 입력 이벤트 연결 |
| `ohiChange()`, `ohiChange_KE()`, `ohiChange_KBD_type()` | 자판·한영 상태·기준 자판 변경 |
| `find_layout_info()`, `find_current_layout_info()`, `find_current_layout()` | 자판 정보 및 실제 적용 배열 조회 |
| `ohiKeydown()`, `ohiKeypress()`, `ohiKeyup()` | 글쇠 이벤트 분기 |
| `ohiHangeul2()`, `ohiHangeul3()` | 두벌식·세벌식 입력 처리 |
| `ohiHangeul3_moa()` | 세벌식 모아치기 묶음 조합 |
| `ohiDoubleJamo()` | OHI 내부 낱자 코드의 겹낱자 조합 판별 |
| `NFD_hangeul_input()` | 첫가끝 방식의 낱자 조합 |
| `complete_hangeul_syllable()` | 현재 한글 조합 마무리 |
| `ohiHangeul_backspace()`, `ohiBackspace()` | 조합 상태에 따른 지우기 |
| `show_options()` | 사용 중인 자판과 기능에 따른 옵션 표시 |
| `show_keyboard_layout()`, `tableKey_press()` | 화상 자판 생성·눌림 표시 |
| `show_keyboard_layout_info()` | 선택 자판 및 입력 방식 설명 표시 |
| `url_query()` | URL 질의 문자열의 일부 시작 설정 적용 |

### 3.3 한글 조합 상태

OHI는 완성형 요즘한글을 위한 `ohiQ`와 첫가끝 조합을 위한 `NFD_stack`을 함께 사용합니다.

- `ohiQ`: 길이 9의 배열. `[첫소리 3칸, 가운뎃소리 3칸, 끝소리 3칸]`을 담습니다. 각 칸의 값은 OHI 내부 부호계에 속하며 일반 유니코드 자모값과 혼동하면 안 됩니다.
- `ohiRQ`, `prev_ohiQ`, `prev_ohiRQ`: 조합에 필요한 부가 상태와 이전 조합 정보입니다.
- `NFD_stack`: 첫가끝 낱자, 조합된 낱자, 가상 낱자 등에 관한 상태입니다.
- `pressed_keys`, `pressing_keys`: 모아치기·나눠치기에서 겹쳐 누른 글쇠와 눌림 개수를 추적할 때 사용합니다.
- `prev_cursor_position`: 줄임말 등으로 들어간 글자를 지울 때 필요한 선택 영역의 이전 위치입니다.

겹받침·순아래를 추가할 때는 **화면에 표시하는 결합 문자값**과 **다음 글쇠를 처리하기 위한 내부 낱자 상태**가 다를 수 있습니다. 임의로 `ohiQ`를 완성형 코드 하나로 치환하면 지우기·도깨비불·받침 이동이 달라질 수 있습니다.

### 3.4 입력 방식 구분

- **이어치기:** 들어온 낱자를 차례대로 `ohiHangeul2()` 또는 `ohiHangeul3()`에서 조합합니다.
- **세벌식 모아치기:** `3m-` 계열 자판이 글쇠 묶음을 수집한 뒤 `ohiHangeul3_moa()`에서 조합하고, 해당 자판의 줄임말 규칙도 사용할 수 있습니다.
- **두벌식 나눠치기:** 지원 자판에서 겹쳐 누른 글쇠의 순서만 일부 정정하여 **기존 `ohiHangeul2()`에 한 글쇠씩 다시 전달**합니다. 세벌식 모아치기 엔진을 대체하지 않습니다.
- **첫가끝·옛한글:** 자판 정보와 현재 옵션에 따라 `NFD_hangeul_input()` 등 별도 조합 경로를 사용합니다.

## 4. 자판 배열과 조합표 관리

### 4.1 배열 정보

`keyboard_layouts.js`와 `additional_layouts.js`는 자판 정보를 객체로 등록합니다. 주요 속성은 다음과 같습니다.

| 속성 | 의미 |
| --- | --- |
| `KE` | `Ko` 또는 `En` |
| `type_name` | 코드에서 쓰는 자판 식별자 |
| `full_name` | 화면에 나타낼 자판 이름 |
| `layout` | 기본 글쇠 배열 |
| `sublayout` | 보조 배열 및 화상 자판용 부가 표시 |
| `capslock_layout` | Caps Lock 상태에서의 배열(있는 경우) |
| `extended_hangeul_layout` | 한글 확장 배열 |
| `extended_sign_layout` | 기호 확장 배열 |
| `hangeul_combination_table` | 이어치기 낱자 조합 규칙 |
| `hangeul_convenience_combination_table` | 편의 조합 규칙 |
| `ieochigi_hangeul_abbreviation_table` | 이어치기 줄임말 규칙 |
| `moachigi_hangeul_combination_table` | 세벌식 모아치기 낱자 조합 규칙 |
| `moachigi_multikey_abbreviation_table` | 글쇠 묶음 기준 줄임말 규칙 |
| `moachigi_hangeul_abbreviation_table` | 낱자 묶음 기준 줄임말 규칙 |
| `old_hangeul_layout_type_name` | 해당 자판과 연결된 옛한글 배열 이름 |
| `link` | 자판을 설명하는 외부 링크 |

배열은 **ASCII 코드 33(`!`)부터 126(`~`)까지의 글쇠 위치**를 기준으로 하므로 일반적으로 `layout[key - 33]`으로 조회합니다. 문자값은 유니코드 부호값이며, 일부 자판은 한 글쇠 위치에 배열 형태의 복수 값을 둘 수 있습니다. 값이 항상 하나의 숫자라고 가정하면 안 됩니다.

### 4.2 자판 식별자 관례

소스에 다음 관례가 사용됩니다.

- `2-`: 두벌식 자판
- `3-`: 공세벌식 등 세벌식 자판
- `Sin3-`: 신세벌식 계열
- `3m-`: 모아치기 세벌식 계열
- `3t-`, `4t-`: 타자기 배열
- 끝의 `-y`: 옛한글 배열
- 끝의 `_gm`: 일부 갈마들이 배열

이는 기존 OHI에서 사용하는 **코드 식별자 관례**입니다. 화면에 보이는 이름을 짧게 바꾸더라도 기존 식별자는 유지하는 편이 안전합니다.

### 4.3 현재 주요 자판

| 화면 구분 | `type_name` | 참고 |
| --- | --- | --- |
| 표준 | `2-KSX5002` | KS X 5002 두벌식 |
| 국규 | `2-KPS9256` | KPS 9256 두벌식 |
| 두줄이 | `2-Dujule` | 두벌식 줄맞춤 e |
| 3-90 | `3-90` | 공병우 세벌식 계열 |
| 3-91 | `3-91` | 공병우 최종 자판 |
| 신세벌식 P2 | `Sin3-P2` | 신세벌식 계열 |
| 참신세벌식 | `Sin3-Cham` | 참신세벌식 v18 |
| 세모이 | `3m-Semoe` | 세벌식 모아치기 e |
| 가온한글26KM | `2-Gaon26KM` | 보조 자판 목록에 등록 |

이 표는 주요 사례만 보여 줍니다. 전체 지원 자판은 두 배열 파일의 `keyboard_layouts.push(...)`, `additional_layouts.push(...)`에서 확인하십시오. `index.html`의 메뉴와 `ohiChange_between_same_type()`의 순환 목록은 **별도로 관리**하므로, 배열을 등록했다고 자동으로 주 메뉴에 표시되지는 않습니다.

### 4.4 새 자판을 추가하는 순서

1. 해당 배열 파일에 자판 배열과 필요한 조합표를 정의합니다.
2. `keyboard_layouts` 또는 `additional_layouts`에 `KE`, `type_name`, `full_name`, `layout` 등을 등록합니다.
3. 실제 입력을 확인한 후 필요한 경우 `index.html`에 선택 메뉴를 추가합니다.
4. 주요 자판 순환 기능에도 넣으려면 `ohiChange_between_same_type()`의 목록을 수정합니다.
5. 순아래·나눠치기 같은 확장을 지원해야 한다면 `ohi-extension.ts`의 **지원 자판 판별과 조합 가능 조건**을 함께 확인합니다.
6. 화상 자판, 지우기, 겹받침 분해, 영문 전환을 포함하여 회귀 검증합니다.

## 5. 두벌식 부가기능 (`OHIExtension`)

`ohi-extension.ts`는 원본 본체 함수를 덮어쓰지 않고, `ohi.js`가 정해진 지점에서 호출하는 **전역 `OHIExtension` 이름 공간**으로 작성되어 있습니다.

### 5.1 두겹이·두줄이 순아래

확장 대상은 다음 두 자판입니다.

- `2-KSX5002`: **두겹이 순아래**
- `2-Dujule`: **부가기능 순아래**

`initializeLayouts()`가 각 자판의 바탕 배열과 겹받침을 추가한 배열을 준비하고, `syncLayout()`은 기능 상태에 따라 자판 정보 객체의 `layout` 참조를 바꿉니다. 그 결과 입력 엔진과 화상 자판이 같은 활성 배열을 조회합니다.

다음은 두 자판의 확장에서 **시프트 윗글쇠 I/J/K/L**에 추가되는 받침입니다.

| 윗글쇠 | 두겹이 순아래 | 부가기능 순아래 |
| --- | --- | --- |
| `I` | ㅆ | ㅄ |
| `J` | ㄶ | ㄶ |
| `K` | ㅄ | ㄺ |
| `L` | ㄺ | ㄲ |

- `tryAlternateShift()`: 두겹이에서는 `;`, 두줄이에서는 `/` 글쇠를 이용하여 **바로 앞 낱자**를 바꿉니다. 일반 Shift를 잠그거나 다음 글쇠에 적용하는 기능이 아닙니다.
- `tryDoubleFinal()`: 홀소리와 받침을 같은 글쇠 자리에 놓은 부분에서 문맥에 맞게 받침을 선택합니다. 현재 홀소리와 결합할 수 있는 겹홀소리가 있으면 기존 조합을 우선합니다.
- `findFinalParts()`: 겹받침을 이루는 두 닿소리를 찾아 OHI가 다음 홀소리·되걸음쇠를 처리할 수 있도록 내부 상태를 보존합니다.
- `renderAlternateShiftKey()`: 해당 확장을 사용할 때 화상 자판에 대체 시프트 표시를 덧씁니다.

부가기능의 체크 상태는 자판마다 `extendedEnabled`에 **따로 보관**합니다. `isEnabled()`는 체크 상태뿐 아니라 **현재 자판과 입력 방식**도 확인합니다.

**거듭 순아래(`option.sunalae`)와 두겹이·두줄이 순아래는 서로 배타적**입니다. 하나를 켜면 다른 하나의 체크 상태를 끄며, 끈 기능이 자동으로 복원되지는 않습니다.

### 5.2 나눠치기

나눠치기는 다음 네 가지 **두벌식 자판**에서 사용할 수 있습니다.

| 지원 자판 | `type_name` |
| --- | --- |
| 표준 | `2-KSX5002` |
| 국규 | `2-KPS9256` |
| 두줄이 | `2-Dujule` |
| 가온한글26KM | `2-Gaon26KM` |

나눠치기는 **시간 제한을 정해 글쇠 묶음을 만드는 방식이 아닙니다.** 실제 눌린 물리 글쇠의 상태는 확장 파일의 `partialHeldKeys`에서 개별적으로 관리합니다. `pressed_keys`, `pressing_keys`는 기존 OHI의 화상 자판 표시와의 연결에도 사용합니다. **등록된 글쇠를 모두 놓았을 때** 수집한 묶음을 확정하며, 관계없는 `keyup` 이벤트는 묶음에 영향을 주지 않습니다.

```text
글쇠를 누름
  ├─ tryKeydown() → 지원 글쇠라면 우선 처리
  └─ tryPartialKeypress() (옛 경로 대응)
       ├─ 대상 글쇠인가? → 묶음에 수집
       └─ 대상 밖의 글쇠인가? → 앞 묶음을 먼저 확정

마지막으로 등록된 글쇠를 놓음
  └─ tryPartialKeyup()
       ├─ 눌림 기록에 없는 글쇠 → 무시
       └─ 모두 해제됨 → flushPartialChord()
                            └─ reorderPartialKeys()
                                 └─ 순서를 정정한 글쇠를 ohiHangeul2()에 차례대로 전달
```

`reorderPartialKeys()`는 길이가 **2~3개인 묶음**에 한하여 제한된 정정을 수행합니다.

- **닿소리 1개 + 홀소리 1~2개:** 첫소리 → 홀소리 순서로 정리합니다.
- **홀소리 2개:** 겹홀소리가 될 수 있는 쪽으로 순서를 정정합니다.
- **닿소리 2개:** 역순으로만 겹받침이 가능하면 순서를 뒤집습니다.
- **그 밖의 묶음:** 원래 순서를 유지합니다. 길이가 4개 이상인 묶음도 임의로 재배열하지 않습니다.

자동 반복 입력은 겹누름 묶음에 중복 누적하지 않고, 대기 중인 묶음을 확정한 뒤 기존 `ohiHangeul2()`로 처리합니다. 눌림과 해제는 가능하면 `KeyboardEvent.code`로 같은 물리 글쇠를 식별하며, 해당 값이 없는 오래된 환경에서는 글쇠값을 맞춰 판단합니다.

묶음을 만들 때는 `partialTarget`에 **입력을 시작한 요소**를 기억합니다. 다른 입력창으로 포커스를 옮기거나, 브라우저가 포커스를 잃거나, 마우스로 입력 위치를 바꾸거나, 나눠치기 옵션·자판·기준 자판을 전환하면 먼저 기존 묶음을 그 요소에 확정하고 내부 눌림 상태를 정리합니다. 나눠치기의 입력 상태는 세모이의 기존 모아치기 입력 상태와 구별해서 관리합니다.

#### `ㅑ+ㅣ`, `ㅕ+ㅣ` 조합

일반 겹홀소리 규칙 외에 OHI 본체가 별도로 처리하는 다음 조합도 나눠치기 순서 판별에 반영되어 있습니다.

| 낱자 | 결과 | 적용 조건 |
| --- | --- | --- |
| `ㅑ + ㅣ` | `ㅒ` | 거듭 순아래 또는 국규·가온한글26KM 등 기존 본체 허용 조건 |
| `ㅕ + ㅣ` | `ㅖ` | 위와 같음 |
| `ㅇ + ㅣ + ㅑ` | `얘` | 위 조합이 허용되는 자판·상태에서 순서 정정 |
| `ㅇ + ㅣ + ㅕ` | `예` | 위 조합이 허용되는 자판·상태에서 순서 정정 |

이 예외는 `canCombineVowels()`에 구현되어 있습니다. **나눠치기를 켰다는 이유만으로 기존 자판에 없던 겹홀소리 조합을 새로 추가하지 않습니다.** 예를 들어 일반 표준 두벌식에서 거듭 순아래를 끄면 해당 조합은 기존 방식대로 처리됩니다.

#### 지원하지 않는 조합 방식

`isPartialEnabled()`는 아래 조건에서 거짓을 반환합니다.

- 현재 한글 두벌식 지원 자판이 아닌 경우
- **옛한글 입력**, **첫가끝 강제 조합**, **풀어쓰기** 중인 경우
- OHI 입력 기능을 꺼 둔 경우

세모이(`3m-` 계열)의 기존 모아치기는 `is_moachigi_input()`과 `ohiHangeul3_moa()`가 담당하며, 여기의 두벌식 나눠치기와 **별개**입니다.

### 5.3 옵션 렌더링과 표시 조건

`ohi.js`의 `show_options()`는 기본 옵션을 만들고, `OHIExtension.renderOptions(opts)`로 확장 옵션을 연결합니다. 확장 쪽은 필요한 요소를 최초 한 번 만들고 체크 상태·표시 여부를 다시 설정합니다.

현재 화면에 사용하는 명칭은 다음과 같습니다.

| 화면 옵션 | 코드상의 상태·함수 | 의미 |
| --- | --- | --- |
| **거듭 순아래** | `option.sunalae` | 홀소리를 거듭 눌러 된소리를 입력하는 기존 방식 |
| **두겹이 순아래** | `OHIExtension.setEnabled()` | 표준 두벌식의 두겹이 기능 |
| **부가기능 순아래** | `OHIExtension.setEnabled()` | 두줄이의 겹받침·대체 시프트 기능 |
| **나눠치기** | `OHIExtension.setPartialEnabled()` | 두벌식 겹누름 순서 정정 |
| **옛한글** | `option.enable_old_hangeul_input` | 지원 자판의 옛한글 입력 |

나눠치기를 켜면 `show_options()`가 **옛한글 체크박스를 감추고**, 해제하면 원래의 표시 조건에 따라 복원합니다. **숨김과 체크 상태 변경은 다릅니다.** 현재의 코드에서는 표시하지 않는 옵션의 값까지 일괄 초기화하는 방식이 아니므로, 새로운 충돌 처리 기능을 만들 때에는 표시 조건과 실제 활성 조건을 나누어 살펴야 합니다.

추가 옵션 때문에 화면에서 체크박스가 밀린다면 다음 두 영역을 함께 확인합니다.

1. `ohi.js`의 `show_options()` 및 `ohi-extension.ts`의 `renderOptions()` / `renderPartialOptions()`에서 나타내는 문구
2. `index.html`의 `#middle_options`, `.option`, `.option label`, `.checkbox`에 관한 CSS

화면 명칭은 간결하게 쓰되, 기능의 뜻은 `title`과 도움말 링크에 남기는 방식을 따릅니다.

### 5.4 화상 자판의 눌림 표시

`ohi.js`의 `tableKey_press()`는 해당 글쇠를 `pressed` 클래스로 표시합니다. 기존 세벌식 모아치기뿐 아니라 **두벌식 나눠치기에서도** `pressed_keys`에 모은 여러 글쇠가 표시되도록 확장되어 있습니다.

눌림 표시를 수정할 때는 아래를 함께 확인합니다.

- 입력 이벤트와 화면 표시에서 같은 글쇠 부호를 비교하는가?
- 겹누름 중 수집한 여러 글쇠가 함께 표시되는가?
- 마지막 글쇠를 놓은 뒤 다음 타건에서 표시가 초기화되는가?
- Shift 및 대체 시프트 표시가 엉뚱하게 겹치지 않는가?

화상 자판은 입력 결과를 설명하는 **표시 계층**이므로 조합 상태의 논리를 화면 표시에서 별도로 재구현하지 않는 것이 좋습니다.

## 6. 화면, 변환 기능, 시작 설정

### 화면 구성

`index.html`에는 주요·추가·옛 자판 목록과 입력 글상자, 도움말·검색 화면, 옵션 표시 자리 등이 있습니다. `gotoTab()`으로 화면을 전환하며, `show_keyboard_layout()`이 자판을 다시 그립니다.

- 밝은 화면 / 어두운 화면: `toggleTheme()`; `localStorage`의 `ohi_theme`와 운영체제 색상 설정을 사용합니다.
- 문자 입력: `#inputText` 글상자 및 OHI가 연결한 입력 필드
- 자판 표시: `#keyboardLayout`와 `#keyboardLayoutInfo`
- 옵션 영역: `#top_options`, `#middle_options`, `#bottom_options`
- 문자열 변환: HTML 문자 참조(NCR), 글쇠 기준 직접 입력 문자열 변환 및 역변환
- 기타: 검색 입력, 글 베끼기, 상태 표시줄, 즐겨찾기용 스크립트 안내

### 대표적인 전환 동작

메뉴에서 자판을 선택할 때는 `ohiChange('Ko', '2-Dujule')` 같은 형태를 사용합니다. `ohiChange()`는 나눠치기 대기 묶음이 있으면 먼저 확정한 다음 자판을 변경합니다.

`url_query()`는 `kbd`, `ko`, `en`, `sunalae`, `abbr` 등 일부 질의 문자열을 읽습니다. **확장 옵션의 모든 상태를 URL로 제어하는 기능은 구현되어 있지 않습니다.** URL 시작 설정을 추가하려면 본체의 적용 시점과 확장 파일의 준비 시점을 함께 검토해야 합니다.

### 외부 페이지에서 OHI 사용하기

페이지의 도움말에는 외부 페이지에서 OHI를 불러오는 즐겨찾기 코드가 남아 있습니다. 다만 일부 예시가 **예전 원격 스크립트 주소를 사용**하고, 현재 확장 파일을 함께 불러오지는 않습니다. 그러므로 이 저장소의 `index.html`에서 사용하는 전체 기능과 외부 페이지용 예제가 **동일하다고 가정하지 마십시오.** 외부 삽입 기능을 변경할 때에는 별도로 검증해야 합니다.

## 7. 작업 방식과 협업 원칙

1. **원래 OHI의 처리 경로를 존중합니다.** 새 기능 때문에 기존 두벌식·세벌식·옛한글·줄임말 기능을 광범위하게 바꾸지 않습니다.
2. **부가기능은 가능한 한 `ohi-extension.ts`에 구현합니다.** 본체에는 확장 진입점과 꼭 필요한 연결만 둡니다.
3. **소스 주석은 순한국어를 우선**합니다. 팥알 님과의 협업을 고려하여 기존 OHI에서 쓰는 *닿소리, 홀소리, 첫소리, 가운뎃소리, 끝소리, 글쇠, 갈마들이, 나눠치기* 등의 표현을 존중합니다. 코드의 기존 식별자나 표준 명칭을 억지로 바꿀 필요는 없습니다.
4. **자판 식별자와 화면 이름을 구분**합니다. 사용자에게 보이는 이름을 바꿀 때 내부 `type_name`까지 바꾸지 않습니다.
5. **TypeScript는 필요한 곳에만 타입을 적습니다.** 원본의 전역 연동 부분 등은 명시하되, 함수 반환값처럼 추론이 충분한 곳에는 불필요한 타입을 덧붙이지 않습니다.
6. **범위 조건은 하한 → 변수 → 상한 순서**로 표현합니다. 예: `65 <= key && key <= 90`.
7. **생성된 JavaScript를 직접 고치지 않습니다.** TypeScript 수정 → 컴파일 → 문법 검사 → 입력 회귀 검증 순서로 작업합니다.
8. **화상 자판과 실제 입력을 함께 확인**합니다. 배열 변경은 `find_current_layout()`의 입력 결과와 화면 양쪽에 영향을 줍니다.

## 8. 검증 방법

### 8.1 정적 검사

Node.js가 설치되어 있다면 네 실행용 JavaScript 파일을 다음과 같이 검사할 수 있습니다.

```bash
node --check keyboard_layouts.js
node --check additional_layouts.js
node --check ohi.js
node --check ohi-extension.js
```

TypeScript 확장을 변경한 경우에는 앞의 컴파일 명령으로 `ohi-extension.js`를 다시 생성합니다. 입력 동작을 검증하는 **Python Playwright 시험 네 가지**가 `tests/`에 들어 있습니다.

```bash
python tests/partial_regression.py
python tests/keydown_regression.py
python tests/extended_regression.py
python tests/legacy_regression.py
```

시험 환경에 Python Playwright가 없다면 `pip install playwright`와 `python -m playwright install chromium`으로 준비할 수 있습니다. 시험은 외부 주소로 접속하지 않고 현재 폴더의 HTML과 JavaScript를 브라우저에 불러온 뒤, 실제 글쇠 누름·해제 이벤트를 발생시킵니다. `extended_regression.py`는 다른 브라우저의 실행 파일이 설치되어 있으면 `--browser firefox` 또는 `--browser webkit`으로 실행할 수 있습니다. 해당 브라우저가 설치되지 않았다면 시험을 건너뜁니다.

**2026년 11월 17일 Chromium 확인 결과: 44 + 30 + 79 + 50 = 총 203개 검사 통과.** Firefox와 WebKit은 실행 파일이 없어 실제 검증하지 못했습니다. 실제 키보드의 동시 입력 지원 수준도 별도로 확인해야 합니다.

### 8.2 기능별 회귀 점검표

| 영역 | 확인할 사항 |
| --- | --- |
| 표준 두벌식 | 평범한 낱자 입력, 겹받침·된소리, 다음 홀소리에서 받침 이동 |
| 국규·두줄이 | 해당 배열 글쇠의 출력과 기호 위치 |
| 두겹이·부가기능 순아래 | 켜기/끄기, 윗글쇠 겹받침, 대체 시프트, 지우기 |
| 거듭 순아래 | 홀소리 반복에 따른 된소리 조합, 부가기능 순아래와 상호 배제 |
| 나눠치기 | 한 글쇠씩 입력, 두·세 글쇠 겹누름, 누르는 순서 바꾸기 |
| 겹받침 나눠치기 | `ㅂ+ㅅ` 등 받침 조합과 뒤따르는 홀소리에서의 분해 |
| 겹홀소리 나눠치기 | `ㅗ+ㅣ`, `ㅜ+ㅓ` 등 순서 정정과 기존 조합 유지 |
| 예외 겹홀소리 | 국규·가온한글26KM·거듭 순아래에서 `ㅑ+ㅣ → ㅒ`, `ㅕ+ㅣ → ㅖ` |
| 옵션 | 나눠치기를 켜면 옛한글 숨김, 끄면 복원, 자판별 옵션 표시 |
| 화상 자판 | 겹친 글쇠 표시, 입력 방식 전환 뒤 배열 갱신 |
| 세벌식 | 3-90, 3-91, 신세벌식, 참신세벌식의 일반 입력 |
| 세모이 | 기존 모아치기, 이어치기 옵션, 줄임말·기호 확장 |
| 기타 | Backspace, Space, Enter, Shift, Ctrl 등 특수 글쇠 |
| 화면·변환 | 밝고 어두운 화면, 문자 변환, 글 베끼기, 옵션 넘침 |

**특히 브라우저의 실제 글쇠 눌림·해제 이벤트로 검증**해야 합니다. `ohiHangeul2()` 같은 조합 함수만 호출하여 통과한 검사는 키보드 이벤트 경로의 검증을 대신할 수 없습니다.

### 8.3 현재 구조에서 주의할 부분

- 선택적 `keydown` 입력: 나눠치기와 `Ctrl+Enter`, `Ctrl/Shift+Space`, `Alt+1/2/3`은 먼저 `keydown`에서 처리합니다. 그 밖의 입력은 기존 `keypress`를 유지하며, 운영체제·브라우저가 예약한 단축키는 OHI가 가로챌 수 없습니다. 향후 다른 입력을 옮기려면 나눠치기·세모이·화상 자판을 함께 회귀 검증해야 합니다.
- 공유된 글쇠 상태: `pressed_keys`, `pressing_keys`는 세모이와 나눠치기가 재사용합니다. 두벌식 나눠치기의 실제 눌림 기록은 별도 `partialHeldKeys`에 저장하므로, 기능 전환 때 확정·초기화 순서를 보존해야 합니다.
- 고정 너비 화면: 옵션을 추가하거나 이름을 늘리면 가로 폭을 넘을 수 있습니다.
- 생성 파일 동기화: `ohi-extension.ts`와 `ohi-extension.js`가 서로 다른 수정 상태로 배포되지 않도록 합니다.
- 옛한글과 나눠치기의 상호작용: 옛한글 **표시 여부**와 **실제 사용 가능 여부**를 같은 것으로 취급하지 않습니다.
- 원격 삽입 스크립트: 도움말 속 예전 주소를 그대로 사용하는 경로와 현재 로컬 여섯 파일의 기능은 다를 수 있습니다.


### 8.4 자동 시험별 확인 범위와 남은 과제

| 시험 | 검사 수 | 내용 |
| --- | ---: | --- |
| `partial_regression.py` | 44 | 겹누름, 순서 정정, 반복 입력, 포커스 변경, 자판 전환 |
| `keydown_regression.py` | 30 | 선택적 `keydown`, 중복 입력 방지, 수정키 단축키, 기준 자판 |
| `extended_regression.py` | 79 | 지원 자판 4종, 겹홀소리 예외, 화상 자판 눌림, 편집키, 입력 대상 변경, 세모이 이벤트 경로 |
| `legacy_regression.py` | 50 | 선택적 `keydown` 이전 버전과 일반 한글 입력·세모이 조합 출력 비교 |

`legacy_reference.json`은 `ohi-partial-key-state-fix.zip`에서 수집한 참고 출력입니다. `legacy_regression.py`는 이를 읽어 현재 코드에서 같은 글쇠 순서를 눌렀을 때 출력이 달라졌는지 검사합니다. 비교 대상은 세모이, 신세벌식 P2, 3-1990, 3-1991, 표준 두벌식이며, 입력 기능 전체의 정확성을 입증하는 시험은 아닙니다.

**검증 한계와 후속 확인 사항:**

- Firefox·WebKit의 실제 키 이벤트 동작은 아직 검증되지 않았습니다. Playwright 시험을 실행할 브라우저가 설치되면 `python tests/extended_regression.py --browser firefox`로 확인해야 합니다.
- 키보드 고스팅·롤오버, 운영체제 입력기와의 충돌, 운영체제 예약 단축키는 실물 키보드와 사용자 환경에서 별도 확인이 필요합니다.
- 나눠치기로 모은 모든 글쇠를 놓은 뒤에도 화상 자판에는 직전에 눌렀던 글쇠 강조가 남을 수 있습니다. 이는 기존 OHI의 마지막 입력 글쇠 표시 방식으로, 현재 회귀 점검에서 오류로 분류하지 않았습니다.
- 세모이의 모든 줄임말·기호 확장 조합을 망라한 것은 아닙니다. 새 기능을 추가할 때에는 관련 자판의 대표 입력과 예외 사례를 계속 보강하십시오.

**코드 변경 정책:** 이번 검증 단계에서는 재현되는 입력 오류를 찾지 못해 `ohi.js`, 자판 배열 파일, `ohi-extension.ts`, 생성된 `ohi-extension.js`를 수정하지 않았습니다. 시험과 문서만 추가했습니다.

## 9. 주요 기능을 수정할 때 찾아볼 위치

| 고치려는 기능 | 우선 살펴볼 위치 |
| --- | --- |
| 기본 자판·글쇠 배치 | `keyboard_layouts.js` / `additional_layouts.js` |
| 자판 선택 메뉴 | `index.html`, `ohiChange_between_same_type()` |
| 화면 옵션 이름·보이기·숨기기 | `show_options()`, `OHIExtension.renderOptions()` |
| 나눠치기 사용 가능 자판 | `partialTypes`, `isPartialEnabled()` |
| 나눠치기 순서 정정 | `partialKind()`, `canCombineVowels()`, `canCombineFinals()`, `reorderPartialKeys()` |
| 겹누름 확정·반복 입력 | `tryKeydown()`, `partialPhysicalKey()`, `partialHeldKeys`, `tryPartialKeypress()`, `tryPartialKeyup()`, `flushPartialChord()` |
| 두겹이·두줄이 윗글쇠 확장 | `initializeLayouts()`, `syncLayout()`, `tryDoubleFinal()` |
| 대체 시프트 | `tryAlternateShift()`, `renderAlternateShiftKey()` |
| 일반 두벌식 조합 | `ohiHangeul2()` |
| 일반 세벌식·모아치기 | `ohiHangeul3()`, `ohiHangeul3_moa()` |
| 첫가끝·옛한글 | `NFD_hangeul_input()`, `is_old_hangeul_input()` |
| 눌림 표시 | `tableKey_press()` |
| 자판·상태 설명 | `show_keyboard_layout_info()` |
| 테마·화면 너비 | `index.html`의 스크립트와 CSS |

## 10. 저작자·원본·라이선스

이 프로젝트는 여러 개발자의 작업을 바탕으로 합니다.

- **이호석 님:** 온라인 한글 입력(원판) — http://ohi.pat.im/org
- **팥알 님:** OHI 수정판 및 여러 자판·기능 — https://ohi.pat.im / https://pat.im/910
- **신세기:** 이 저장소의 수정판 및 추가 기능 — https://ssgi.kr/ohi

기존 README에 따라 **`ohi.js`는 GNU General Public License(GPL)**를 따릅니다. `ohi.js` 머리말에는 **GPL 버전 2 또는 그 이후 버전** 조건이 명시되어 있습니다.

- GPL 안내: https://www.gnu.org/licenses/gpl.html
- 기존 출처와 저작권 표시는 배포 시 유지하십시오.
- 이 문서는 **각 파일의 개별 저작권·재배포 조건을 새로 판정하거나 변경하지 않습니다.** 배포·병합 전에는 소스 머리말, 상위 저장소 및 관련 라이선스 문서를 함께 확인하십시오.

---

**유지보수 핵심 원칙:** 자판 배열, OHI 본체의 한글 조합, TypeScript 확장을 분리하여 이해하고 변경합니다. 기존 입력 엔진을 보존하면서 새로운 기능은 가능한 한 확장에서 처리하며, **실제 입력·되걸음쇠·옵션 표시·화상 자판**을 함께 검증합니다.

