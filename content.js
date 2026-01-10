console.log("Hover Translator Loaded");

/* =========================
   Global State
========================= */

let hoverHost = null;
let cleanupHover = null;

/* =========================
   Global Click → Close Popup
========================= */

document.addEventListener("mousedown", (e) => {
  // If popup exists and click is inside it, do nothing
  if (hoverHost && hoverHost.contains(e.target)) return;

  // Otherwise, close the popup
  if (cleanupHover) cleanupHover();
});

/* =========================
   Mouse Up → Create Translation
========================= */

document.addEventListener("mouseup", async (e) => {
  // Ignore mouseup events coming from the popup itself
  if (hoverHost && hoverHost.contains(e.target)) return;

  const selection = window.getSelection();
  const text = selection.toString().trim();

  // No real text selected → do nothing
  if (!text || text.length < 2) return;

  // Check if extension is enabled
  const { extensionEnabled } = await chrome.storage.sync.get("extensionEnabled");
  const isEnabled = extensionEnabled !== undefined ? extensionEnabled : true;
  if (!isEnabled) return;

  // Remove existing popup before showing a new one
  if (cleanupHover) cleanupHover();

  try {
    // Send translation request to background script
    chrome.runtime.sendMessage(
      { type: "TRANSLATE", text },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime Error:", chrome.runtime.lastError);
          if (
            chrome.runtime.lastError.message.includes(
              "Extension context invalidated"
            )
          ) {
            alert("Please refresh this page to allow the updated extension to run.");
          }
          return;
        }

        if (!response) return;

        const isError = response.startsWith("Error:");
        showHoverResult(response, e.pageX, e.pageY, isError, text);
      }
    );
  } catch (err) {
    console.error("Content Script Error:", err);
  }
});

/* =========================
   Popup Rendering
========================= */

function showHoverResult(text, x, y, isError, originalText) {
  // Safety cleanup
  if (hoverHost) hoverHost.remove();

  hoverHost = document.createElement("div");
  hoverHost.id = "hover-translator-host";

  Object.assign(hoverHost.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "2147483647",
    pointerEvents: "none",
  });

  document.body.appendChild(hoverHost);

  const shadow = hoverHost.attachShadow({ mode: "open" });

  /* =========================
     Styles
  ========================= */

  const style = document.createElement("style");
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                   Roboto, Helvetica, Arial, sans-serif;
      max-width: 300px;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.2s ease-out, transform 0.2s ease-out;
      pointer-events: auto;
      font-size: 14px;
      line-height: 1.5;
      cursor: move;
      user-select: none;
    }

    .card.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .card.error {
      border-color: #ff4444;
      background: rgba(50, 10, 10, 0.95);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;
    }

    .card-content {
      flex: 1;
    }

    .speaker-btn {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      padding: 6px;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .speaker-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .speaker-btn:active {
      background: rgba(255, 255, 255, 0.3);
    }

    .speaker-btn svg {
      width: 16px;
      height: 16px;
    }
  `;
  shadow.appendChild(style);

  /* =========================
     Card
  ========================= */

  const card = document.createElement("div");
  card.className = "card" + (isError ? " error" : "");

  const header = document.createElement("div");
  header.className = "card-header";

  const content = document.createElement("div");
  content.className = "card-content";
  content.textContent = text;
  header.appendChild(content);

  // Add speaker button only if we have original text and it's not an error
  if (originalText && !isError) {
    const speakerBtn = document.createElement("button");
    speakerBtn.className = "speaker-btn";
    speakerBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
    `;
    speakerBtn.title = "Pronounce in English";
    speakerBtn.onclick = (e) => {
      e.stopPropagation();
      const utterance = new SpeechSynthesisUtterance(originalText);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    };
    header.appendChild(speakerBtn);
  }

  card.appendChild(header);

  // Initial position near cursor
  card.style.top = `${y + 15}px`;
  card.style.left = `${x}px`;

  shadow.appendChild(card);
  requestAnimationFrame(() => card.classList.add("visible"));

  /* =========================
     Drag Logic
  ========================= */

  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  card.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = card.getBoundingClientRect();
    initialLeft = rect.left + window.scrollX;
    initialTop = rect.top + window.scrollY;

    card.style.transition = "none";
    e.preventDefault();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function onMouseMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    card.style.left = `${initialLeft + dx}px`;
    card.style.top = `${initialTop + dy}px`;
  }

  function onMouseUp() {
    isDragging = false;
    card.style.transition = "opacity 0.2s ease-out, transform 0.2s ease-out";

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  /* =========================
     Cleanup Handling
  ========================= */

  cleanupHover = () => {
    if (hoverHost) {
      hoverHost.remove();
      hoverHost = null;
    }
    cleanupHover = null;
  };
}