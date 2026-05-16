import os
from dotenv import load_dotenv

from langchain_chroma import Chroma
# from langchain_upstage import UpstageEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR=os.path.join(BASE_DIR, "vector_db")

# ingest_pdf.py에서 정의한 것과 동일한 커스텀 임베딩 클래스 생성
class CustomGoogleEmbeddings(GoogleGenerativeAIEmbeddings):
    def embed_documents(self, texts):
        embeddings = []
        for text in texts:
            try:
                embedding = self.embed_query(text)
                embeddings.append(embedding)
            except Exception as e:
                print(f"Embedding 실패: {e}")
                raise
        return embeddings

def main():
    print("RAG 시스템 테스트..\n")

    # 1. ChromaDB 불러오기
    # 저장 시 사용했던 임베딩 모델과 같은 모델
    # embeddings = UpstageEmbeddings(model="solar-embedding-1-large")
    embeddings = CustomGoogleEmbeddings(
        model="gemini-embedding-2",
        google_api_key=os.getenv("GEMINI_API_KEY")
    )
    vector_db = Chroma(
        persist_directory=DB_DIR, 
        embedding_function=embeddings,
        collection_name="documents"
    )

    # Retriever 생성 - 검색 시, 질문과 유사한 문서 k개를 가져오는 검색기
    retriever = vector_db.as_retriever(search_kwargs={"k":3})
    print("vector DB 연동 완료")


    # 2. LLM 로드 - gemini-2.5-flash
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.1, # 답변의 일관성을 위해 낮게 설정
        api_key=os.getenv("GEMINI_API_KEY")
    )
    print("LLM 로드 완료")


    # 3. prompt
    system_prompt=(
        "당신은 경기도 복지 정책을 안내해주는 친절한 AI 에이전트 입니다.\n"
        "아래 제공된 [참고 문서]만을 바탕으로 사용자에게 적합한 복지 정책을 답변해주세요.\n"
        "문서에 없는 내용이라면 '제공된 문서에서 해당 정보를 찾을 수 없습니다.'라고 답변하세요.\n"
        "답변은 가독성 좋게 글머리 기호 등을 사용하여 정리해주세요.\n"
        "\n"
        "[참고 문서]\n"
        "{context}"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])


    # 4. RAG chain 완성
    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    rag_chain = create_retrieval_chain(retriever, question_answer_chain)

    print("\n" + "=====================================")
    # query = "수원시의 정신 건강 지원금의 지원 대상과 지원 금액에 대해서 알려줘."
    query = "안성시의 정신 건강 지원금 사업 문의처에 대해서 알려줘."
    # query = "경기도 버스 운수종사자 양성 사업은 어디에 문의해야돼?"
    # query = "16세의 경기도 청소년이 받을 수 있는 지원 사업이 있나요?"
    # query = "숙련건설기능인력 교육훈련 신청 방법"
    print(f"질문: {query}")
    print("-"*50)

    response = rag_chain.invoke({"input": query})

    print(f"답변: {response["answer"]}")
    print("="*50)

    print("\n 참고한 문서 청크 목록:")
    for i, doc in enumerate(response["context"]):
        print(f"{i+1}. 출처: {doc.metadata.get('source')} (내용 일부: {doc.page_content[:50]}...)")

if __name__ == "__main__":
    main()