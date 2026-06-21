/**
 * MonitorEngine
 * 감시 대상 항목의 상태를 주기적으로 체크하는 엔진 모듈입니다.
 */
(function() {
  // 모니터링 타이머 저장소: { [monitorId]: timerId }
  const activeIntervals = {};
  
  // 모니터링 일시적 지연(Checking 상태 표현용) 저장소: { [monitorId]: timeoutId }
  const activeTimeouts = {};

  const MonitorEngine = {
    /**
     * 개별 감시 항목 상태 변경 검사 및 알림 발송
     * @param {Object} monitor - 감시 대상 객체
     * @param {boolean} isSimulationMode - 시뮬레이션 모드 활성화 여부
     * @param {Function} updateCallback - 상태 변경 시 UI 업데이트 콜백
     * @param {string} forcedNextState - (옵션) 강제로 지정할 다음 상태 (테스트용)
     */
    runCheck: function(monitor, isSimulationMode, updateCallback, forcedNextState = null) {
      if (!monitor.enabled) return;

      // 1. UI를 '확인 중 (checking)' 상태로 즉시 업데이트
      monitor.lastState = 'checking';
      updateCallback(monitor);

      // 2. 가상의 네트워크 딜레이 생성 (Checking 애니메이션을 자연스럽게 노출하기 위함)
      const delay = isSimulationMode ? 1200 : 100;

      // 이전 타이머 잔재 클리어
      if (activeTimeouts[monitor.id]) {
        clearTimeout(activeTimeouts[monitor.id]);
      }

      activeTimeouts[monitor.id] = setTimeout(() => {
        if (isSimulationMode) {
          // A. 시뮬레이션 모드 분기
          this._simulateCheck(monitor, updateCallback, forcedNextState);
        } else {
          // B. 실제 Fetch 모드 분기
          this._realCheck(monitor, updateCallback);
        }
      }, delay);
    },

    /**
     * 가상 시뮬레이션 처리
     */
    _simulateCheck: function(monitor, updateCallback, forcedNextState) {
      const states = ['available', 'unavailable'];
      const prevState = monitor.lastStateBeforeChecking || 'unavailable';
      let nextState = prevState;

      if (forcedNextState) {
        nextState = forcedNextState;
      } else {
        // 35% 확률로 상태 변경, 그렇지 않으면 이전 상태 유지
        if (Math.random() < 0.35) {
          nextState = prevState === 'available' ? 'unavailable' : 'available';
        }
      }

      // 상태 진입 기록 백업
      monitor.lastStateBeforeChecking = nextState;
      
      const timeStr = this._getCurrentTimeString();
      const stateChanged = (prevState !== nextState) && (prevState !== 'checking');

      // 예약 불가/미정 -> 예약 가능 상태로 변경된 경우에 알림 발송
      if (stateChanged && nextState === 'available') {
        let msg = `지금 예약 가능 상태로 바뀌었습니다. 서두르세요!`;
        if (monitor.pastedImage) {
          const typeLabel = (monitor.pastedImageType === 'available') ? '예약 가능 이미지' : '예약 불가 이미지';
          msg = `설정한 이미지 매칭 조건(${typeLabel})이 감지되었습니다!`;
        }
        NotificationManager.show(
          `🎉 취소표 발생! (${monitor.name})`,
          msg,
          monitor.url
        );
      }

      monitor.lastState = nextState;
      monitor.lastChecked = timeStr;
      
      // 스토리지 갱신
      const allMonitors = StorageManager.loadMonitors();
      const idx = allMonitors.findIndex(m => m.id === monitor.id);
      if (idx !== -1) {
        allMonitors[idx].lastState = nextState;
        allMonitors[idx].lastChecked = timeStr;
        StorageManager.saveMonitors(allMonitors);
      }

      updateCallback(monitor);
    },

    /**
     * 실제 CORS Fetch 통신 처리
     */
    _realCheck: function(monitor, updateCallback) {
      const prevState = monitor.lastStateBeforeChecking || 'unknown';
      const timeStr = this._getCurrentTimeString();

      // headers 및 캐시 방지 쿼리 추가
      const fetchUrl = monitor.url + (monitor.url.includes('?') ? '&' : '?') + '_nocache=' + Date.now();

      fetch(fetchUrl, {
        method: 'GET',
        mode: 'cors', // CORS 모드 명시
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9'
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}`);
        }
        return response.text();
      })
      .then(html => {
        let nextState = 'unknown';

        // 키워드 분석 (대소문자 구분 없이 매칭하기 위해 소문자화)
        const htmlLower = html.toLowerCase();
        const availKeywords = monitor.keywordsAvail.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        const unavailKeywords = monitor.keywordsUnavail.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

        // HTML 전체 텍스트에서 검색
        const hasAvail = availKeywords.some(kw => htmlLower.includes(kw));
        const hasUnavail = unavailKeywords.some(kw => htmlLower.includes(kw));

        if (hasAvail) {
          nextState = 'available';
        } else if (hasUnavail) {
          nextState = 'unavailable';
        } else {
          nextState = 'unknown';
        }

        monitor.lastStateBeforeChecking = nextState;
        const stateChanged = (prevState !== nextState) && (prevState !== 'checking') && (prevState !== 'unknown');

        if (stateChanged && nextState === 'available') {
          let msg = `지정한 예약 페이지에서 가능 키워드가 감지되었습니다.`;
          if (monitor.pastedImage) {
            msg = `설정한 예약 가능 이미지 조건이 감지되었습니다.`;
          }
          NotificationManager.show(
            `🎉 취소표 발생! (${monitor.name})`,
            msg,
            monitor.url
          );
        }

        monitor.lastState = nextState;
        monitor.lastChecked = timeStr;
      })
      .catch(err => {
        console.error(`Fetch check failed for ${monitor.name}:`, err);
        monitor.lastState = 'error';
        monitor.lastChecked = timeStr;
      })
      .finally(() => {
        // 스토리지 저장
        const allMonitors = StorageManager.loadMonitors();
        const idx = allMonitors.findIndex(m => m.id === monitor.id);
        if (idx !== -1) {
          allMonitors[idx].lastState = monitor.lastState;
          allMonitors[idx].lastChecked = monitor.lastChecked;
          StorageManager.saveMonitors(allMonitors);
        }
        updateCallback(monitor);
      });
    },

    /**
     * 특정 감시 항목 스레드 기동
     */
    start: function(monitor, isSimulationMode, updateCallback) {
      this.stop(monitor.id); // 기존 타이머가 존재한다면 클리어

      // 첫 1회 검사는 딜레이 없이 즉시 실행
      this.runCheck(monitor, isSimulationMode, updateCallback);

      // 설정된 주기에 맞춰 반복 검사 설정
      activeIntervals[monitor.id] = setInterval(() => {
        this.runCheck(monitor, isSimulationMode, updateCallback);
      }, monitor.interval);
      
      console.log(`Started monitor timer for ID: ${monitor.id}, Interval: ${monitor.interval}ms`);
    },

    /**
     * 특정 감시 항목 스레드 중지
     */
    stop: function(monitorId) {
      if (activeIntervals[monitorId]) {
        clearInterval(activeIntervals[monitorId]);
        delete activeIntervals[monitorId];
        console.log(`Stopped monitor timer for ID: ${monitorId}`);
      }
      if (activeTimeouts[monitorId]) {
        clearTimeout(activeTimeouts[monitorId]);
        delete activeTimeouts[monitorId];
      }
    },

    /**
     * 모든 활성화 카드 타이머 구동
     */
    startAllActive: function(monitors, isSimulationMode, updateCallback) {
      monitors.forEach(monitor => {
        if (monitor.enabled) {
          // 백업 복사본 생성하여 주소 체크
          const copied = { ...monitor, lastStateBeforeChecking: monitor.lastState };
          this.start(copied, isSimulationMode, updateCallback);
        }
      });
    },

    /**
     * 모든 구동 타이머 정지
     */
    stopAll: function() {
      Object.keys(activeIntervals).forEach(id => this.stop(id));
    },

    /**
     * 현재 시각 취득 (HH:MM:SS format)
     */
    _getCurrentTimeString: function() {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
  };

  window.MonitorEngine = MonitorEngine;
})();
