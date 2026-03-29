# 💰 welfare-matcher-extension
정부24 사이트에서 사용자의 비식별 정보를 바탕으로 경기도 맞춤형 복지 정책을 자동으로 매칭하고 요약해 주는 크롬 확장 프로그램 및 RAG 기반 백엔드 서비스입니다.

🌟 주요 기능

자동 혜택 매칭: 정부24 화면의 조건(지역, 나이, 가구 구성 등)을 분석하여 놓치기 쉬운 지자체 복지 정책을 추천합니다.

개인정보 보호: 브라우저 로컬(WebGPU)에서 민감 정보를 마스킹한 후 필수 키워드만 서버로 전송합니다.

AI 기반 정책 요약: 수백 페이지의 난해한 PDF 공고문을 Upstage 모델과 Gemini를 통해 이해하기 쉬운 문장으로 요약 제공합니다.

📂 프로젝트 구조 (Monorepo)

본 저장소는 백엔드 서버와 크롬 확장 프로그램을 모두 포함하고 있습니다. 각 파트별 자세한 실행 방법은 해당 폴더의 README.md를 참고하세요.

/backend : FastAPI, ChromaDB, 문서 파싱(Ingestion) 파이프라인

/extension : Chrome Extension 로직 (UI, 문서 화면 캡쳐 등)

/docs : 아키텍처 다이어그램 및 기획 회의록

🤝 협업 가이드 (Git Flow)

새로운 기능 개발 시 feature/기능명 브랜치를 생성합니다. (예: feature/suwon-pdf-ingest)

작업 완료 후 develop 브랜치로 Pull Request를 요청합니다.

리뷰어의 승인(Approve) 후 Merge를 진행합니다.