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

      // Gemini API 키 확인
      const geminiKey = await getStorageKey("geminiKey");
      if (!geminiKey) {
        notify("Gemini API 키를 먼저 설정해주세요");
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
          // Gemini API로 이미지 분석
          const assignmentInfo = await analyzeImageWithGemini(dataUrl, geminiKey);
          
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

// Storage에서 키 가져오기
function getStorageKey(keyName) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keyName, (result) => {
      resolve(result[keyName]);
    });
  });
}

// Gemini API로 이미지 분석
async function analyzeImageWithGemini(dataUrl, apiKey, retryCount = 0) {
  const base64Data = dataUrl.split(',')[1];
  const MAX_RETRIES = 3;

  const prompt = `다음 이미지는 대학교 LMS(학습관리시스템) 화면입니다. 
이미지에서 다음 정보를 정확히 추출해주세요:
1. 과목명 (subject) - 예: "게임프로그래밍실습[02]"
2. 과제명/강의명 (title) - 예: "11월11일 실습 제출" 또는 "4장, 순서회로 과제"
3. 과제 타입 (type) - "assignment"(과제/퀴즈) 또는 "lecture"(녹강/동영상)
4. 종료 기한 (deadline) - "YYYY-MM-DD HH:MM" 형식
5. 시작 기한 (startDate) - 녹강인 경우 "학습 인정 기간" 시작일, "YYYY-MM-DD HH:MM" 형식. 과제인 경우 null

이미지에서 보이는 정보:
- 제목, 과목명에서 과목명과 과제명 추출
- "학습 인정 기간"이 있으면 type은 "lecture", 시작일과 종료일 모두 추출
- "제출 마감", "종료일시" 등이 있으면 type은 "assignment", 종료일만 추출

반드시 아래 JSON 형식으로만 답변하고, 다른 설명은 포함하지 마세요:
{
  "subject": "과목명",
  "title": "과제명",
  "type": "assignment",
  "deadline": "2025-11-11 20:00",
  "startDate": null
}

또는

{
  "subject": "과목명",
  "title": "강의명",
  "type": "lecture",
  "deadline": "2025-11-03 23:59",
  "startDate": "2025-10-27 00:00"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: "image/png",
                  data: base64Data
                }
              }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    
    // 에러 처리 (재시도 가능한 에러들)
    if (data.error) {
      const retryableErrors = [
        "RESOURCE_EXHAUSTED",
        "UNAVAILABLE", 
        "INTERNAL",
        "The model is overloaded"
      ];
      
      const shouldRetry = retryableErrors.some(err => 
        data.error.status === err || 
        (data.error.message && data.error.message.includes(err))
      );
      
      if (shouldRetry && retryCount < MAX_RETRIES) {
        const waitTime = Math.pow(2, retryCount + 1) * 1000; // 2초, 4초, 8초
        console.log(`Gemini API 일시적 오류 (${data.error.message}). ${waitTime/1000}초 후 재시도... (${retryCount + 1}/${MAX_RETRIES})`);
        notify(`⏳ 서버 과부하. ${waitTime/1000}초 후 재시도 중...`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return analyzeImageWithGemini(dataUrl, apiKey, retryCount + 1);
      }
      
      throw new Error(`Gemini API 오류: ${data.error.message || data.error.status}`);
    }
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error("Gemini API 응답이 없습니다");
    }

    console.log("Gemini 응답:", text);

    // JSON 추출
    let jsonText = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const info = JSON.parse(jsonText);
    
    if (!info.subject || !info.title || !info.deadline) {
      console.error("필수 정보 누락:", info);
      return null;
    }

    // type이 없으면 기본값 설정
    if (!info.type) {
      info.type = "assignment";
    }

    return info;
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("JSON 파싱 실패:", error);
      return null;
    }
    throw error;
  }
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