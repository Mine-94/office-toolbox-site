(function () {
  const textInput = document.getElementById("qr-text");
  if (!textInput) return;

  const generateBtn = document.getElementById("generate-btn");
  const loadingView = document.getElementById("loading");
  const resultView = document.getElementById("result");
  const errorView = document.getElementById("error");
  const errorTextEl = document.getElementById("error-text");
  const qrImage = document.getElementById("qr-image");
  const downloadLink = document.getElementById("download-link");

  function showExtra(view) {
    [loadingView, resultView, errorView].forEach((v) => v.classList.add("hidden"));
    if (view) view.classList.remove("hidden");
  }

  generateBtn.addEventListener("click", async () => {
    const text = textInput.value.trim();
    if (!text) {
      errorTextEl.textContent = "텍스트나 URL을 입력해주세요.";
      showExtra(errorView);
      return;
    }

    showExtra(loadingView);

    try {
      const res = await fetch("/api/qr-code/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        errorTextEl.textContent = data.error || "생성 중 오류가 발생했습니다.";
        showExtra(errorView);
        return;
      }
      qrImage.src = data.download_url;
      downloadLink.href = data.download_url;
      showExtra(resultView);
    } catch (err) {
      errorTextEl.textContent = "네트워크 오류가 발생했습니다. 다시 시도해주세요.";
      showExtra(errorView);
    }
  });
})();
