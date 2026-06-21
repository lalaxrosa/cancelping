/**
 * StorageManager
 * localStorage와 연동하여 상태를 보존하고 복원하는 모듈입니다.
 */
(function() {
  const MONITORS_KEY = 'cancel_ping_monitors';
  const SETTINGS_KEY = 'cancel_ping_settings';

  // 프리셋 데이터 정의
  const PRESET_MONITORS = [
    {
      id: 'preset-forest',
      name: '국립자연휴양림 (유명산)',
      url: 'https://www.foresttrip.go.kr/pot/rm/camps/useCampLmtInfo.do',
      interval: 30000, // 30초
      keywordsAvail: '예약하기, 예약 가능, 선택 가능, 잔여석',
      keywordsUnavail: '매진, 예약 마감, 잔여석 없음',
      enabled: true,
      lastState: 'unavailable',
      lastChecked: ''
    },
    {
      id: 'preset-marathon',
      name: '서울 하프 마라톤 참가 신청',
      url: 'https://seoulhalfmarathon.chosun.com/',
      interval: 60000, // 1분
      keywordsAvail: '접수중, 신청하기, 추가접수',
      keywordsUnavail: '마감, 접수 종료, 정원 초과',
      enabled: false,
      lastState: 'unknown',
      lastChecked: ''
    },
    {
      id: 'preset-camping',
      name: '난지캠핑장 예약 페이지',
      url: 'https://yeyak.seoul.go.kr/web/main.do',
      interval: 300000, // 5분
      keywordsAvail: '예약신청, 가능, 잔여',
      keywordsUnavail: '예약불가, 대기마감, 완료',
      enabled: true,
      lastState: 'unavailable',
      lastChecked: ''
    }
  ];

  const StorageManager = {
    /**
     * 감시 대상 목록 로드
     */
    loadMonitors: function() {
      const raw = localStorage.getItem(MONITORS_KEY);
      if (!raw) {
        // 초기 데이터가 없는 경우 빈 배열 리턴
        return [];
      }
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error('Failed to parse monitors from localStorage:', e);
        return [];
      }
    },

    /**
     * 감시 대상 목록 저장
     */
    saveMonitors: function(monitors) {
      localStorage.setItem(MONITORS_KEY, JSON.stringify(monitors));
    },

    /**
     * 기본 프리셋 데이터 로드 및 저장
     */
    loadPresetMonitors: function() {
      const current = this.loadMonitors();
      // 기존 목록과 합치되 ID 중복 방지
      const merged = [...current];
      PRESET_MONITORS.forEach(preset => {
        if (!merged.some(m => m.id === preset.id || m.name === preset.name)) {
          // 프리셋 복사본 추가 (원본 변경 방지)
          merged.push({ ...preset, id: 'preset-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5) });
        }
      });
      this.saveMonitors(merged);
      return merged;
    },

    /**
     * 설정 로드 (테마, 감시 모드)
     */
    loadSettings: function() {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const defaultSettings = {
        theme: 'light',
        isSimulationMode: true
      };
      if (!raw) return defaultSettings;
      try {
        return { ...defaultSettings, ...JSON.parse(raw) };
      } catch (e) {
        return defaultSettings;
      }
    },

    /**
     * 설정 저장
     */
    saveSettings: function(settings) {
      const current = this.loadSettings();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
    }
  };

  // 전역 스코프에 노출
  window.StorageManager = StorageManager;
})();
