/**
 * ===================================================
 * 바이브 카페 (Vibe Cafe) - 주문서 자바스크립트
 * ===================================================
 */

// ===================================================
// [Supabase 설정]
// 아래 URL과 ANON_KEY를 본인의 Supabase 프로젝트 정보로 입력해주세요.
// Supabase 웹 콘솔 -> Project Settings -> API 에서 확인 가능합니다.
// ===================================================
const SUPABASE_URL = 'https://ljkbhbvobnlqdimftaug.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa2JoYnZvYm5scWRpbWZ0YXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MjkzMjUsImV4cCI6MjEwNzAwNTMyNX0.wWM_o33-JU2q7jiU665wkOqdD7l2VRhA5Td-lJqFnYs';

// HTML 문서가 모두 로드된 후 스크립트를 실행합니다.
document.addEventListener('DOMContentLoaded', () => {
  // Supabase 클라이언트 초기화
  let supabaseClient = null;
  if (window.supabase && SUPABASE_URL !== 'https://YOUR_PROJECT_ID.supabase.co') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // 1. 주요 HTML 요소(DOM) 가져오기
  const orderForm = document.getElementById('order-form');               // 주문서 폼 전체
  const customerNameInput = document.getElementById('customer-name');   // 이름 입력창
  const customerPhoneInput = document.getElementById('customer-phone'); // 전화번호 입력창
  const drinkSelect = document.getElementById('drink-select');           // 음료 선택 셀렉트박스
  const quantityInput = document.getElementById('quantity');             // 수량 입력창
  const requestsInput = document.getElementById('requests');             // 요청사항 입력창
  const totalPriceSpan = document.getElementById('total-price');         // 총 예상 금액 표시 span
  const orderConfirmation = document.getElementById('order-confirmation');// 주문 완료 확인 메시지 영역
  const submitBtn = document.getElementById('submit-btn');               // 주문하기 버튼
  const resetBtn = document.getElementById('reset-btn');                 // 다시 작성 버튼

  /**
   * [금액 계산 함수] calculateTotal()
   * - 음료, 사이즈, 추가 옵션, 수량을 바탕으로 총 금액을 계산하고 화면에 표시합니다.
   * - 다른 이벤트에서도 언제든 호출하여 재사용할 수 있습니다.
   * @returns {number} 계산된 총 금액
   */
  function calculateTotal() {
    // (1) 음료 선택 확인
    const selectedDrinkOption = drinkSelect.options[drinkSelect.selectedIndex];
    const drinkValue = drinkSelect.value;

    // 음료를 아직 고르지 않은 경우 (기본 옵션: value="")
    // 사이즈나 옵션이 체크되어 있어도 예상 금액은 0원으로 표시합니다.
    if (!drinkValue) {
      totalPriceSpan.textContent = '0';
      return 0;
    }

    // 선택된 음료 가격 (data-price 속성 값 읽기)
    const drinkPrice = Number(selectedDrinkOption.dataset.price) || 0;

    // (2) 사이즈 가격 계산 (라디오 버튼 중 체크된 항목)
    const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
    const sizePrice = selectedSizeRadio ? (Number(selectedSizeRadio.dataset.price) || 0) : 0;

    // (3) 추가 옵션 가격 계산 (체크박스 중 체크된 모든 항목 합산)
    const checkedOptionBoxes = document.querySelectorAll('input[name="options"]:checked');
    let optionsPrice = 0;
    checkedOptionBoxes.forEach((checkbox) => {
      optionsPrice += Number(checkbox.dataset.price) || 0;
    });

    // (4) 수량 확인 (숫자가 아니거나 1 미만인 경우 최소 1로 처리)
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    // (5) 최종 금액 계산: (음료 기본가 + 사이즈 추가금 + 옵션 합계) * 수량
    const unitPrice = drinkPrice + sizePrice + optionsPrice;
    const total = unitPrice * quantity;

    // (6) 천 단위 콤마(toLocaleString)를 적용하여 화면에 표시
    totalPriceSpan.textContent = total.toLocaleString();

    return total;
  }

  /**
   * [실시간 이벤트 연결]
   * 음료, 사이즈, 추가옵션, 수량이 변경될 때마다 calculateTotal()을 호출합니다.
   */
  // 음료 선택 변경 시
  drinkSelect.addEventListener('change', calculateTotal);

  // 사이즈(라디오) 및 옵션(체크박스) 변경 시
  const sizeRadios = document.querySelectorAll('input[name="size"]');
  sizeRadios.forEach((radio) => {
    radio.addEventListener('change', calculateTotal);
  });

  const optionCheckboxes = document.querySelectorAll('input[name="options"]');
  optionCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', calculateTotal);
  });

  // 수량 입력 및 화살표 조작 시 실시간 반영
  quantityInput.addEventListener('input', calculateTotal);
  quantityInput.addEventListener('change', calculateTotal);

  /**
   * [주문하기 버튼 클릭 (폼 제출 이벤트)]
   * - 유효성 검사 (이름, 음료 선택 여부)
   * - Supabase 데이터베이스 저장
   * - 주문 확인 메시지 동적 생성 및 표시
   */
  orderForm.addEventListener('submit', async (event) => {
    // 폼 제출 시 페이지가 새로고침되는 기본 동작을 막습니다.
    event.preventDefault();

    // 1. 이름 필수 입력 검사
    const customerName = customerNameInput.value.trim();
    if (!customerName) {
      alert('이름을 입력해주세요');
      customerNameInput.focus();
      return;
    }

    // 2. 음료 선택 검사
    if (!drinkSelect.value) {
      alert('음료를 선택해주세요');
      drinkSelect.focus();
      return;
    }

    // 3. 주문 정보 데이터 추출
    const customerPhone = customerPhoneInput ? customerPhoneInput.value.trim() : '';
    const requests = requestsInput ? requestsInput.value.trim() : '';

    // (1) 음료 이름: "카페라떼 (4,000원)"에서 괄호 앞 이름만 추출
    const selectedDrinkText = drinkSelect.options[drinkSelect.selectedIndex].text;
    const drinkName = selectedDrinkText.split(' (')[0].trim();

    // (2) 사이즈: 예) "M"
    const selectedSizeRadio = document.querySelector('input[name="size"]:checked');
    const sizeValue = selectedSizeRadio ? selectedSizeRadio.value : 'M';
    const sizeName = `${sizeValue}사이즈`;

    // (3) 추가 옵션: 선택된 체크박스의 라벨 텍스트(예: "샷 추가") 추출
    const checkedOptionBoxes = document.querySelectorAll('input[name="options"]:checked');
    const optionNames = [];

    checkedOptionBoxes.forEach((checkbox) => {
      const label = document.querySelector(`label[for="${checkbox.id}"]`);
      if (label) {
        // 라벨 안의 " (+500원)" 같은 가격 부분을 제거하고 옵션 이름만 추출
        const cleanOptionName = label.textContent.split(' (')[0].trim();
        optionNames.push(cleanOptionName);
      }
    });

    const optionText = optionNames.length > 0 ? ` (${optionNames.join(', ')})` : '';
    const optionDBValue = optionNames.length > 0 ? optionNames.join(', ') : null;

    // (4) 수량
    const quantity = parseInt(quantityInput.value, 10) || 1;

    // (5) 총 금액 계산 및 콤마 포맷
    const finalTotal = calculateTotal();
    const formattedTotal = finalTotal.toLocaleString();

    // 4. 버튼 상태 변경 (중복 클릭 방지)
    submitBtn.disabled = true;
    submitBtn.textContent = '주문 처리 중...';

    // 5. Supabase DB 저장 시도
    let isSavedToDB = false;
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('orders')
          .insert([
            {
              customer_name: customerName,
              customer_phone: customerPhone || null,
              drink: drinkName,
              size: sizeValue,
              options: optionDBValue,
              quantity: quantity,
              requests: requests || null,
              total_price: finalTotal
            }
          ]);

        if (error) {
          throw error;
        }
        isSavedToDB = true;
      } catch (err) {
        console.error('Supabase 저장 중 오류:', err);
        alert('DB 저장 중 오류가 발생했습니다: ' + (err.message || err));
      }
    } else {
      console.warn('Supabase 클라이언트가 초기화되지 않았습니다. script.js 상단의 URL과 ANON_KEY를 확인해주세요.');
    }

    // 6. 주문 확인 메시지 조립 및 표시
    const dbStatusText = isSavedToDB ? ' [DB 저장 완료]' : '';
    const confirmationMessage = `${customerName}님, ${drinkName} ${sizeName}${optionText} ${quantity}잔, 총 ${formattedTotal}원 주문이 접수되었습니다!${dbStatusText}`;

    orderConfirmation.textContent = confirmationMessage;
    orderConfirmation.style.display = 'block';

    // 확인 메시지 위치로 부드럽게 스크롤 이동
    orderConfirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 버튼 상태 원복
    submitBtn.disabled = false;
    submitBtn.textContent = '주문하기';
  });

  /**
   * [다시 작성 버튼 클릭 이벤트]
   * - 모든 입력 필드를 기본 상태(M 사이즈, 수량 1)로 초기화하고 금액 및 안내 메시지를 리셋합니다.
   */
  resetBtn.addEventListener('click', () => {
    // 브라우저의 기본 form reset 동작 이후(다음 틱)에 실행되도록 setTimeout 사용
    setTimeout(() => {
      // 1. M 사이즈 라디오 버튼 기본 체크 확인
      const defaultSizeRadio = document.getElementById('size-m');
      if (defaultSizeRadio) {
        defaultSizeRadio.checked = true;
      }

      // 2. 수량 기본값 1 복원
      quantityInput.value = 1;

      // 3. 금액 0원으로 재계산 및 갱신
      calculateTotal();

      // 4. 주문 확인 메시지 숨기기
      orderConfirmation.textContent = '';
      orderConfirmation.style.display = 'none';
    }, 0);
  });

  // 페이지 최초 진입 시 초기 금액 계산 실행 (기본 0원 표시)
  calculateTotal();
});

