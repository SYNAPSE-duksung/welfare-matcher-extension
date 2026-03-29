🧩 Chrome Extension (Frontend)

사용자가 정부24 사이트에 접속했을 때 화면을 분석하고, 백엔드 API와 통신하여 복지 혜택 매칭 결과를 화면에 띄워주는 크롬 확장 프로그램입니다.

🛠️ 기술 스택

Vanilla JavaScript (ES6+), HTML, CSS

Chrome Extension Manifest V3

WebGPU (가벼운 로컬 SLM 구동 및 개인정보 마스킹용 - 도입 예정)

🚀 로컬 브라우저 설치 및 테스트 방법

크롬 브라우저를 열고 주소창에 chrome://extensions/를 입력하여 접속합니다.

우측 상단의 [개발자 모드] 토글을 켭니다.

좌측 상단의 [압축해제된 확장 프로그램을 로드합니다] 버튼을 클릭합니다.

이 저장소의 gg-welfare-project/extension 폴더를 선택합니다.

브라우저 우측 상단 퍼즐 모양 아이콘을 눌러 에이전트를 고정(Pin)합니다.

🔄 코드 수정 후 반영 방법

HTML/CSS를 수정했다면 브라우저를 새로고침하면 바로 반영됩니다.

background.js 등 백그라운드 스크립트를 수정했다면, chrome://extensions/ 페이지에서 해당 확장 프로그램의 새로고침(🔄) 버튼을 눌러주어야 변경 사항이 적용됩니다.

🎯 테스트 타겟 페이지

개발 시 아래 정부24 화면에서 에이전트가 정상 작동하는지 확인합니다.

타겟 URL: https://www.gov.kr/portal/rcvfvrSvc/... (상세 주소 추가 필요)