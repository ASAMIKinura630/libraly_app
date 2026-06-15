/**
 * ブラウザ標準の Web Speech API による音声入力（無料・外部API不要）
 * Chrome / Edge 等で利用可能。非対応ブラウザではボタンを無効化する。
 */
(function (global) {
  const SpeechRecognition =
    global.SpeechRecognition || global.webkitSpeechRecognition;

  function attachVoiceButton(button, input) {
    if (!button || !input) return;

    if (!SpeechRecognition) {
      button.disabled = true;
      button.title = "このブラウザは音声入力に対応していません";
      button.setAttribute("aria-label", button.getAttribute("aria-label") + "（非対応）");
      return;
    }

    let recognition = null;
    let listening = false;

    button.addEventListener("click", function () {
      if (listening && recognition) {
        recognition.stop();
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = "ja-JP";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = function () {
        listening = true;
        button.classList.add("is-listening");
        button.setAttribute("aria-pressed", "true");
      };

      recognition.onend = function () {
        listening = false;
        button.classList.remove("is-listening");
        button.setAttribute("aria-pressed", "false");
      };

      recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript.trim();
        if (!transcript) return;
        input.value = transcript;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      };

      recognition.onerror = function (event) {
        console.warn("Speech recognition error:", event.error);
      };

      try {
        recognition.start();
      } catch (err) {
        console.warn(err);
      }
    });
  }

  function initAll(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-voice-for]").forEach(function (btn) {
      const id = btn.getAttribute("data-voice-for");
      const input = document.getElementById(id);
      attachVoiceButton(btn, input);
    });
  }

  global.LibralyVoiceInput = {
    attach: attachVoiceButton,
    initAll: initAll,
    isSupported: !!SpeechRecognition,
  };
})(window);
