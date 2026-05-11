document.addEventListener("DOMContentLoaded", async () => {
  const keyInput = document.getElementById("apikey");
  const saveBtn = document.getElementById("save");
  const deleteBtn = document.getElementById("deleteKey");
  const keyControls = document.getElementById("keyControls");
  const authStatus = document.getElementById("authStatus");

  // 요소 존재 여부 확인
  if (!keyInput || !saveBtn || !deleteBtn) {
    console.error("필요한 DOM 요소를 찾을 수 없습니다");
    return;
  }

  // 저장된 Gemini API 키 확인
  chrome.storage.local.get("geminiKey", (result) => {
    if (result.geminiKey) {
      keyControls.style.display = "none";
      deleteBtn.style.display = "block";
      showStatus("API 키가 설정되었습니다. Ctrl+Shift+Y로 캡처하세요!", "success");
    }
  });

  // Gemini API 키 저장
  saveBtn.onclick = () => {
    const key = keyInput.value.trim();
    if (!key) {
      showStatus("API 키를 입력해주세요", "error");
      return;
    }
    chrome.storage.local.set({ geminiKey: key }, () => {
      keyControls.style.display = "none";
      deleteBtn.style.display = "block";
      showStatus("Gemini API 키가 저장되었습니다", "success");
    });
  };

  // Gemini API 키 삭제
  deleteBtn.onclick = () => {
    chrome.storage.local.remove("geminiKey", () => {
      keyInput.value = "";
      keyControls.style.display = "block";
      deleteBtn.style.display = "none";
      showStatus("Gemini API 키가 삭제되었습니다", "info");
    });
  };

  function showStatus(message, type) {
    if (!authStatus) return;
    authStatus.textContent = message;
    authStatus.className = `status ${type}`;
    authStatus.style.display = "block";
    setTimeout(() => {
      authStatus.style.display = "none";
    }, 5000);
  }
});