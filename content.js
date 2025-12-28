console.log("Hover Translator Loaded");

let hoverHost = null;

document.addEventListener("mouseup", async (e) => {
  const text = window.getSelection().toString().trim();
  if (!text) return;

  // Check if extension is enabled
  const { extensionEnabled } = await chrome.storage.sync.get("extensionEnabled");
  const isEnabled = extensionEnabled !== undefined ? extensionEnabled : true;
  
  if (!isEnabled) {
    // Extension is disabled, do nothing
    return;
  }

  // Clear previous if any
  if (hoverHost) {
    hoverHost.remove();
    hoverHost = null;
  }

  try {
    // SEND MESSAGE TO BACKGROUND instead of fetching here
    // This is much safer against CORS/CSP blockages
    chrome.runtime.sendMessage({ type: "TRANSLATE", text: text }, (response) => {
      // Handle connection error (e.g. context invalidated)
      if (chrome.runtime.lastError) {
        console.error("Runtime Error:", chrome.runtime.lastError);
        if (chrome.runtime.lastError.message.includes("Extension context invalidated")) {
          alert("Please refresh this page to allow the updated extension to run.");
        }
        return;
      }

      if (response) {
        if (response.startsWith("Error:")) {
          showHoverResult(response, e.pageX, e.pageY, true);
        } else {
          showHoverResult(response, e.pageX, e.pageY, false);
        }
      }
    });

  } catch (err) {
    console.error("Content Script Error:", err);
  }
});

function showHoverResult(text, x, y, isError) {
  if (hoverHost) hoverHost.remove();

  hoverHost = document.createElement("div");
  hoverHost.id = "hover-translator-host";
  Object.assign(hoverHost.style, {
    position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
    zIndex: "2147483647", pointerEvents: "none"
  });
  document.body.appendChild(hoverHost);

  const shadow = hoverHost.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  // Native fonts only
  style.textContent = `
        .card {
            position: absolute;
            background: rgba(20, 20, 25, 0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
            color: #fff;
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            max-width: 300px;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.2s ease-out;
            pointer-events: auto;
            font-size: 14px;
            line-height: 1.5;
        }
        .card.visible { opacity: 1; transform: translateY(0); }
        .card.error { border-color: #ff4444; background: rgba(50, 10, 10, 0.95); }
    `;
  shadow.appendChild(style);

  const card = document.createElement("div");
  card.className = "card" + (isError ? " error" : "");
  card.textContent = text;

  // Position
  style.textContent += `.card { top: ${y + 15}px; left: ${x}px; }`;

  shadow.appendChild(card);
  requestAnimationFrame(() => card.classList.add("visible"));

  // Remove on any click
  const removeHover = () => {
    if (hoverHost) {
      card.classList.remove("visible");
      setTimeout(() => { if (hoverHost) hoverHost.remove(); hoverHost = null; }, 200);
    }
    document.removeEventListener("click", removeHover);
  };

  // Add listener after a short delay to avoid immediate removal from the selection click
  setTimeout(() => {
    document.addEventListener("click", removeHover);
  }, 100);
}