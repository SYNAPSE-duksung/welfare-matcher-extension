document.addEventListener("DOMContentLoaded", () => {
  const status = document.getElementById("status");

  function showStatus(message, type) {
    status.innerHTML = message;
    status.className = `status ${type}`;
  }

  // 확장 로드 시 정상 안내 메시지 표시
  showStatus('LMS 페이지에서 <strong>Ctrl+Shift+Y</strong>를 눌러 캡처하세요.', "info");
});