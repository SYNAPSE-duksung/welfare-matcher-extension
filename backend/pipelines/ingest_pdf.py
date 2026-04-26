# ingest_pdf.py
# raw data(원본 pdf)로부터 벡터 데이터베이스를 생성하는 로직 코드

# 1. Upstage API를 사용하여 PDF를 읽고 마크다운 형식의 Document 객체 리스트로 반환
# 2. 로드한 문서를 LLM이 처리하기 적절한 크기의 청크(Chunk)로 분할
# 3. chunking한 텍스트를 벡터화하여 ChromaDB에 저장
 
import os
import requests
from dotenv import load_dotenv

from langchain_core.documents import Document
from langchain_text_splitters import MarkdownTextSplitter
from langchain_chroma import Chroma
from langchain_upstage import UpstageEmbeddings


load_dotenv()

# 1. PDF -> 마크다운 형식의 Document 객체 리스트
def load_pdf_to_doc_by_python(file_path):
    api_key = os.getenv("UPSTAGE_API_KEY")

    # Document Parse API
    url = "https://api.upstage.ai/v1/document-ai/document-parse"
    
    headers = {"Authorization": f"Bearer {api_key}"}
    
    data = {
        "ocr": "auto",
        "output_format": "markdown",
        "model": "document-parse",
        "merge_multipage_tables": "true" 
    }

    with open(file_path, "rb") as f:
        files = {"document": f}
        response = requests.post(url, headers=headers, files=files, data=data)
    result = response.json()
    markdown_text=result.get("content", {}).get("markdown", "내용 없음")
    print(markdown_text)
    # print(response.text)

    # 랭체인 Document 객체로 반환
    langchain_docs = [
    Document(page_content=markdown_text, metadata={"source": "document.pdf"})
    ]

    return langchain_docs

# 2. Chunking 실시
def split_documents(docs):
    print("텍스트 청킹 시작...")

    markdown_splitter = MarkdownTextSplitter(
        chunk_size=1200,
        chunk_overlap=150
    )

    chunked_docs = markdown_splitter.split_documents(docs)

    print(f"총 {len(chunked_docs)}개의 청크로 분할 완료")

    # dev: 청킹된 결과 확인
    if chunked_docs:
        print("\n[미리보기: 첫 번째 청크]")
        print("-" * 50)
        print(chunked_docs[0].page_content)
        print("-" * 50 + "\n")
        print("\n[미리보기: 두 번째 청크]")
        print("-" * 50)
        print(chunked_docs[1].page_content)
        print("-" * 50 + "\n")
        
    return chunked_docs

# 3. Chunking text -> Chroma DB
def save_to_chroma_db(chunked_docs, db_path="vector_db"):
    if not chunked_docs:
        print("텍스트 청크가 존재하지 않음")
        return
    
    print("벡터화(Embedding) 및 Chroma DB 저장 시작 (경로: {db_path})")

    embeddings = UpstageEmbeddings(model="solar-embedding-1-large")

    vector_db=Chroma.from_documents(
        documents=chunked_docs,
        embedding=embeddings,
        persist_directory=db_path
    )

    print(f"모든 데이터가 '{db_path}' 폴더에 저장되었습니다")

    return vector_db


if __name__ == "__main__":
    file_path = "data/test_data/test3.pdf"

    db_directory = "vector_db"
    
    file_docs = load_pdf_to_doc_by_python(file_path)
    chunks=split_documents(file_docs)
    save_to_chroma_db(chunks, db_directory)