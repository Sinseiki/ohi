/**
 * OHI 추가 기능 - 1단계 만들기
 *
 * 표준 두벌식의 두겹이 기능과 두줄이의 겹받침 갈마들이를 쓸 수 있게 합니다.
 * 자판 배열을 읽는 OHI의 여러 함수가 같은 결과를 얻도록,
 * 자판 정보의 layout 속성이 가리키는 배열을 기능의 켜짐·꺼짐에 따라 바꿉니다.
 *
 * ohi.js에서는 일반 두벌식 입력과 글쇠 이벤트를 연결하는 진입점만 정해진 곳에서 부릅니다.
 * OHI의 기존 함수를 덮어쓰지는 않습니다.
 *
 * 나눠치기는 OHI의 눌림·해제 상태를 재사용해 별도의 입력 순서 정정으로 처리합니다.
 * 대체 시프트는 한글 조합 중에 앞에 친 글자를 윗글쇠로 바꾸며, 기존 Shift의 동작을 바꾸지 않습니다.
 * 쓰이는 범위: 요즘 한글 모아쓰기.
 * 옛한글·첫가끝 강제 입력·풀어쓰기는 기존 OHI의 처리 방식을 그대로 사용합니다.
 */
var OHIExtension;
(function (OHIExtension) {
    const variants = {};
    /**
     * 두 자판의 켜짐·꺼짐 배열을 맨 처음 한 번 마련합니다.
     * variants에 이미 저장된 자판은 거듭 만들지 않습니다.
     * find_layout_info()가 아직 자판을 찾지 못했다면 다음에 부를 때 다시 찾아봅니다.
     *
     * OHI 배열은 ASCII 33번(!)부터 시작하므로, 글쇠의 문자 코드에서 33을 뺀 값을 배열의 자리 번호로 씁니다.
     * 대문자 I/J/K/L은 시프트 윗글쇠입니다.
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
     * 현재 기능 상태에 맞는 배열을 OHI의 자판 정보에 이어 줍니다.
     *
     * info.layout 자체가 켜짐 또는 꺼짐 배열을 가리키게 합니다.
     *
     * 이 함수는 배열 안의 값은 고치지 않습니다.
     * 자판을 바꾸거나 옵션 창을 다시 그릴 때 여러 번 실행되어도 미리 만들어 둔 배열을 다시 씁니다.
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
     * 겹받침을 이루는 두 닿소리를 OHI의 기존 받침 조합 규칙에서 찾습니다.
     *
     * ohiDoubleJamo(2, 첫째, 둘째)는 받침 결합에 필요한 값을 돌려줍니다.
     * 첫째 + 그 값이 만들려는 받침과 같으면 두 닿소리를 찾은 것입니다.
     * 예: ㄶ에 짝이 되는 ㄴ·ㅎ의 내부 코드.
     *
     * 찾은 결과는 아래 보관함에 저장하여 같은 받침을 다시 입력할 때 조합 규칙을 반복해서 훑지 않습니다.
     * 나늘 수 없으면 null을 저장합니다.
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
    // 체크 상태는 자판마다 따로 기억합니다. 체크 상태가 참이더라도
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
     * 실제로 부가기능 확장을 쓸 수 있는지 판단합니다.
     * 체크박스 값만 보지 않고 현재 자판, 입력 방식, 홀소리 거듭 순아래를 쓰는지 여부도 살펴봅니다.
     */
    function isEnabled() {
        const type = supportedType();
        return !!type && optionAvailable() && !!extendedEnabled[type] && !option.sunalae;
    }
    OHIExtension.isEnabled = isEnabled;
    /**
     * 사용자가 부가기능 확장 체크박스를 바꿀 때 실행합니다.
     * 조합 중인 글자를 먼저 마무리하여 배열을 바꾸기 전후의 입력이 섞이지 않게 합니다.
     * 부가기능 확장을 켜면 기존 '홀소리 거듭 순아래 조합'은 끄고, 자판 배열과 화상 자판을 새로 그립니다.
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
     * 기존 OHI의 '홀소리 거듭 순아래 조합'을 켤 때 호출됩니다.
     * 홀소리 거듭 순아래와 부가기능 확장은 함께 사용하지 않도록 부가기능 확장의 체크 상태도 끕니다.
     * 홀소리 거듭 순아래를 다시 꺼도 부가기능 확장이 저절로 켜지지는 않습니다.
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
        renderPartialOptions(opts);
    }
    OHIExtension.renderOptions = renderOptions;
    /** OHI 본체에서 부르는 유일한 글쇠 확장 진입점입니다. */
    function tryExtendedInput(f, e, key) {
        return tryAlternateShift(f, e, key) || tryDoubleFinal(f, e, key);
    }
    OHIExtension.tryExtendedInput = tryExtendedInput;
    /**
     * 날개셋 대체 시프트: 두겹이는 ;, 두줄이는 / 글쇠로 바로 앞 낱자를 바꿉니다.
     * 다음 글쇠에 쓰이는 Shift 잠금이 아니라 현재 ohiQ의 낱자를 바꿉니다.
     * 확장 상태 외에는 끼어들지 않으며, 변환할 낱자가 없으면 원래 부호로 입력합니다.
     *
     * 된소리 첫소리: ㄱ/ㄷ/ㅂ/ㅈ(+두겹이 ㅅ) → ㄲ/ㄸ/ㅃ/ㅉ(+ㅆ)
     * 홀소리: ㅐ/ㅔ → ㅒ/ㅖ
     * 끝소리: ㄱ/ㅅ → ㄲ/ㅆ (ㅅ은 두겹이에서만 가능)
     * ㄷ/ㅂ/ㅈ은 된소리 끝소리가 없으므로 기존 음절을 마무리하고
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
        // 첫소리·가운뎃소리·끝소리가 함께 있을 때에는 마지막 끝소리부터 판정합니다.
        // 겹받침과 이미 바뀐 된소리 받침에는 다시 적용하지 않습니다.
        if (ohiQ[6] && !ohiQ[7] && !ohiQ[8]) {
            const final = ohiQ[6];
            if (final === 1 || (type === '2-KSX5002' && final === 21)) {
                // ㄲ·ㅆ 받침은 다음 홀소리를 누를 때 첫소리로 온전히 이동해야 하므로
                // OHI 내부 코드 하나로 보존합니다 (ㄲ=2, ㅆ=22).
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
            ohiQ[4] = 2; // ㅐ→ㅒ, ㅔ→ㅖ (현재 홀소리에 차이값 2 추가)
            ohiInsert(f, 0, ohiQ);
            return true;
        }
        if (ohiQ[0] && !ohiQ[1] && !ohiQ[2] && !ohiQ[3]) {
            const initial = ohiQ[0];
            if (initial === 1 || initial === 7 || initial === 18 || initial === 24 ||
                (type === '2-KSX5002' && initial === 21)) {
                ohiQ[1] = 1; // OHI에서는 된소리 첫소리를 기본 첫소리+1로 조합합니다.
                ohiInsert(f, 0, ohiQ);
                return true;
            }
        }
        return false;
    }
    /**
     * 겹받침 갈마들이가 필요한 입력만 먼저 다룹니다.
     *
     * ohiHangeul2()에서 tryExtendedInput()을 거쳐 이 함수를 먼저 부릅니다.
     * - true: 확장에서 입력을 끝냈으므로 OHI의 일반 두벌식 처리를 건너뜁니다.
     * - false: 확장에서 처리하지 않았으므로 OHI가 평소대로 글쇠를 처리합니다.
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
        }
        // 윗글쇠의 유니코드 받침을 OHI 내부 코드로 바꿉니다.
        // 겹받침은 내부 조합 상태에 이루는 닿소리 둘을 남겨 두어야
        // 지우기나 뒤따르는 홀소리 입력을 OHI가 처리할 수 있습니다.
        const finalCode = ohi_ggeut[unicode_modern_ggeut.indexOf(upper)];
        const parts = findFinalParts(finalCode);
        ohiQ[6] = parts ? parts[0] : finalCode;
        ohiQ[7] = parts ? parts[1] : 0;
        // 화면에 넣을 조합값은 따로 복사합니다.
        // ohiQ에는 겹받침을 이루는 닿소리의 내부 상태를 남기고, 화면용 배열에는 결합된 받침에 해당하는 값을 넣습니다.
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
    // 두벌식 자판 나눠치기는 순아래 확장과 따로 켜거나 끌 수 있습니다.
    // 세모이를 비롯한 세벌식 모아치기 자판은 여기서 처리하지 않습니다.
    const partialTypes = ['2-KSX5002', '2-KPS9256', '2-Dujule', '2-Gaon26KM'];
    let partialEnabled = false;
    let partialPending = false;
    let repeatingPartialKey = null;
    /** 요즘 한글 두벌식 자판에서만 이 나눠치기 기능을 쓸 수 있습니다. */
    function isPartialEnabled() {
        return partialEnabled && ohi_KE === 'Ko' && partialTypes.indexOf(Ko_type) >= 0 &&
            optionAvailable() && !option.turn_off_OHI;
    }
    OHIExtension.isPartialEnabled = isPartialEnabled;
    /** 두벌식 일반 입력과 나눠치기를 전환합니다. */
    function setPartialEnabled(enabled) {
        flushPartialChord();
        repeatingPartialKey = null;
        partialEnabled = enabled;
        show_options();
        show_keyboard_layout_info();
        inputText_focus();
    }
    OHIExtension.setPartialEnabled = setPartialEnabled;
    /** 순서 정정 기능을 기존 OHI의 중간 옵션 자리에 나타냅니다. */
    function renderPartialOptions(opts) {
        const id = 'option_ohi_partial_moachigi';
        let wrap = document.getElementById(id);
        if (!wrap) {
            opts.insertAdjacentHTML('beforeend', `
                <div class="option" id="option_ohi_partial_moachigi">
                    <input name="ohi_partial_moachigi" class="checkbox" type="checkbox" id="ohi_partial_checkbox">
                    <label for="ohi_partial_checkbox" title="한 글자를 첫소리 + 가운뎃소리 / 끝소리로 두 번에 나눠치기">나눠치기 <a href="https://blog.naver.com/eekdland/224208062611" target="_blank" rel="noopener noreferrer">ⓘ</a></label>
                </div>
            `);
            wrap = document.getElementById(id);
            const checkbox = document.getElementById('ohi_partial_checkbox');
            checkbox.addEventListener('change', () => setPartialEnabled(checkbox.checked));
        }
        wrap.style.display = ohi_KE === 'Ko' && partialTypes.indexOf(Ko_type) >= 0 &&
            optionAvailable() ? 'block' : 'none';
        document.getElementById('ohi_partial_checkbox').checked = partialEnabled;
    }
    /** 글쇠에 들어간 요즘 한글 낱자의 닿소리·홀소리를 구별합니다. */
    function partialKind(key) {
        const layout = find_current_layout();
        const jamo = layout[key - 33];
        if (typeof jamo !== 'number')
            return null;
        if (unicode_modern_cheos.indexOf(jamo) >= 0)
            return 'C';
        if (unicode_modern_ga.indexOf(jamo) >= 0)
            return 'V';
        if (unicode_modern_ggeut.indexOf(jamo) >= 0)
            return 'F';
        return null;
    }
    /** 두 홀소리가 결합하는 순서가 맞는지 살펴봅니다. */
    function canCombineVowels(first, second) {
        const layout = find_current_layout();
        const firstIndex = unicode_modern_ga.indexOf(layout[first - 33]);
        const secondIndex = unicode_modern_ga.indexOf(layout[second - 33]);
        if (firstIndex < 0 || secondIndex < 0)
            return false;
        const firstVowel = ohi_ga[firstIndex] - 35;
        const secondVowel = ohi_ga[secondIndex] - 35;
        // 거듭 순아래·국규·가온한글26KM에서는 ㅑ·ㅕ 다음의 ㅣ도 겹홀소리로 묶습니다.
        // OHI 본체가 따로 처리하는 조합이므로 일반 겹홀소리 조합표보다 먼저 살펴봅니다.
        if ((option.sunalae || Ko_type === '2-KPS9256' || Ko_type === '2-Gaon26KM' || Ko_type.substr(0, 5) === '2-sun') &&
            (firstVowel === 33 || firstVowel === 37) && secondVowel === 51)
            return true;
        return ohiDoubleJamo(1, firstVowel, secondVowel) > 0;
    }
    /** 두 닿소리가 순서를 고쳤을 때 겹받침을 이루는지 살펴봅니다. */
    function canCombineFinals(first, second) {
        const layout = find_current_layout();
        const firstJamo = layout[first - 33];
        const secondJamo = layout[second - 33];
        const firstIndex = unicode_cheos.indexOf(firstJamo);
        const secondIndex = unicode_cheos.indexOf(secondJamo);
        if (firstIndex < 0 || secondIndex < 0)
            return false;
        const firstFinal = unicode_cheos_to_ggeut[firstIndex];
        const secondFinal = unicode_cheos_to_ggeut[secondIndex];
        const a = ohi_ggeut[unicode_modern_ggeut.indexOf(firstFinal)];
        const b = ohi_ggeut[unicode_modern_ggeut.indexOf(secondFinal)];
        if (a === undefined || b === undefined)
            return false;
        const delta = ohiDoubleJamo(2, a, b);
        return delta > 0 && ohi_ggeut.indexOf(a + delta) >= 0;
    }
    /** 겹쳐 누른 글쇠의 조합 순서를 정정합니다. 조합은 기존 OHI가 다룹니다. */
    function reorderPartialKeys(keys) {
        if (keys.length < 2 || keys.length > 3)
            return keys.slice();
        const consonants = keys.filter(key => partialKind(key) === 'C');
        const vowels = keys.filter(key => partialKind(key) === 'V');
        // 홀소리가 있으면 CV 또는 CVV로 정리합니다.
        // 홀소리만 두 개 있는 나눠치기도 겹홀소리의 순서로 바꿉니다.
        if (consonants.length === 1 && consonants.length + vowels.length === keys.length ||
            !consonants.length && vowels.length === keys.length) {
            const ordered = vowels.slice();
            if (ordered.length === 2 && !canCombineVowels(ordered[0], ordered[1]) &&
                canCombineVowels(ordered[1], ordered[0]))
                ordered.reverse();
            return consonants.concat(ordered);
        }
        // 홀소리가 전혀 없으면 두 닿소리가 순서를 바꿨을 때 겹받침이 될 수 있는지 살펴봅니다.
        if (keys.length === 2 && consonants.length === 2 &&
            !canCombineFinals(keys[0], keys[1]) && canCombineFinals(keys[1], keys[0])) {
            return keys.slice().reverse();
        }
        return keys.slice();
    }
    /** 나눠치기 입력을 실제 한글 조합 함수로 넘깁니다. */
    function flushPartialChord(f, e) {
        // 기존 세모이도 pressed_keys를 쓰므로 나눠치기가 스스로 모은 입력만 다룹니다.
        if (!partialPending)
            return;
        partialPending = false;
        if (!pressed_keys.length) {
            pressing_keys = 0;
            return;
        }
        const target = f && (f.nodeName === 'TEXTAREA' || f.nodeName === 'INPUT')
            ? f : document.getElementById('inputText');
        const keys = pressed_keys.slice();
        pressed_keys = [];
        pressing_keys = 0;
        if (!target)
            return;
        for (const key of reorderPartialKeys(keys)) {
            // 한 번에 입력되더라도 각 낱자의 조합 상태를 유지하므로
            // ㅂ+ㅅ 다음에 ㅏ를 넣으면 겹받침을 온전하게 나눌 수 있습니다.
            ohiHangeul2(target, e || {}, key);
        }
    }
    OHIExtension.flushPartialChord = flushPartialChord;
    /** OHI의 일반 keypress 경로에서 불립니다. */
    function tryPartialKeypress(f, e, key) {
        if (!isPartialEnabled())
            return false;
        if (!partialKind(key)) {
            // 기호나 대체 시프트가 들어오면 앞선 한글을 먼저 내보냅니다.
            flushPartialChord(f, e);
            repeatingPartialKey = null;
            return false;
        }
        // 자동 되풀이 입력은 한 번의 나눠치기로 계속 쌓지 않습니다.
        if ((repeatingPartialKey === key && e && e.repeat) || pressed_keys.indexOf(key) >= 0) {
            flushPartialChord(f, e);
            repeatingPartialKey = key;
            ohiHangeul2(f, e, key);
            return true;
        }
        if (repeatingPartialKey === key) {
            ohiHangeul2(f, e, key);
            return true;
        }
        repeatingPartialKey = null;
        pressed_keys.push(key);
        ++pressing_keys;
        partialPending = true;
        return true;
    }
    OHIExtension.tryPartialKeypress = tryPartialKeypress;
    /** 마지막 글쇠를 놓으면 입력 묶음을 확정합니다. */
    function tryPartialKeyup(f, e) {
        if (!isPartialEnabled())
            return false;
        if (!partialPending && repeatingPartialKey === null)
            return true;
        if (e.keyCode === 16 || e.keyCode === 17 || e.keyCode === 18 || e.keyCode === 91 || e.keyCode === 93)
            return true;
        if (repeatingPartialKey !== null && !pressing_keys) {
            repeatingPartialKey = null;
            return true;
        }
        if (pressing_keys && !--pressing_keys) {
            flushPartialChord(f, e);
            repeatingPartialKey = null;
        }
        return true;
    }
    OHIExtension.tryPartialKeyup = tryPartialKeyup;
})(OHIExtension || (OHIExtension = {}));
