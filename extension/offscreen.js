const { FilesetResolver, LlmInference } = exports;

(async () => {
    const genai = await FilesetResolver.forGenAiTasks(
        // path/to/wasm/root
        chrome.runtime.getURL("vendor")
    );

    llmInference = await LlmInference.createFromOptions(genai, {
        baseOptions: {
            modelAssetPath: chrome.runtime.getURL('assets/gemma-3n-E2B-it-int4-Web.litertlm')
        },
        maxTokens: 1000,
        topK: 40,
        temperature: 0.5,
        randomSeed: 101,
        maxNumImages: 5,
        supportAudio: false,
    });

    const PROMPT = `다음 이미지는 대학교 LMS(학습관리시스템) 화면입니다. 
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

    // background.js에서 메시지 오면 추론 실행
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type !== "RUN_INFERENCE") return;

        const img = new Image();
        img.src = message.dataUrl;
        img.onload = async() => {
            try{
                const response = await llmInference.generateResponse([
                    "<start_of_turn>user\n",
                    PROMPT,
                    img,
                    "<end_of_turn>\n<start_of_turn>model\n",
                ]);
                console.log("[Offscreen] 모델 응답: ", response);
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                const info = JSON.parse(jsonMatch[0]);
                sendResponse({success: true, data: info});
            }
            catch(error){
                console.error("[Offscreen] 추론 오류: ", error);
                sendResponse({success: false, error: error.message});
            }
        }; 
        return true; 
    })
})();