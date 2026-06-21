/**
 * NotificationManager
 * 브라우저 시스템 알림 및 알림음(Web Audio API) 재생을 관리하는 모듈입니다.
 */
(function() {
  const NotificationManager = {
    /**
     * 알림 지원 여부 확인
     */
    isSupported: function() {
      return 'Notification' in window;
    },

    /**
     * 알림 권한 획득 확인
     */
    getPermissionState: function() {
      if (!this.isSupported()) return 'denied';
      return Notification.permission;
    },

    /**
     * 알림 권한 요청
     */
    requestPermission: function(callback) {
      if (!this.isSupported()) {
        if (callback) callback('unsupported');
        return;
      }

      Notification.requestPermission().then(permission => {
        if (callback) callback(permission);
      });
    },

    /**
     * Web Audio API를 사용해 맑고 청아한 알림 효과음 합성 및 재생
     */
    playChime: function() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        
        // 멜로디 노트 재생 헬퍼 함수
        const playNote = (frequency, startTime, duration) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.type = 'sine'; // 부드러운 사인파 사용
          osc.frequency.setValueAtTime(frequency, startTime);
          
          // 볼륨 엔벨로프 (시작은 부드럽게 키우고, 끝은 자연스럽게 감쇠)
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.04);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        
        // C 메이저 아르페지오 (도-솔-도) 음향
        playNote(523.25, now, 0.4);        // C5 (도)
        playNote(783.99, now + 0.1, 0.4);  // G5 (솔)
        playNote(1046.50, now + 0.2, 0.6); // C6 (높은 도)
      } catch (e) {
        console.warn('Web Audio API chime play blocked by browser policy:', e);
      }
    },

    /**
     * 시스템 브라우저 알림 전송 및 클릭 이벤트 핸들링
     */
    show: function(title, body, targetUrl) {
      // 1. 소리 알림 재생 (권한과 상관없이 오디오 컨텍스트 실행 가능 시 실행)
      this.playChime();

      // 2. 알림창 띄우기 (권한 상태 확인)
      if (this.getPermissionState() !== 'granted') {
        console.info('Notification permission is not granted. Sound played, but banner skipped.');
        return;
      }

      try {
        const notification = new Notification(title, {
          body: body,
          icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234f46e5"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 14h-2v-6h2v6zm0-8h-2V6h2v2z"/></svg>'
        });

        // 알림 클릭 시 해당 예약 페이지 새 창 열기
        notification.onclick = function(event) {
          event.preventDefault();
          window.open(targetUrl, '_blank');
          notification.close();
        };
      } catch (e) {
        console.error('Failed to dispatch notification:', e);
      }
    }
  };

  window.NotificationManager = NotificationManager;
})();
