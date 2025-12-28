// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "translate-selection",
        title: "Translate Selection",
        contexts: ["selection"]
    });
    
    // Initialize default enabled state if not set
    chrome.storage.sync.get("extensionEnabled", ({ extensionEnabled }) => {
        if (extensionEnabled === undefined) {
            chrome.storage.sync.set({ extensionEnabled: true });
        }
    });
});

// Context Menu Listener
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "translate-selection" && info.selectionText) {
        // Check if extension is enabled
        const { extensionEnabled } = await chrome.storage.sync.get("extensionEnabled");
        const isEnabled = extensionEnabled !== undefined ? extensionEnabled : true;
        
        if (!isEnabled) {
            // Extension is disabled, do nothing
            return;
        }
        
        // We use the same service, but inject the result directly
        performTranslation(info.selectionText).then(translated => {
            if (translated) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: showTranslationResult,
                    args: [translated]
                });
            }
        });
    }
});

// Message Listener (For Content Script)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "TRANSLATE" && request.text) {
        // Check if extension is enabled
        chrome.storage.sync.get("extensionEnabled", ({ extensionEnabled }) => {
            const isEnabled = extensionEnabled !== undefined ? extensionEnabled : true;
            
            if (!isEnabled) {
                // Extension is disabled, return empty response
                sendResponse("");
                return;
            }
            
            performTranslation(request.text).then(sendResponse);
        });
        return true; // Keep channel open for async response
    }
});

// Centralized Translation Logic
async function performTranslation(text) {
    try {
        const data = await chrome.storage.sync.get("targetLang");
        const tl = data.targetLang || "he";

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const json = await res.json();

        let translated = "";
        if (json && json[0]) {
            json[0].forEach(seg => {
                if (seg && seg[0]) translated += seg[0];
            });
        }
        return translated;
    } catch (err) {
        console.error("Translation failed:", err);
        return `Error: ${err.message}`; // Return error to caller
    }
}

// Result UI (Injected via Scripting)
function showTranslationResult(text) {
    const existingHost = document.getElementById("ctx-translator-host");
    if (existingHost) existingHost.remove();

    const host = document.createElement("div");
    host.id = "ctx-translator-host";
    Object.assign(host.style, {
        position: "fixed", top: "0", left: "0", width: "0", height: "0",
        zIndex: "2147483647", pointerEvents: "none"
    });
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    // Removed external @import to prevent CSP blocking
    style.textContent = `
        .container {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            min-width: 320px;
            max-width: 600px;
            background: rgba(20, 20, 25, 0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 24px;
            color: #fff;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .container.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; font-weight: 600; }
        .content { font-size: 16px; line-height: 1.6; color: #f3f4f6; }
        .close-btn { background: none; border: none; color: #6b7280; cursor: pointer; padding: 4px; border-radius: 4px; transition: color 0.2s; display: flex; align-items: center; justify-content: center; }
        .close-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
        svg { width: 20px; height: 20px; }
    `;
    shadow.appendChild(style);

    const container = document.createElement("div");
    container.className = "container";
    container.innerHTML = `
        <div class="header">
            <span class="title">Translation</span>
            <button class="close-btn" id="close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
        <div class="content">${text}</div>
    `;
    shadow.appendChild(container);

    requestAnimationFrame(() => container.classList.add("visible"));

    const close = () => {
        container.classList.remove("visible");
        container.style.transform = "translateX(-50%) translateY(-10px)";
        setTimeout(() => host.remove(), 400);
    };

    container.querySelector("#close").onclick = close;
    let timer = setTimeout(close, 6000);
    container.onmouseenter = () => clearTimeout(timer);
    container.onmouseleave = () => timer = setTimeout(close, 6000);
}