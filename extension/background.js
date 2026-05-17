// Ctrl+Shift+Y 단축키 이벤트 핸들러
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "capture-visible-tab") {
    try {
      // 현재 활성 탭 정보 가져오기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Chrome 내부 페이지 체크
      if (!tab || !tab.url) {
        notify("❌ 현재 탭 정보를 가져올 수 없습니다");
        return;
      }
      
      const url = tab.url;
      const blockedProtocols = ['chrome://', 'chrome-extension://', 'devtools://', 'about:', 'edge://'];
      
      if (blockedProtocols.some(protocol => url.startsWith(protocol))) {
        notify("❌ Chrome 내부 페이지에서는 사용할 수 없습니다. 일반 웹페이지(LMS)에서 사용해주세요.");
        return;
      }

      notify("스크린샷 캡처 중...");

      // 현재 활성 탭 캡처
      chrome.tabs.captureVisibleTab(null, { format: "png" }, async (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          console.error("캡처 실패:", chrome.runtime.lastError);
          notify("스크린샷 캡처에 실패했습니다");
          return;
        }

        notify("과제 정보 추출 중...");

        try {
          // MediaPipe로 이미지 분석
          const assignmentInfo = await analyzeImageWithMediaPipe(dataUrl);
          
          if (!assignmentInfo) {
            notify("과제 정보를 추출하지 못했습니다");
            return;
          }

          // 추출된 정보를 사용자에게 표시
          const infoType = assignmentInfo.type === "lecture" ? "녹강" : "과제";
          const dateInfo = assignmentInfo.type === "lecture" && assignmentInfo.startDate
            ? `${assignmentInfo.startDate} ~ ${assignmentInfo.deadline}`
            : assignmentInfo.deadline;
          
          notify(`📋 ${infoType} 정보\n과목: ${assignmentInfo.subject}\n제목: ${assignmentInfo.title}\n기한: ${dateInfo}`);

          // OAuth 토큰으로 Google Calendar에 등록
          await addToGoogleCalendarWithOAuth(assignmentInfo);
          
          notify("Google Calendar에 등록되었습니다!");

        } catch (error) {
          console.error("처리 중 오류:", error);
          notify("오류: " + error.message);
        }
      });

    } catch (error) {
      console.error("전체 프로세스 오류:", error);
      notify("오류가 발생했습니다");
    }
  }
});

// MediaPipe로 이미지 분석
async function analyzeImageWithMediaPipe(dataUrl) {
  // 1. offscreen 문서 생성 (없으면)
  await ensureOffscreenDocument();

  // 2. 메시지 전송 후 응답 대기
  return chrome.runtime.sendMessage({
    type: "RUN_INFERENCE",
    dataUrl: dataUrl
  });
}

// Offscreen 문서 생성
async function ensureOffscreenDocument(){
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"]
  });
  if (existing.length > 0) return;

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["DOM_SCRAPING"],
    justification: "WebGPU LLM inference"
  });
}

// OAuth를 통한 Google Calendar 이벤트 추가
async function addToGoogleCalendarWithOAuth(assignmentInfo) {
  return new Promise((resolve, reject) => {
    console.log("OAuth 토큰 요청 시작...");
    
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError) {
        console.error("OAuth 오류:", chrome.runtime.lastError);
        reject(new Error("OAuth 토큰 획득 실패: " + chrome.runtime.lastError.message));
        return;
      }
      
      if (!token) {
        console.error("토큰이 없음");
        reject(new Error("OAuth 토큰 획득 실패: 토큰이 반환되지 않았습니다"));
        return;
      }

      console.log("토큰 획득 성공, Calendar API 호출 중...");

      try {
        const deadline = new Date(assignmentInfo.deadline);
        let startDateTime, endDateTime;

        // 녹강(lecture)인 경우: 학습 인정 기간 전체를 이벤트로
        if (assignmentInfo.type === "lecture" && assignmentInfo.startDate) {
          const startDate = new Date(assignmentInfo.startDate);
          startDateTime = startDate.toISOString();
          endDateTime = deadline.toISOString();
        } else {
          // 과제(assignment)인 경우: 종료일 시간에만 등록 (시작=종료)
          startDateTime = deadline.toISOString();
          endDateTime = deadline.toISOString();
        }

        const event = {
          summary: `[${assignmentInfo.subject}] ${assignmentInfo.title}`,
          description: `과목: ${assignmentInfo.subject}\n${assignmentInfo.type === "lecture" ? "강의" : "과제"}: ${assignmentInfo.title}\n마감: ${assignmentInfo.deadline}${assignmentInfo.startDate ? `\n시작: ${assignmentInfo.startDate}` : ""}`,
          start: {
            dateTime: startDateTime,
            timeZone: "Asia/Seoul"
          },
          end: {
            dateTime: endDateTime,
            timeZone: "Asia/Seoul"
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 48 * 60 },
              { method: "popup", minutes: 24 * 60 },
              { method: "popup", minutes: 5 * 60 },
              { method: "popup", minutes: 60 }
            ]
          },
          colorId: assignmentInfo.type === "lecture" ? "9" : "11"  // 녹강은 파란색(9), 과제는 빨간색(11)
        };

        console.log("이벤트 데이터:", event);

        const response = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(event)
          }
        );

        console.log("Calendar API 응답 상태:", response.status);

        if (!response.ok) {
          const error = await response.json();
          console.error("Calendar API 오류:", error);
          throw new Error("Calendar 등록 실패: " + (error.error?.message || "알 수 없는 오류"));
        }

        const result = await response.json();
        console.log("Calendar 등록 성공:", result);
        resolve(result);

      } catch (error) {
        console.error("처리 중 오류:", error);
        reject(error);
      }
    });
  });
}

// 알림 표시
function notify(message) {
  console.log("[LMS Reminder]", message);
  
  // 여러 줄 메시지 처리
  const lines = message.split('\n');
  const firstLine = lines[0];
  
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#4285f4" });
  
  // Chrome 알림 생성
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "LMS Reminder",
    message: message,
    priority: 2
  });
  
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, 5000);
}