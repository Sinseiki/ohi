/**
 * OHI 추가 기능 - 1단계 구현
 *
 * 표준 두벌식의 두겹이 기능과 두줄이의 겹받침 갈마들이를 지원합니다.
 * 자판 배열을 읽는 OHI의 여러 함수가 같은 결과를 얻도록, 자판 정보의
 * layout 속성이 가리키는 배열을 기능의 켜짐·꺼짐에 따라 바꿉니다.
 *
 * ohi.js에서는 tryDoubleFinal(), onSunalaeToggle(), renderOptions()만
 * 정해진 곳에서 호출합니다. OHI의 기존 함수를 덮어쓰지는 않습니다.
 *
 * 아직 구현하지 않은 기능: 대체 시프트 순아래, 부분 모아치기, 세모이 약어.
 * 적용 범위: 현대 한글 모아쓰기. 옛한글·첫가끝 강제 입력·풀어쓰기는
 * 기존 OHI의 처리 방식을 그대로 사용합니다.
 */
var OHIExtension;
(function (OHIExtension) {
    var variants = {};
    /**
     * 두 자판의 켜짐·꺼짐 배열을 처음 한 번 준비합니다.
     * variants에 이미 저장된 자판은 다시 만들지 않습니다.
     * find_layout_info()가 아직 자판을 찾지 못했다면 다음 호출 때 다시 시도합니다.
     *
     * OHI 배열은 ASCII 33번(!)부터 시작하므로, 글쇠의 문자 코드에서 33을 뺀
     * 값을 배열의 자리 번호로 씁니다. 대문자 I/J/K/L은 시프트 윗글쇠입니다.
     */
    function initializeLayouts() {
        if (!variants['2-KSX5002']) {
            var info = find_layout_info('Ko', '2-KSX5002');
            if (info) {
                var enabled = info.layout.slice();
                enabled['I'.charCodeAt(0) - 33] = 0x11BB; // ㅆ
                enabled['J'.charCodeAt(0) - 33] = 0x11AD; // ㄶ
                enabled['K'.charCodeAt(0) - 33] = 0x11B9; // ㅄ
                enabled['L'.charCodeAt(0) - 33] = 0x11B0; // ㄺ
                variants['2-KSX5002'] = { info: info, disabled: info.layout, enabled: enabled };
            }
        }
        if (!variants['2-Dujule']) {
            var info = find_layout_info('Ko', '2-Dujule');
            if (info) {
                // 기본 두줄이 배열에는 겹받침 윗글쇠가 없고 표준 두벌식과 마찬가지로 복사본에만 겹받침을 더합니다.
                var enabled = info.layout.slice();
                enabled['I'.charCodeAt(0) - 33] = 0x11B9; // ㅄ
                enabled['J'.charCodeAt(0) - 33] = 0x11AD; // ㄶ
                enabled['K'.charCodeAt(0) - 33] = 0x11B0; // ㄺ
                enabled['L'.charCodeAt(0) - 33] = 0x11A9; // ㄲ
                variants['2-Dujule'] = { info: info, disabled: info.layout, enabled: enabled };
            }
        }
    }
    /**
     * 현재 기능 상태에 맞는 배열을 OHI의 자판 정보에 연결합니다.
     *
     * info.layout 자체가 켜짐 또는 꺼짐 배열을 가리키게 합니다.
     *
     * 이 함수는 배열 내용을 고치지 않습니다. 자판을 바꾸거나 옵션 창을
     * 다시 그릴 때 여러 번 실행되어도 미리 만들어 둔 배열을 재사용합니다.
     */
    function syncLayout() {
        initializeLayouts();
        for (var _i = 0, _a = ['2-KSX5002', '2-Dujule']; _i < _a.length; _i++) {
            var type = _a[_i];
            var entry = variants[type];
            if (!entry)
                continue;
            entry.info.layout = isEnabled() && supportedType() === type ? entry.enabled : entry.disabled;
        }
    }
    /**
     * 겹받침을 이루는 두 닿소리를 OHI의 기존 받침 조합 규칙에서 찾습니다.
     *
     * ohiDoubleJamo(2, 첫째, 둘째)는 받침 결합에 필요한 값을 돌려줍니다.
     * 첫째 + 그 값이 목표 받침과 같으면 두 닿소리를 찾은 것입니다.
     * 예: ㄶ에 대응하는 ㄴ·ㅎ의 내부 코드.
     *
     * 찾은 결과는 아래 보관함에 저장하여 같은 받침을 다시 입력할 때
     * 조합 규칙을 반복해서 훑지 않습니다. 분해할 수 없으면 null을 저장합니다.
     * ㄲ·ㅆ처럼 같은 닿소리가 겹친 경우는 한 번에 지우도록 분해하지 않습니다.
     */
    var finalPartsCache = {};
    function findFinalParts(finalCode) {
        if (Object.prototype.hasOwnProperty.call(finalPartsCache, finalCode)) {
            return finalPartsCache[finalCode];
        }
        for (var _i = 0, ohi_ggeut_1 = ohi_ggeut; _i < ohi_ggeut_1.length; _i++) {
            var first = ohi_ggeut_1[_i];
            for (var _a = 0, ohi_ggeut_2 = ohi_ggeut; _a < ohi_ggeut_2.length; _a++) {
                var second = ohi_ggeut_2[_a];
                if (first === second)
                    continue; // ㄲ·ㅆ 등 된소리는 한 번에 지웁니다.
                var delta = ohiDoubleJamo(2, first, second);
                if (delta > 0 && first + delta === finalCode) {
                    return finalPartsCache[finalCode] = [first, second];
                }
            }
        }
        return finalPartsCache[finalCode] = null;
    }
    // 체크 상태는 자판마다 따로 기억합니다. 체크 상태가 참이더라도
    // 옛한글이나 순아래 입력 중에는 isEnabled()가 거짓을 돌려줄 수 있습니다.
    var extendedEnabled = {
        '2-KSX5002': false,
        '2-Dujule': false
    };
    /** 현재 한글 자판이 두겹이 또는 두줄이 대상인지 확인합니다. 그 밖의 자판은 건드리지 않습니다. */
    function supportedType() {
        if (ohi_KE !== 'Ko')
            return null;
        if (Ko_type === '2-KSX5002' || Ko_type === '2-Dujule')
            return Ko_type;
        return null;
    }
    /** 기존 OHI의 옛한글·첫가끝 강제 입력·풀어쓰기에서는 이 확장을 쓰지 않습니다. */
    function optionAvailable() {
        return !is_old_hangeul_input() && !option.only_NFD_hangeul_encoding &&
            !is_phonemic_writing_input();
    }
    /**
     * 실제로 겹받침 확장을 적용할 수 있는지 판단합니다.
     * 체크박스 값만 보지 않고 현재 자판, 입력 방식, 순아래 사용 여부도 확인합니다.
     */
    function isEnabled() {
        var type = supportedType();
        return !!type && optionAvailable() && !!extendedEnabled[type] && !option.sunalae;
    }
    OHIExtension.isEnabled = isEnabled;
    /**
     * 사용자가 겹받침 확장 체크박스를 바꿀 때 실행합니다.
     * 조합 중인 글자를 먼저 마무리하여 배열 전환 전후의 입력이 섞이지 않게 합니다.
     * 겹받침을 켜면 기존 '홀소리 되풀이 순아래 조합'은 끄고, 자판 배열과 화상 자판을 갱신합니다.
     */
    function setEnabled(enabled) {
        var type = supportedType();
        if (!type)
            return;
        complete_hangeul_syllable();
        extendedEnabled[type] = enabled;
        if (enabled) {
            option.sunalae = 0;
            var cb = document.querySelector('input[name="sunalae"]');
            if (cb)
                cb.checked = false;
        }
        syncLayout();
        show_keyboard_layout();
        inputText_focus();
    }
    OHIExtension.setEnabled = setEnabled;
    /**
     * 기존 OHI의 '홀소리 되풀이 순아래 조합'을 켤 때 호출됩니다.
     * 순아래와 겹받침 확장은 함께 사용하지 않도록 겹받침의 체크 상태도 끕니다.
     * 순아래를 다시 꺼도 겹받침 확장이 저절로 켜지지는 않습니다.
     */
    function onSunalaeToggle() {
        if (option.sunalae) {
            var type = supportedType();
            if (type)
                extendedEnabled[type] = false;
            complete_hangeul_syllable();
            syncLayout();
        }
    }
    OHIExtension.onSunalaeToggle = onSunalaeToggle;
    /**
     * OHI 옵션 영역에 겹받침 확장 체크박스를 표시합니다.
     *
     * show_options()가 여러 번 호출되므로 체크박스는 처음에만 만들고,
     * 이후에는 현재 자판에 맞춰 표시 여부·체크 상태·설명 글을 갱신합니다.
     * 여기서 syncLayout()도 호출하므로 자판을 바꾼 뒤 옵션을 다시 그릴 때
     * 실제 입력 배열도 현재 상태와 일치하게 됩니다.
     */
    function renderOptions(opts) {
        syncLayout();
        var type = supportedType();
        var id = 'option_ohi_dugyeob_extension';
        var wrap = document.getElementById(id);
        if (!wrap) {
            // OHI의 add_option()과 같이 고정된 HTML 문자열로 옵션을 만듭니다.
            // 입력받은 값을 HTML에 끼워 넣지 않으며, 변경 이벤트는 처음 한 번만 연결합니다.
            opts.insertAdjacentHTML('beforeend', "\n                <div class=\"option\" id=\"option_ohi_dugyeob_extension\">\n                    <input name=\"ohi_dugyeob_extension\" class=\"checkbox\" type=\"checkbox\" id=\"ohi_dugyeob_checkbox\">\n                    <label for=\"ohi_dugyeob_checkbox\" id=\"ohi_dugyeob_label\"></label>\n                </div>\n            ");
            wrap = document.getElementById(id);
            var input_1 = document.getElementById('ohi_dugyeob_checkbox');
            input_1.addEventListener('change', function () { return setEnabled(input_1.checked); });
        }
        wrap.style.display = type && optionAvailable() ? 'block' : 'none';
        var cb = document.getElementById('ohi_dugyeob_checkbox');
        var label = document.getElementById('ohi_dugyeob_label');
        cb.checked = !!type && !!extendedEnabled[type];
        label.textContent = type === '2-Dujule' ? '겹받침 확장' : '두겹이 확장';
    }
    OHIExtension.renderOptions = renderOptions;
    /**
     * 겹받침 갈마들이가 필요한 입력만 먼저 처리합니다.
     *
     * ohiHangeul2()에서 이 함수를 먼저 호출합니다.
     * - true: 확장에서 입력을 끝냈으므로 OHI의 일반 두벌식 처리를 건너뜁니다.
     * - false: 처리하지 않았으므로 OHI가 평소대로 글쇠를 처리합니다.
     *
     * 아랫글쇠가 홀소리이고 윗글쇠가 끝소리인 자리만 대상입니다.
     * 첫소리·가운뎃소리가 있고 끝소리가 비어 있으면 아랫글쇠도 끝소리로 갈마들 수 있습니다.
     * 다만 기존 홀소리와 결합하여 겹홀소리를 만들 수 있으면 홀소리를 우선합니다.
     * 시프트를 누른 윗글쇠는 받침을 직접 선택한 것으로 처리합니다.
     */
    function tryDoubleFinal(f, _e, key) {
        // 확장이 꺼졌거나 첫가끝 자모를 따로 쌓는 중이면 기존 OHI에 맡깁니다.
        if (!isEnabled() || NFD_stack.phoneme.length)
            return false;
        if (!((key >= 65 && key <= 90) || (key >= 97 && key <= 122)))
            return false;
        var type = supportedType();
        if (!type)
            return false;
        // 눌린 영문 글쇠의 대·소문자 짝을 구한 뒤 현재 배열에서 값을 읽습니다.
        // 별도의 겹받침 글쇠 대응표를 만들지 않기 위한 부분입니다.
        var lowerKey = key >= 97 ? key : key + 32;
        var upperKey = lowerKey - 32;
        var layout = find_current_layout();
        var lower = layout[lowerKey - 33];
        var upper = layout[upperKey - 33];
        if (unicode_modern_ga.indexOf(lower) < 0 || unicode_modern_ggeut.indexOf(upper) < 0)
            return false;
        // ohiQ는 OHI가 조합 중인 음절을 기억하는 배열입니다.
        // 0번: 첫소리, 3~5번: 가운뎃소리, 6~8번: 끝소리.
        // 첫소리·가운뎃소리가 있고 끝소리가 비어 있어야 새 받침을 넣을 수 있습니다.
        var hasEmptyFinal = ohiQ[0] > 0 && ohiQ[3] > 0 && !(ohiQ[6] || ohiQ[7] || ohiQ[8]);
        if (!hasEmptyFinal) {
            // 홀로 입력한 윗글쇠 받침은 음절에 붙일 수 없으므로 호환 자모로 넣습니다.
            if (key !== upperKey)
                return false;
            complete_hangeul_syllable(f);
            var compatIndex = unicode_modern_ggeut.indexOf(upper);
            ohiInsert(f, 0, compatibility_ggeut[compatIndex]);
            return true;
        }
        // 시프트를 누르지 않았고 가운뎃소리가 아직 덧붙여지지 않은 상태라면,
        // 먼저 홀소리끼리 결합할 수 있는지 확인합니다. 가능하면 OHI 기본 처리에 맡깁니다.
        if (key === lowerKey && !ohiQ[4] && !ohiQ[5]) {
            var vowel = ohi_ga[unicode_modern_ga.indexOf(lower)] - 35;
            // 겹홀소리를 만들 수 있으면 OHI의 기존 홀소리 조합을 먼저 적용합니다.
            if (ohiDoubleJamo(1, ohiQ[3], vowel))
                return false;
            // 두줄이의 ㅣ+ㅡ → ㅢ는 OHI의 기본 조합과 반대 순서입니다.
            if (type === '2-Dujule' && ohiQ[3] === ohi_ga[ohi_ga.length - 1] - 35 &&
                lower === 0x1173) {
                ohiQ[4] = -1;
                ohiInsert(f, 0, ohiQ);
                return true;
            }
        }
        // 윗글쇠의 유니코드 받침을 OHI 내부 코드로 바꿉니다.
        // 겹받침은 내부 조합 상태에 구성 닿소리 둘을 남겨 두어야
        // 지우기나 뒤따르는 홀소리 입력을 OHI가 처리할 수 있습니다.
        var finalCode = ohi_ggeut[unicode_modern_ggeut.indexOf(upper)];
        var parts = findFinalParts(finalCode);
        ohiQ[6] = parts ? parts[0] : finalCode;
        ohiQ[7] = parts ? parts[1] : 0;
        // 화면에 넣을 조합값은 따로 복사합니다. ohiQ에는 구성 닿소리의
        // 내부 상태를 남기고, 화면용 배열에는 결합된 받침에 해당하는 값을 넣습니다.
        var display = ohiQ.slice();
        if (parts)
            display[7] = finalCode - parts[0];
        ohiInsert(f, 0, display);
        // OHI가 다음 글쇠를 처리할 때 앞선 조합 상태를 참고할 수 있도록 보존합니다.
        prev_ohiQ = ohiQ.slice();
        prev_ohiRQ = ohiRQ.slice();
        return true;
    }
    OHIExtension.tryDoubleFinal = tryDoubleFinal;
})(OHIExtension || (OHIExtension = {}));
