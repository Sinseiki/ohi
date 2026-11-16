/**
 * OHI 추가 기능 - 1단계 만들기
 *
 * 표준 두벌식의 두겹이 기능과 두줄이의 겹받침 갈마들이를 쓸 수 있게 합니다.
 * 자판 배열을 읽는 OHI의 여러 함수가 같은 값을 읽도록, 자판 정보의
 * layout 속성이 가리키는 배열을 기능을 켜고 끔에 따라 바꿉니다.
 *
 * ohi.js에서는 tryDoubleFinal(), onSunalaeToggle(), renderOptions()만
 * 정해진 곳에서 부릅니다. OHI의 기존 함수를 덮어쓰지는 않습니다.
 *
 * 아직 만들지 않은 기능: 부분 모아치기, 세모이 약어.
 * 대체 시프트는 한글 조합 중에 앞에 친 글자를 윗글쇠로 바꾸며, 기존 Shift의 동작을 바꾸지 않습니다.
 * 쓰이는 범위: 요즘 한글 모아쓰기. 옛한글·첫가끝 따로 입력·풀어쓰기는
 * 기존 OHI의 입력 방법을 그대로 따릅니다.
 */
var OHIExtension;
(function (OHIExtension) {
    const variants = {};
    /**
     * 두 자판의 켜짐·꺼짐 배열을 맨 처음 한 번 마련합니다.
     * variants에 이미 저장된 자판은 거듭 만들지 않습니다.
     * find_layout_info()가 아직 자판을 찾지 못했다면 다음에 부를 때 다시 찾아봅니다.
     *
     * OHI 배열은 ASCII 33번(!)부터 시작하므로, 글쇠의 글자 코드에서 33을 뺀
     * 값을 배열의 자리값로 씁니다. 대문자 I/J/K/L은 시프트 윗글쇠입니다.
     */
    function initializeLayouts() {
        if (!variants['2-KSX5002']) {
            const info = find_layout_info('Ko', '2-KSX5002');
            if (info) {
                const enabled = info.layout.slice();
                enabled['I'.charCodeAt(0) - 33] = 0x11BB; // ㅆ
                enabled['J'.charCodeAt(0) - 33] = 0x11AD; // ㄶ
                enabled['K'.charCodeAt(0) - 33] = 0x11B9; // ㅄ
                enabled['L'.charCodeAt(0) - 33] = 0x11B0; // ㄺ
                variants['2-KSX5002'] = { info, disabled: info.layout, enabled };
            }
        }
        if (!variants['2-Dujule']) {
            const info = find_layout_info('Ko', '2-Dujule');
            if (info) {
                // 기본 두줄이 배열에는 겹받침 윗글쇠가 없고 표준 두벌식과 마찬가지로 복사본에만 겹받침을 더합니다.
                const enabled = info.layout.slice();
                enabled['I'.charCodeAt(0) - 33] = 0x11B9; // ㅄ
                enabled['J'.charCodeAt(0) - 33] = 0x11AD; // ㄶ
                enabled['K'.charCodeAt(0) - 33] = 0x11B0; // ㄺ
                enabled['L'.charCodeAt(0) - 33] = 0x11A9; // ㄲ
                variants['2-Dujule'] = { info, disabled: info.layout, enabled };
            }
        }
    }
    /**
     * 지금 기능을 켜고 끈 상태에 맞는 배열을 OHI의 자판 정보에 이어 줍니다.
     *
     * info.layout 자체가 켜짐 또는 꺼짐 배열을 가리키게 합니다.
     *
     * 이 함수는 배열 안의 값은 고치지 않습니다. 자판을 바꾸거나 설정 창을
     * 다시 그릴 때 여러 번 돌아가도 미리 만들어 둔 배열을 다시 씁니다.
     */
    function syncLayout() {
        initializeLayouts();
        for (const type of ['2-KSX5002', '2-Dujule']) {
            const entry = variants[type];
            if (!entry)
                continue;
            entry.info.layout = isEnabled() && supportedType() === type ? entry.enabled : entry.disabled;
        }
    }
    /**
     * 겹받침을 이루는 두 닿소리를 OHI의 기존 받침 어울림 규칙에서 찾습니다.
     *
     * ohiDoubleJamo(2, 첫째, 둘째)는 받침 결합에 필요한 값을 돌려줍니다.
     * 첫째 + 그 값이 만들려는 받침과 같으면 두 닿소리를 찾은 것입니다.
     * 예: ㄶ에 짝이 되는 ㄴ·ㅎ의 내부 코드.
     *
     * 찾은 값은 아래 저장소에 저장하여 같은 받침을 다시 입력할 때
     * 어울림 규칙을 되풀이하여 훑지 않습니다. 나눌 수 없으면 null을 저장합니다.
     * ㄲ·ㅆ처럼 같은 닿소리가 겹친 경우는 한 번에 지우도록 나누지 않습니다.
     */
    const finalPartsCache = {};
    function findFinalParts(finalCode) {
        if (Object.prototype.hasOwnProperty.call(finalPartsCache, finalCode)) {
            return finalPartsCache[finalCode];
        }
        for (const first of ohi_ggeut) {
            for (const second of ohi_ggeut) {
                if (first === second)
                    continue; // ㄲ·ㅆ 등 된소리는 한 번에 지웁니다.
                const delta = ohiDoubleJamo(2, first, second);
                if (delta > 0 && first + delta === finalCode) {
                    return finalPartsCache[finalCode] = [first, second];
                }
            }
        }
        return finalPartsCache[finalCode] = null;
    }
    // 체크 표시는 자판마다 따로 기억합니다. 체크 표시가 참이더라도
    // 옛한글이나 순아래 입력 중에는 isEnabled()가 거짓을 돌려줄 수 있습니다.
    const extendedEnabled = {
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
     * 겹받침 덧붙이기를 쓸 수 있는지 판단합니다.
     * 체크 표시만 보지 않고 현재 자판, 입력 방법, 홀소리 되풀이 순아래를 쓰는지 여부도 살펴봅니다.
     */
    function isEnabled() {
        const type = supportedType();
        return !!type && optionAvailable() && !!extendedEnabled[type] && !option.sunalae;
    }
    OHIExtension.isEnabled = isEnabled;
    /**
     * 사용자가 겹받침 덧붙이기 체크 표시를 바꿀 때 실행합니다.
     * 조합 중인 글자를 먼저 마무리하여 배열을 바꾸기 전후의 입력이 섞이지 않게 합니다.
     * 겹받침을 켜면 기존 '홀소리 되풀이 순아래 조합'은 끄고, 자판 배열과 화상 자판을 새로 그립니다.
     */
    function setEnabled(enabled) {
        const type = supportedType();
        if (!type)
            return;
        complete_hangeul_syllable();
        extendedEnabled[type] = enabled;
        if (enabled) {
            option.sunalae = 0;
            const cb = document.querySelector('input[name="sunalae"]');
            if (cb)
                cb.checked = false;
        }
        syncLayout();
        show_options();
        show_keyboard_layout();
        show_keyboard_layout_info();
        inputText_focus();
    }
    OHIExtension.setEnabled = setEnabled;
    /**
     * 기존 OHI의 '홀소리 되풀이 순아래 조합'을 켤 때 호출됩니다.
     * 순아래와 확장 기능은 함께 쓰지 않도록 확장 기능의 체크 표시도 끕니다.
     * 순아래를 다시 꺼도 확장 기능이 스스로 다시 켜지지는 않습니다.
     */
    function onSunalaeToggle() {
        if (option.sunalae) {
            const type = supportedType();
            if (type)
                extendedEnabled[type] = false;
            complete_hangeul_syllable();
            syncLayout();
        }
    }
    OHIExtension.onSunalaeToggle = onSunalaeToggle;
    /**
     * OHI 설정 자리에 겹받침 확장 체크박스를 표시합니다.
     *
     * show_options()가 여러 번 호출되므로 체크박스는 처음에만 만들고,
     * 이후에는 현재 자판에 맞춰 보일지 여부·체크 표시·풀이 글을 새로 그립니다.
     * 여기서 syncLayout()도 호출하므로 자판을 바꾼 뒤 옵션을 다시 그릴 때
     * 실제 글쇠 배열도 현재 상태와 일치하게 됩니다.
     */
    function renderOptions(opts) {
        syncLayout();
        const type = supportedType();
        const id = 'option_ohi_dugyeob_extension';
        let wrap = document.getElementById(id);
        if (!wrap) {
            // OHI의 add_option()과 같이 미리 정한 HTML 글줄로 옵션을 만듭니다.
            // 입력받은 값을 HTML에 끼워 넣지 않으며, 체크 상태가 바뀌었을 때 실행할 함수는 처음 한 번만 연결합니다.
            opts.insertAdjacentHTML('beforeend', `
                <div class="option" id="option_ohi_dugyeob_extension">
                    <input name="ohi_dugyeob_extension" class="checkbox" type="checkbox" id="ohi_dugyeob_checkbox">
                    <label id="ohi_dugyeob_label"></label>
                </div>
            `);
            wrap = document.getElementById(id);
            const input = document.getElementById('ohi_dugyeob_checkbox');
            input.addEventListener('change', () => setEnabled(input.checked));
        }
        wrap.style.display = type && optionAvailable() ? 'block' : 'none';
        const cb = document.getElementById('ohi_dugyeob_checkbox');
        const label = document.getElementById('ohi_dugyeob_label');
        cb.checked = !!type && !!extendedEnabled[type];
        if (type === '2-Dujule') {
            label.title = '두줄이 자판으로 빗금 글쇠를 다음에 눌러 겹닿소리(된소리) 넣고 홀소리에 갈마들이 기능을 넣기';
            label.innerHTML = '부가기능 순아래 <a href="https://blog.naver.com/eekdland/224288483666" target="_blank" rel="noopener noreferrer">ⓘ</a>';
        }
        else {
            label.title = '두겹이 자판으로 쌍반점 글쇠를 다음에 눌러 겹닿소리(된소리) 넣기';
            label.innerHTML = '두겹이 순아래 <a href="https://blog.naver.com/eekdland/224142632310" target="_blank" rel="noopener noreferrer">ⓘ</a>';
        }
    }
    OHIExtension.renderOptions = renderOptions;
    /** OHI 본체에서 부르는 유일한 글쇠 확장 진입점입니다. */
    function tryExtendedInput(f, e, key) {
        return tryAlternateShift(f, e, key) || tryDoubleFinal(f, e, key);
    }
    OHIExtension.tryExtendedInput = tryExtendedInput;
    /**
     * 날개셋 대체 시프트: 두겹이는 ;, 두줄이는 / 글쇠로 바로 앞 낱자를 바꿉니다.
     * 다음 글쇠에 쓰이는 Shift 잠금이 아니라 현재 ohiQ의 낱자를 수정합니다.
     * 확장 상태 외에는 끼어들지 않으며, 변환할 낱자가 없으면 원래 부호로 입력합니다.
     *
     * 된소리 첫소리: ㄱ/ㄷ/ㅂ/ㅈ(+두겹이 ㅅ) → ㄲ/ㄸ/ㅃ/ㅉ(+ㅆ)
     * 홀소리: ㅐ/ㅔ → ㅒ/ㅖ
     * 끝소리: ㄱ/ㅅ → ㄲ/ㅆ (ㅅ은 두겹이에서만 가능)
     * ㄷ/ㅂ/ㅈ은 된소리 끝소리가 없으므로 앞 음절을 마무리하고
     * 새 된소리 첫소리로 시작합니다.
     *
     * 숫자는 OHI 내부 낱자 코드이며 자판 종류에 따른 글쇠 배치는 살펴보지 않습니다.
     */
    function tryAlternateShift(f, e, key) {
        if (!isEnabled() || NFD_stack.phoneme.length || (e && e.shiftKey))
            return false;
        const type = supportedType();
        if (key !== (type === '2-KSX5002' ? 59 : 47))
            return false;
        // 첫소리·가운뎃소리·끝소리가 함께 있을 때에는 맨 끝의 끝소리부터 살펴봅니다.
        // 겹받침과 이미 바뀐 된소리 받침에는 다시 바꾸지 않습니다.
        if (ohiQ[6] && !ohiQ[7] && !ohiQ[8]) {
            const final = ohiQ[6];
            if (final === 1 || (type === '2-KSX5002' && final === 21)) {
                // ㄲ·ㅆ 받침을 두 칸에 나누어 저장하면 다음 홀소리를 칠 때
                // ㄱ·ㅅ만 첫소리로 옮겨가므로, 받침 한 칸에 온전히 저장합니다 (ㄲ=2, ㅆ=22).
                ohiQ[6] = final + 1;
                ohiInsert(f, 0, ohiQ);
                return true;
            }
            if (final === 7 || final === 18 || final === 24) {
                // ㄸ/ㅃ/ㅉ은 요즘 한글 끝소리가 될 수 없으므로 새 첫소리를 시작합니다.
                ohiQ[6] = 0;
                ohiInsert(f, 0, ohiQ);
                complete_hangeul_syllable(f);
                ohiQ = [final + 1, 0, 0, 0, 0, 0, 0, 0, 0];
                ohiInsert(f, 0, ohiQ);
                return true;
            }
            return false;
        }
        if (ohiQ[6])
            return false;
        // 홀로 친 홀소리와 첫소리+홀소리를 같은 방법으로 다룹니다.
        if (ohiQ[3] && !ohiQ[4] && !ohiQ[5] && (ohiQ[3] === 32 || ohiQ[3] === 36)) {
            ohiQ[4] = 2; // ㅐ→ㅒ, ㅔ→ㅖ (현재 홀소리에 차이 2 추가)
            ohiInsert(f, 0, ohiQ);
            return true;
        }
        if (ohiQ[0] && !ohiQ[1] && !ohiQ[2] && !ohiQ[3]) {
            const initial = ohiQ[0];
            if (initial === 1 || initial === 7 || initial === 18 || initial === 24 ||
                (type === '2-KSX5002' && initial === 21)) {
                ohiQ[1] = 1; // OHI에서는 된소리 첫소리를 바탕 첫소리+1로 조합합니다.
                ohiInsert(f, 0, ohiQ);
                return true;
            }
        }
        return false;
    }
    /**
     * 겹받침 갈마들이가 필요한 글쇠 입력을 다룹니다.
     *
     * ohiHangeul2()에서 tryExtendedInput()을 거쳐 이 함수를 부릅니다.
     * - true: 이 함수에서 입력을 마쳤으므로 OHI의 보통 두벌식 처리를 건너뜁니다.
     * - false: 이 함수에서 처리하지 않았으므로 다른 확장 처리 결과에 따라 OHI가 이어서 처리합니다.
     *
     * 아랫글쇠가 홀소리이고 윗글쇠가 끝소리인 자리만 해당합니다.
     * 첫소리·가운뎃소리가 있고 끝소리가 비어 있으면 아랫글쇠도 끝소리로 갈마들 수 있습니다.
     * 다만 기존 홀소리와 어울려 겹홀소리를 만들 수 있으면 홀소리를 먼저 씁니다.
     * 시프트를 누른 윗글쇠는 받침을 바로 고른 것으로 처리합니다.
     */
    function tryDoubleFinal(f, _e, key) {
        // 확장이 꺼졌거나 첫가끝 자모를 따로 쌓는 중이면 기존 OHI에 맡깁니다.
        if (!isEnabled() || NFD_stack.phoneme.length)
            return false;
        if (!((65 <= key && key <= 90) || (97 <= key && key <= 122)))
            return false;
        const type = supportedType();
        if (!type)
            return false;
        // 눌린 영문 글쇠의 대·소문자 짝을 구한 뒤 지금 배열에서 값을 읽습니다.
        // 겹받침 글쇠 짝표를 만들지 않기 위한 부분입니다.
        const lowerKey = key >= 97 ? key : key + 32;
        const upperKey = lowerKey - 32;
        const layout = find_current_layout();
        const lower = layout[lowerKey - 33];
        const upper = layout[upperKey - 33];
        if (unicode_modern_ga.indexOf(lower) < 0 || unicode_modern_ggeut.indexOf(upper) < 0)
            return false;
        // ohiQ는 OHI가 조합 중인 음절을 기억하는 배열로서(0번: 첫소리, 3~5번: 가운뎃소리, 6~8번: 끝소리),
        // 첫소리·가운뎃소리가 있고 끝소리가 비어 있는 조건이어야 새 받침을 넣을 수 있습니다.
        const hasEmptyFinal = ohiQ[0] > 0 && ohiQ[3] > 0 && !(ohiQ[6] || ohiQ[7] || ohiQ[8]);
        if (!hasEmptyFinal) {
            // 홀로 입력한 윗글쇠 받침은 음절에 붙일 수 없으므로 호환 낱자로 넣습니다.
            if (key !== upperKey)
                return false;
            complete_hangeul_syllable(f);
            const compatIndex = unicode_modern_ggeut.indexOf(upper);
            ohiInsert(f, 0, compatibility_ggeut[compatIndex]);
            return true;
        }
        // 시프트를 누르지 않았고 가운뎃소리가 아직 덧붙여지지 않은 상태라면,
        // 먼저 홀소리끼리 어울릴 수 있는지 살펴봅니다. 가능하면 OHI 기본 처리에 맡깁니다.
        if (key === lowerKey && !ohiQ[4] && !ohiQ[5]) {
            const vowel = ohi_ga[unicode_modern_ga.indexOf(lower)] - 35;
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
        // 겹받침은 내부 조합 상태에 이루는 닿소리 둘을 남겨 두어야
        // 지우기나 뒤따르는 홀소리 입력을 OHI가 처리할 수 있습니다.
        const finalCode = ohi_ggeut[unicode_modern_ggeut.indexOf(upper)];
        const parts = findFinalParts(finalCode);
        ohiQ[6] = parts ? parts[0] : finalCode;
        ohiQ[7] = parts ? parts[1] : 0;
        // 겹받침을 나중에 나누어 처리할 수 있도록 조합 상태를 남겨 두고,
        // 화면에는 완성된 겹받침을 표시합니다.
        const display = ohiQ.slice();
        if (parts)
            display[7] = finalCode - parts[0];
        ohiInsert(f, 0, display);
        // OHI가 다음 글쇠를 처리할 때 앞선 조합 상태를 살펴볼 수 있도록 남겨 둡니다.
        prev_ohiQ = ohiQ.slice();
        prev_ohiRQ = ohiRQ.slice();
        return true;
    }
    OHIExtension.tryDoubleFinal = tryDoubleFinal;
    // 대체 시프트 글쇠를 두겹이와 두줄이 순아래에서 화상 자판에 나타냅니다.
    function renderAlternateShiftKey() {
        if (!isEnabled() || ohi_KE !== 'Ko')
            return;
        const id = supportedType() === '2-Dujule' ? 'dh51' : 'dh38';
        const key = document.getElementById(id);
        if (key)
            key.innerHTML = '<span style="background:black;color:#fff;font-size:1em;">⇧</span>';
    }
    OHIExtension.renderAlternateShiftKey = renderAlternateShiftKey;
})(OHIExtension || (OHIExtension = {}));
