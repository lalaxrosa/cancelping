/**
 * UIManager
 * DOM 조작 및 사용자 인터페이스와 상호작용을 처리하는 모듈입니다.
 */
(function() {
  const UIManager = {
    // DOM 요소 캐시 (init에서 lazy하게 초기화)
    dom: {},

    // 이벤트 리스너 홀더
    listeners: {},

    /**
     * UI 초기화
     */
    init: function(appCallbacks) {
      // DOM 캐시 lazy loading (DOMContentLoaded 이벤트 완료 시점에 확실하게 바인딩)
      this.dom = {
        body: document.body,
        themeToggle: document.getElementById('theme-toggle'),
        modeToggle: document.getElementById('mode-toggle'),
        btnOpenModal: document.getElementById('btn-open-modal'),
        btnEmptyAdd: document.getElementById('btn-empty-add'),
        modalContainer: document.getElementById('modal-container'),
        btnCloseModalX: document.getElementById('btn-close-modal-x'),
        btnCancelModal: document.getElementById('btn-cancel-modal'),
        monitorForm: document.getElementById('monitor-form'),
        monitorGrid: document.getElementById('monitor-grid'),
        emptyState: document.getElementById('empty-state'),
        monitorCount: document.getElementById('monitor-count'),
        simulationInfoCard: document.getElementById('simulation-info-card'),
        btnLoadPresets: document.getElementById('btn-load-presets'),
        notificationBanner: document.getElementById('notification-banner'),
        btnGrantPermission: document.getElementById('btn-grant-permission'),
        
        // 모달 필드
        monitorId: document.getElementById('monitor-id'),
        monitorName: document.getElementById('monitor-name'),
        monitorUrl: document.getElementById('monitor-url'),
        keywordsAvail: document.getElementById('monitor-keywords-avail'),
        keywordsUnavail: document.getElementById('monitor-keywords-unavail'),
        monitorInterval: document.getElementById('monitor-interval'),
        modalTitle: document.getElementById('modal-title'),
        
        // 클립보드 이미지 필드 추가
        imagePasteZone: document.getElementById('image-paste-zone'),
        pastePreviewContainer: document.getElementById('paste-preview-container'),
        pastePreview: document.getElementById('paste-preview'),
        btnClearPaste: document.getElementById('btn-clear-paste'),
        monitorPastedImage: document.getElementById('monitor-pasted-image'),
        imageTypeSelection: document.getElementById('image-type-selection'),
        pastedImageAvail: document.getElementById('pasted-image-avail'),
        pastedImageUnavail: document.getElementById('pasted-image-unavail'),
        monitorUseProxy: document.getElementById('monitor-use-proxy')
      };

      this.callbacks = appCallbacks;
      this._bindEvents();
      this._updateNotificationBanner();
      this.updateSimulationBanner();
    },

    /**
     * 감시 대상 카드 그리드 렌더링
     */
    renderList: function(monitors, isSimulationMode) {
      const { monitorGrid, emptyState, monitorCount } = this.dom;
      
      // 카운터 업데이트
      monitorCount.textContent = monitors.length;

      if (monitors.length === 0) {
        monitorGrid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        monitorGrid.innerHTML = '';
        return;
      }

      emptyState.classList.add('hidden');
      monitorGrid.classList.remove('hidden');
      
      // 기존 렌더링 초기화
      monitorGrid.innerHTML = '';

      monitors.forEach(monitor => {
        const card = this._createCardElement(monitor, isSimulationMode);
        monitorGrid.appendChild(card);
      });
    },

    /**
     * 개별 감시 카드 DOM 엘리먼트 생성
     */
    _createCardElement: function(monitor, isSimulationMode) {
      const card = document.createElement('div');
      card.className = `monitor-card`;
      card.dataset.id = monitor.id;

      // 상태 파싱
      let statusClass = 'status-error';
      let statusText = '오류';
      
      switch(monitor.lastState) {
        case 'available':
          statusClass = 'status-available';
          statusText = '예약 가능 🟢';
          break;
        case 'unavailable':
          statusClass = 'status-unavailable';
          statusText = '예약 불가 🔴';
          break;
        case 'checking':
          statusClass = 'status-checking';
          statusText = '확인 중 🟡';
          break;
        default:
          statusClass = 'status-error';
          statusText = '대기 / 오류 ⚪';
      }

      // 주기를 텍스트로 치환
      const intervalText = monitor.interval === 30000 ? '30초' :
                           monitor.interval === 60000 ? '1분' :
                           monitor.interval === 300000 ? '5분' : '10분';

      // 카드 내용 템플릿
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-area">
            <h3 title="${monitor.name}">${monitor.name}</h3>
            <a href="${monitor.url}" target="_blank" class="card-url" title="${monitor.url}">${monitor.url}</a>
          </div>
          <div class="status-container ${statusClass}">
            <div class="status-dot"></div>
            <span class="status-text">${statusText}</span>
          </div>
        </div>

        <div class="card-details">
          <div class="card-detail-item">
            <span>확인 주기</span>
            <span class="card-detail-val">${intervalText}</span>
          </div>
          <div class="card-detail-item">
            <span>마지막 확인</span>
            <span class="card-detail-val check-time">${monitor.lastChecked || '대기 중'}</span>
          </div>
          <div class="card-detail-item">
            <span>키워드 감지</span>
            <span class="card-detail-val" style="font-size: 11px; text-align: right;" title="가능: ${monitor.keywordsAvail} / 불가: ${monitor.keywordsUnavail}">
              가능: ${monitor.keywordsAvail.split(',')[0]}..
            </span>
          </div>
          ${monitor.lastState === 'error' ? `
            <div class="card-detail-item card-error-notice" style="color: var(--status-unavailable); font-size: 11px; flex-direction: column; gap: 4px; border-top: 1px dashed var(--border); padding-top: 8px; margin-top: 4px;">
              <span style="font-weight: 700;">⚠️ CORS 차단 또는 연결 실패</span>
              <span style="font-weight: normal; line-height: 1.4; text-align: left;">
                로컬 파일(file://) 실행 시 CORS 해제 확장프로그램의 세부 설정에서 <strong>'파일 URL에 대한 액세스 허용'</strong> 스위치를 직접 켜주셔야 합니다. (chrome://extensions 진입 후 해당 확장 세부정보에서 활성화 가능)
              </span>
            </div>
          ` : ''}
        </div>

        ${isSimulationMode && monitor.enabled ? `
          <button class="btn btn-outline btn-sm btn-simulate-trigger" style="margin-top: 4px; border-color: rgba(99, 102, 241, 0.4); color: var(--primary);">
            ⚡ 시뮬레이션 취소표 발생
          </button>
        ` : ''}

        ${monitor.pastedImage ? `
          <div class="card-image-section">
            <span class="card-image-label">감시 대상 이미지</span>
            <div class="card-image-preview-wrapper" title="클릭 시 새 창으로 이미지 보기">
              <img class="card-image-preview" src="${monitor.pastedImage}" alt="감시 이미지" onclick="window.open(this.src, '_blank')">
              <span class="card-image-badge ${monitor.pastedImageType || 'available'}">
                ${(monitor.pastedImageType || 'available') === 'available' ? '가능' : '불가'}
              </span>
            </div>
          </div>
        ` : ''}

        <div class="card-actions">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label class="switch">
              <input type="checkbox" class="card-toggle" ${monitor.enabled ? 'checked' : ''}>
              <span class="slider round"></span>
            </label>
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">
              ${monitor.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm btn-edit" title="수정">수정</button>
            <button class="btn btn-danger-outline btn-sm btn-delete" title="삭제">삭제</button>
          </div>
        </div>
      `;

      // 1. 활성/비활성 토글 스위치 바인딩
      const toggle = card.querySelector('.card-toggle');
      toggle.addEventListener('change', (e) => {
        this.callbacks.onToggleActive(monitor.id, e.target.checked);
      });

      // 2. 삭제 버튼 바인딩
      const btnDelete = card.querySelector('.btn-delete');
      btnDelete.addEventListener('click', () => {
        if (confirm(`'${monitor.name}' 감시 카드를 삭제하시겠습니까?`)) {
          this.callbacks.onDelete(monitor.id);
        }
      });

      // 3. 수정 버튼 바인딩
      const btnEdit = card.querySelector('.btn-edit');
      btnEdit.addEventListener('click', () => {
        this._openEditModal(monitor);
      });

      // 4. (시뮬레이션 전용) 강제 취소표 생성 버튼 바인딩
      if (isSimulationMode && monitor.enabled) {
        const btnSimulate = card.querySelector('.btn-simulate-trigger');
        btnSimulate.addEventListener('click', () => {
          this.callbacks.onSimulateTrigger(monitor);
        });
      }

      return card;
    },

    /**
     * 특정 카드의 실시간 체크 상태 및 마지막 시간만 UI에 부분 업데이트
     */
    updateCardStatus: function(monitor) {
      const card = this.dom.monitorGrid.querySelector(`[data-id="${monitor.id}"]`);
      if (!card) return;

      const container = card.querySelector('.status-container');
      const text = card.querySelector('.status-text');
      const timeVal = card.querySelector('.check-time');

      // 리셋
      container.className = 'status-container';
      
      let statusClass = 'status-error';
      let statusText = '오류';
      
      switch(monitor.lastState) {
        case 'available':
          statusClass = 'status-available';
          statusText = '예약 가능 🟢';
          break;
        case 'unavailable':
          statusClass = 'status-unavailable';
          statusText = '예약 불가 🔴';
          break;
        case 'checking':
          statusClass = 'status-checking';
          statusText = '확인 중 🟡';
          break;
        default:
          statusClass = 'status-error';
          statusText = '오류 / CORS 차단 ⚪';
      }

      container.classList.add(statusClass);
      text.textContent = statusText;
      timeVal.textContent = monitor.lastChecked || '대기 중';

      // 에러 상세 메시지 동적 추가/제거
      let errorBlock = card.querySelector('.card-error-notice');
      if (monitor.lastState === 'error') {
        if (!errorBlock) {
          errorBlock = document.createElement('div');
          errorBlock.className = 'card-detail-item card-error-notice';
          errorBlock.style = 'color: var(--status-unavailable); font-size: 11px; flex-direction: column; gap: 4px; border-top: 1px dashed var(--border); padding-top: 8px; margin-top: 8px;';
          errorBlock.innerHTML = `
            <span style="font-weight: 700;">⚠️ CORS 차단 또는 연결 실패</span>
            <span style="font-weight: normal; line-height: 1.4; text-align: left;">
              로컬 파일(file://) 실행 시 CORS 해제 확장프로그램의 세부 설정에서 <strong>'파일 URL에 대한 액세스 허용'</strong> 스위치를 직접 켜주셔야 합니다. (chrome://extensions 진입 후 해당 확장 세부정보에서 활성화 가능)
            </span>
          `;
          card.querySelector('.card-details').appendChild(errorBlock);
        }
      } else {
        if (errorBlock) {
          errorBlock.remove();
        }
      }
    },

    /**
     * 테마 설정 반영 (Body의 data-theme 속성 토글)
     */
    applyTheme: function(theme) {
      this.dom.body.setAttribute('data-theme', theme);
    },

    /**
     * 시뮬레이션 배너 토글
     */
    updateSimulationBanner: function() {
      const isSim = this.dom.modeToggle.checked;
      if (isSim) {
        this.dom.simulationInfoCard.classList.remove('hidden');
      } else {
        this.dom.simulationInfoCard.classList.add('hidden');
      }
    },

    /**
     * 알림 허용 권한 배너 업데이트
     */
    _updateNotificationBanner: function() {
      const state = NotificationManager.getPermissionState();
      if (state === 'default') {
        this.dom.notificationBanner.classList.remove('hidden');
      } else {
        this.dom.notificationBanner.classList.add('hidden');
      }
    },

    /**
     * 클립보드 이미지 붙여넣기 이벤트 처리
     */
    _handleImagePaste: function(e) {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target.result;
            this._setPastedImage(dataUrl, 'available');
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    },

    /**
     * 붙여넣은 이미지 설정 및 화면 표시
     */
    _setPastedImage: function(dataUrl, type = 'available') {
      this.dom.monitorPastedImage.value = dataUrl;
      this.dom.pastePreview.src = dataUrl;
      this.dom.pastePreviewContainer.classList.remove('hidden');
      this.dom.imagePasteZone.querySelector('.paste-placeholder').classList.add('hidden');
      this.dom.imageTypeSelection.classList.remove('hidden');
      
      if (type === 'available') {
        this.dom.pastedImageAvail.checked = true;
      } else {
        this.dom.pastedImageUnavail.checked = true;
      }
    },

    /**
     * 붙여넣은 이미지 초기화
     */
    _clearPastedImage: function() {
      this.dom.monitorPastedImage.value = '';
      this.dom.pastePreview.src = '';
      this.dom.pastePreviewContainer.classList.add('hidden');
      this.dom.imagePasteZone.querySelector('.paste-placeholder').classList.remove('hidden');
      this.dom.imageTypeSelection.classList.add('hidden');
    },

    /**
     * 감시조건 추가 버튼 활성화/비활성화 검증
     */
    _validateForm: function() {
      const { monitorName, monitorUrl, monitorForm } = this.dom;
      const submitBtn = monitorForm.querySelector('button[type="submit"]');
      if (!submitBtn) return;
      
      const nameVal = monitorName.value.trim();
      const urlVal = monitorUrl.value.trim();
      
      // 서비스 이름과 URL이 채워져 있고 양식에 맞는지 확인
      const isValid = nameVal.length > 0 && urlVal.length > 0 && monitorForm.checkValidity();
      
      if (isValid) {
        submitBtn.removeAttribute('disabled');
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      } else {
        submitBtn.setAttribute('disabled', 'true');
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
      }
    },

    /**
     * 수정 모드 모달 열기
     */
    _openEditModal: function(monitor) {
      const { monitorId, monitorName, monitorUrl, keywordsAvail, keywordsUnavail, monitorInterval, modalTitle } = this.dom;
      
      monitorId.value = monitor.id;
      monitorName.value = monitor.name;
      monitorUrl.value = monitor.url;
      keywordsAvail.value = monitor.keywordsAvail;
      keywordsUnavail.value = monitor.keywordsUnavail;
      monitorInterval.value = monitor.interval.toString();
      
      modalTitle.textContent = '감시 카드 정보 수정';
      this.dom.modalContainer.classList.remove('hidden');
      
      // 이미지가 존재하면 복원
      if (monitor.pastedImage) {
        this._setPastedImage(monitor.pastedImage, monitor.pastedImageType || 'available');
      } else {
        this._clearPastedImage();
      }
      
      // 필드값이 입력되어 있으므로 버튼 활성화 상태 업데이트
      this._validateForm();
    },

    /**
     * 등록 모달 열기
     */
    _openCreateModal: function() {
      const { monitorId, monitorName, monitorUrl, keywordsAvail, keywordsUnavail, monitorInterval, modalTitle, monitorForm } = this.dom;
      
      monitorForm.reset();
      monitorId.value = ''; // 신규 등록
      
      // 디폴트값 보정
      keywordsAvail.value = '예약하기, 예약 가능, 선택 가능, 잔여석, btn_reserve.gif';
      keywordsUnavail.value = '매진, 예약 마감, 잔여석 없음, btn_soldout.gif';
      monitorInterval.value = '60000'; // 1분 기본
      
      modalTitle.textContent = '새 감시 추가';
      this.dom.modalContainer.classList.remove('hidden');
      
      // 신규 작성 시는 초기 비활성화 상태로 시작
      this._validateForm();
    },

    /**
     * 모달 닫기
     */
    _closeModal: function() {
      this.dom.modalContainer.classList.add('hidden');
      this.dom.monitorForm.reset();
      this._clearPastedImage();
    },

    /**
     * 이벤트 바인딩
     */
    _bindEvents: function() {
      // 1. 새 감시 모달 열기
      this.dom.btnOpenModal.addEventListener('click', () => this._openCreateModal());
      if (this.dom.btnEmptyAdd) {
        this.dom.btnEmptyAdd.addEventListener('click', () => this._openCreateModal());
      }

      // 2. 모달 닫기 (취소/X 버튼)
      this.dom.btnCloseModalX.addEventListener('click', () => this._closeModal());
      this.dom.btnCancelModal.addEventListener('click', () => this._closeModal());

      // 3. 다크모드 토글 버튼
      this.dom.themeToggle.addEventListener('click', () => {
        const currentTheme = this.dom.body.getAttribute('data-theme') || 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(nextTheme);
        this.callbacks.onThemeChange(nextTheme);
      });

      // 4. 시뮬레이션 모드 토글 스위치
      this.dom.modeToggle.addEventListener('change', (e) => {
        const isSim = e.target.checked;
        this.updateSimulationBanner();
        this.callbacks.onModeChange(isSim);
      });

      // 5. 추천 프리셋 로드 버튼
      this.dom.btnLoadPresets.addEventListener('click', () => {
        this.callbacks.onLoadPresets();
      });

      // 6. 알림 권한 허용 승인 버튼
      this.dom.btnGrantPermission.addEventListener('click', () => {
        NotificationManager.requestPermission((permission) => {
          this._updateNotificationBanner();
          if (permission === 'granted') {
            alert('브라우저 알림 권한이 성공적으로 설정되었습니다!');
          } else if (permission === 'denied') {
            alert('알림이 차단되었습니다. 실시간 알림을 받으시려면 브라우저 주소창 왼쪽 자물쇠 버튼을 눌러 알림 권한을 직접 허용해 주세요.');
          }
        });
      });

      // 7. 클립보드 붙여넣기 관련 이벤트 바인딩
      this.dom.imagePasteZone.addEventListener('click', () => {
        this.dom.imagePasteZone.focus();
      });

      this.dom.imagePasteZone.addEventListener('paste', (e) => {
        this._handleImagePaste(e);
      });

      this.dom.btnClearPaste.addEventListener('click', (e) => {
        e.stopPropagation(); // 포커스 방지
        this._clearPastedImage();
      });

      // 8. 실시간 모달 입력값 검증 (사이트 주소 및 입력값 필드 검증을 통한 버튼 활성화 제어)
      this.dom.monitorForm.addEventListener('input', () => {
        this._validateForm();
      });

      // 9. 모달 폼 전송 (저장 및 등록)
      this.dom.monitorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const pastedImage = this.dom.monitorPastedImage.value;
        const pastedImageType = this.dom.monitorForm.elements['pasted-image-type'].value;

        const monitorData = {
          id: this.dom.monitorId.value || 'monitor-' + Date.now(),
          name: this.dom.monitorName.value.trim(),
          url: this.dom.monitorUrl.value.trim(),
          keywordsAvail: this.dom.keywordsAvail.value.trim(),
          keywordsUnavail: this.dom.keywordsUnavail.value.trim(),
          interval: parseInt(this.dom.monitorInterval.value, 10),
          enabled: true, // 등록/수정 후 즉시 켬
          lastState: 'unknown',
          lastChecked: '',
          pastedImage: pastedImage || null,
          pastedImageType: pastedImage ? pastedImageType : null
        };

        const isEdit = !!this.dom.monitorId.value;
        this.callbacks.onSave(monitorData, isEdit);
        this._closeModal();
      });
    }
  };

  window.UIManager = UIManager;
})();
