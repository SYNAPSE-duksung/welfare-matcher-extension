### 🏆 **우리가 개발할 프로토타입(MVP, Minimum Viable Product):**

> **정부24 사이트에서 경기도 복지 정책을 매칭해주는 브라우저 확장 프로그램**
> 

RAG 활용 자료: https://www.gg.go.kr/bbs/board.do?bsIdx=792&menuId=3298#page=1
브라우저 확장 프로그램: https://chromewebstore.google.com/category/extensions?hl=ko

- 시퀀스 다이어그램 mermaid 원본 (수정을 위한 부분)
    
    ```mermaid
    sequenceDiagram
        participant U as 사용자 (정부24 접속)
        participant EX as 브라우저 확장 프로그램 (WebGPU)
        participant L as 로컬 SLM (Gemma-2B/Phi-3)
        participant S as 서버 (RAG Engine)
        participant DB as 경기도 정책 Vector DB
    
        Note over U, EX: [1단계: 데이터 캡처 & 로컬 보안 처리]
        U->>U: 정부24에서 등본/증명서 '출력/미리보기' 클릭
        EX->>U: PDF Stream(Blob) 가로채기 (Intercept)
        EX->>EX: WebGPU 가속 OCR (텍스트 추출)
        EX->>L: 추출된 원본 텍스트 전달
        L->>L: 1. 민감 정보 마스킹 (이름, 상세주소, 주민번호 뒷자리)<br/>2. 비식별 메타데이터 추출 (시/군/구, 소득구간, 가구원수)
        
        Note over EX, S: [2단계: 비식별 쿼리 & 서버 RAG]
        EX->>S: 비식별 메타데이터 전송 (JSON)<br/>"경기도/30대/신혼부부/소득5구간"
        S->>DB: 정책 검색 (Similarity Search)
        DB-->>S: 관련 정책 후보군 (Top 50) 반환
        S-->>EX: 정책 후보 리스트 전송 (Candidates)
    
        Note over EX, L: [3단계: 최종 정밀 매칭 & 리포트]
        EX->>L: 서버에서 온 정책들 + 로컬의 정밀 데이터 대조
        L->>L: 시/군/구 단위 최종 자격 판단 (Local Matching)
        L-->>U: 최종 맞춤 복지 리포트 시각화 (UI Overlay)
    
    ```
    
- **시스템 핵심 흐름 (Data Flow)**
    1. **가로채기:** 사용자가 정부24에서 **주민등록등본**을 발급(미리보기)할 때 PDF 데이터를 메모리에서 가로챔.
    2. **로컬 처리 (WebGPU):** 브라우저 내에서 OCR로 텍스트를 추출하고, LLM(SLM)이 주소(시/군/구), 연령, 가구원 수를 파악함. (민감 정보는 즉시 마스킹)
    3. **서버 쿼리 (RAG):** "경기도/수원시/30대/자녀2"라는 **비식별 키워드**만 서버로 전송.
    4. **정책 매칭:** 서버에 저장된 **경기도 복지 정책 PDF 데이터베이스**에서 최적의 정책 50개를 뽑아 브라우저로 회신.
    5. **최종 리포트:** 브라우저 내에서 사용자의 상세 정보와 정책 조건을 대조하여 최종 결과 출력.