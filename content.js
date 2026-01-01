console.log("Hover Translator Loaded");

let hoverHost = null;
let cleanupHover = null; // Global cleanup function to prevent zombie listeners

document.addEventListener("mouseup", async (e) => {
  // If clicking on the existing popup (shadow DOM host), ignore
  // This prevents the "drag release" from triggering a new translation
  if (hoverHost && e.target === hoverHost) return;

  const text = window.getSelection().toString().trim();
  if (!text) return;

  // Check if extension is enabled
  const { extensionEnabled } = await chrome.storage.sync.get("extensionEnabled");
  const isEnabled = extensionEnabled !== undefined ? extensionEnabled : true;

  if (!isEnabled) {
    // Extension is disabled, do nothing
    return;
  }

  // Clear previous if any, using the robust cleanup
  if (cleanupHover) {
    cleanupHover();
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
  // Double check cleanup
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
            transition: opacity 0.2s ease-out, transform 0.2s ease-out;
            pointer-events: auto;
            font-size: 14px;
            line-height: 1.5;
            cursor: move; /* Indicate draggable */
            user-select: none; /* Prevent text selection during drag start */
        }
        .card.visible { opacity: 1; transform: translateY(0); }
        .card.error { border-color: #ff4444; background: rgba(50, 10, 10, 0.95); }
        
        .close-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 16px;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            padding: 0;
        }
        .close-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
        }
    `;
  shadow.appendChild(style);

  const card = document.createElement("div");
  card.className = "card" + (isError ? " error" : "");

  // Close Button
  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.textContent = "×";
  // Stop propagation to prevent drag start when clicking close
  closeBtn.addEventListener("mousedown", (e) => e.stopPropagation());
  card.appendChild(closeBtn);

  const content = document.createElement("div");
  content.textContent = text;
  // Add padding to content to avoid overlap with close button
  content.style.paddingRight = "20px";
  card.appendChild(content);

  // Position
  card.style.top = `${y + 15}px`;
  card.style.left = `${x}px`;

  shadow.appendChild(card);
  requestAnimationFrame(() => card.classList.add("visible"));

  // Drag Logic
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  // Attach drag listener to the CARD itself
  card.addEventListener("mousedown", (e) => {
    // Don't drag if clicking buttons/interactive elements
    if (e.target.tagName === 'BUTTON') return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = card.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    // Remove transition during drag for responsiveness
    card.style.transition = "none";

    e.preventDefault(); // Prevent selection

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  const onMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    card.style.left = `${initialLeft + dx}px`;
    card.style.top = `${initialTop + dy}px`;
  };

  const onMouseUp = () => {
    isDragging = false;
    // Restore transition
    card.style.transition = "opacity 0.2s ease-out, transform 0.2s ease-out";

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  // Define the cleanup function
  const removeHover = () => {
    if (hoverHost) {
      card.classList.remove("visible");
      // Use a local reference to the host to remove, to avoid race conditions
      const hostToRemove = hoverHost;
      setTimeout(() => {
        if (hostToRemove) hostToRemove.remove();
        if (hoverHost === hostToRemove) hoverHost = null;
      }, 200);
    }
    cleanupHover = null;
  };

  // Close button listener
  closeBtn.addEventListener("click", removeHover);

  // Assign to global cleanup
  cleanupHover = () => {
    // Force remove immediately for cleanup
    if (hoverHost) {
      hoverHost.remove();
      hoverHost = null;
    }
    cleanupHover = null;
  };
}