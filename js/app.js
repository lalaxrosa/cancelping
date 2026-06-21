/**
 * Application Bootstrapper
 * 각 모듈들을 통합하고 앱의 생명주기를 관리하는 메인 모듈입니다.
 */
(function() {
  // 앱 내부 상태
  let monitors = [];
  let settings = {
    theme: 'light',
    isSimulationMode: true
  };

  /**
   * 개별 모니터 상태가 엔진에 의해 감지 및 변경되었을 때의 콜백
   */
  function handleMonitorUpdate(updatedMonitor) {
    // 1. 메모리 상의 목록 동기화
    const idx = monitors.findIndex(m => m.id === updatedMonitor.id);
    if (idx !== -1) {
      monitors[idx].lastState = updatedMonitor.lastState;
      monitors[idx].lastChecked = updatedMonitor.lastChecked;
    }
    
    // 2. 해당 카드 상태만 부분 DOM 업데이트 수행 (전체 렌더링에 따른 스위치 풀림 방지)
    UIManager.updateCardStatus(updatedMonitor);
  }

  /**
   * 모듈 콜백 정의
   */
  const appCallbacks = {
    // 다크/라이트 테마 변경
    onThemeChange: function(nextTheme) {
      settings.theme = nextTheme;
      StorageManager.saveSettings(settings);
    },

    // 시뮬레이션 / 실제 Fetch 모드 변경
    onModeChange: function(isSim) {
      settings.isSimulationMode = isSim;
      StorageManager.saveSettings(settings);
      
      // 모니터링 엔진의 모든 타이머를 일단 정지
      MonitorEngine.stopAll();

      // 바뀐 모드로 활성화된 모니터 타이머 다시 작동
      if (isSim) {
        console.log('Mode switched to [Simulation Mode]. Restarting timers...');
      } else {
        console.log('Mode switched to [Real Fetch Mode]. Restarting timers...');
      }
      
      // 상태값 리셋 후 렌더링 및 작동
      monitors = monitors.map(m => {
        return { ...m, lastState: 'unknown', lastChecked: '' };
      });
      StorageManager.saveMonitors(monitors);
      
      UIManager.renderList(monitors, settings.isSimulationMode);
      
      MonitorEngine.startAllActive(monitors, settings.isSimulationMode, handleMonitorUpdate);
    },

    // 카드 ON/OFF 상태 토글
    onToggleActive: function(id, isEnabled) {
      const idx = monitors.findIndex(m => m.id === id);
      if (idx === -1) return;

      monitors[idx].enabled = isEnabled;
      
      if (!isEnabled) {
        // 비활성화 시 엔진 타이머 정지 및 상태 초기화
        MonitorEngine.stop(id);
        monitors[idx].lastState = 'unknown';
        monitors[idx].lastChecked = '';
      }
      
      StorageManager.saveMonitors(monitors);
      
      // 전체 리스트 재구성하지 않고 상태 변화 및 ON/OFF 토글 뷰 갱신
      UIManager.updateCardStatus(monitors[idx]);
      
      // 전체 재렌더링 수행 (시뮬레이션 발생 버튼 표시 제어 등을 위해 1회 렌더)
      UIManager.renderList(monitors, settings.isSimulationMode);

      if (isEnabled) {
        // 활성화 시 엔진 타이머 구동
        const monitorCopy = { ...monitors[idx], lastStateBeforeChecking: 'unknown' };
        MonitorEngine.start(monitorCopy, settings.isSimulationMode, handleMonitorUpdate);
      }
    },

    // 감시 대상 삭제
    onDelete: function(id) {
      // 1. 엔진 작동 정지
      MonitorEngine.stop(id);

      // 2. 데이터 제거
      monitors = monitors.filter(m => m.id !== id);
      StorageManager.saveMonitors(monitors);

      // 3. UI 갱신
      UIManager.renderList(monitors, settings.isSimulationMode);
    },

    // 감시 대상 저장 (추가 및 수정)
    onSave: function(monitorData, isEdit) {
      if (isEdit) {
        // 수정 모드
        const idx = monitors.findIndex(m => m.id === monitorData.id);
        if (idx !== -1) {
          // 기존 타이머 정지
          MonitorEngine.stop(monitorData.id);
          
          monitors[idx] = { 
            ...monitorData, 
            enabled: monitors[idx].enabled // ON/OFF 상태는 그대로 보존
          };
        }
      } else {
        // 신규 추가
        monitors.push(monitorData);
      }

      StorageManager.saveMonitors(monitors);
      
      // UI 리스트 갱신
      UIManager.renderList(monitors, settings.isSimulationMode);

      // 스위치가 켜진 상태라면 즉시 모니터링 구동
      const currentMonitor = monitors.find(m => m.id === monitorData.id);
      if (currentMonitor && currentMonitor.enabled) {
        const monitorCopy = { ...currentMonitor, lastStateBeforeChecking: 'unknown' };
        MonitorEngine.start(monitorCopy, settings.isSimulationMode, handleMonitorUpdate);
      }
    },

    // 추천 프리셋 로드
    onLoadPresets: function() {
      // 스토리지에 프리셋 결합하여 저장
      monitors = StorageManager.loadPresetMonitors();
      
      // UI 렌더링 수행
      UIManager.renderList(monitors, settings.isSimulationMode);
      
      // 프리셋에 포함된 모든 활성화 항목 타이머 갱신 구동
      MonitorEngine.startAllActive(monitors, settings.isSimulationMode, handleMonitorUpdate);
      
      alert('추천 프리셋(국립자연휴양림, 마라톤 접수, 난지캠핑장)이 추가되었습니다!');
    },

    // (시뮬레이션 모드 전용) 취소표 발생 강제 호출
    onSimulateTrigger: function(monitor) {
      // 현재 모니터 활성화 상태 체크
      if (!monitor.enabled) return;
      
      console.log(`[Simulation Force Trigger] Firing 'available' status for: ${monitor.name}`);
      
      // monitor.id 타이머 정지 후, 강제로 available 상태를 주입하여 1회 체크 실행
      const copiedMonitor = { ...monitor, lastStateBeforeChecking: 'unavailable' };
      
      // 강제 업데이트 수행
      MonitorEngine.runCheck(copiedMonitor, true, handleMonitorUpdate, 'available');
    }
  };

  /**
   * 앱 로딩 시 실행될 부트스트랩 함수
   */
  function initApp() {
    console.log('CancelPing APP Initialization started.');

    // 1. 설정 및 감시 목록 로드
    settings = StorageManager.loadSettings();
    monitors = StorageManager.loadMonitors();

    // 2. UI 초기화
    UIManager.init(appCallbacks);

    // 3. 다크모드/라이트모드 테마 렌더러 반영
    UIManager.applyTheme(settings.theme);

    // 4. 감시 모드(시뮬레이션 스위치) 상태 반영
    UIManager.dom.modeToggle.checked = settings.isSimulationMode;
    UIManager.updateSimulationBanner();

    // 5. 최초 카드 리스트 마운트
    UIManager.renderList(monitors, settings.isSimulationMode);

    // 6. 구동되고 있는 활성화 목록이 있다면 타이머 일괄 가동
    MonitorEngine.startAllActive(monitors, settings.isSimulationMode, handleMonitorUpdate);
  }

  // DOM 로딩 완료 시 구동
  document.addEventListener('DOMContentLoaded', initApp);
})();
