const searchInput = document.getElementById("search");
const langList = document.getElementById("languages");
const enableToggle = document.getElementById("enableToggle");
const pronunciationToggle = document.getElementById("pronunciationToggle");
let languages = [];

// Load languages, stored selection, and enabled state
Promise.all([
    fetch("languages.json").then(res => res.json()),
    chrome.storage.sync.get(["targetLang", "extensionEnabled", "pronunciationEnabled"])
]).then(([langs, storage]) => {
    languages = langs;
    renderList(languages, storage.targetLang);
    // Default to enabled if not set
    const isEnabled = storage.extensionEnabled !== undefined ? storage.extensionEnabled : true;
    enableToggle.checked = isEnabled;
    // Default pronunciation to enabled if not set
    const isPronunciationEnabled = storage.pronunciationEnabled !== undefined ? storage.pronunciationEnabled : true;
    pronunciationToggle.checked = isPronunciationEnabled;
});

function renderList(items, selectedCode) {
    langList.innerHTML = "";
    items.forEach(lang => {
        const li = document.createElement("li");
        li.textContent = `${lang.name} (${lang.code})`;
        if (lang.code === selectedCode) {
            li.classList.add("selected");
            // Scroll to selected item if possible
            setTimeout(() => li.scrollIntoView({ block: "center" }), 0);
        }
        li.addEventListener("click", () => {
            chrome.storage.sync.set({ targetLang: lang.code }, () => {
                renderList(items, lang.code);
            });
        });

        if (lang.code === selectedCode) {
            const checkmark = document.createElement("span");
            checkmark.textContent = "\u2705";
            checkmark.style.color = "green";
            checkmark.style.marginLeft = "auto";
            li.style.display = "flex";
            li.style.justifyContent = "space-between";
            li.style.alignItems = "center";
            li.appendChild(checkmark);
        }

        langList.appendChild(li);
    });
}

searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = languages.filter(l =>
        l.name.toLowerCase().includes(query) ||
        l.code.toLowerCase().includes(query)
    );
    // Maintain selection highlighting logic requires reading storage again or tracking state
    // For simplicity, just render filtered list. 
    // Optimization: pass current selected from DOM or memory.
    chrome.storage.sync.get("targetLang", ({ targetLang }) => {
        renderList(filtered, targetLang);
    });
});

// Handle toggle state changes
enableToggle.addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ extensionEnabled: isEnabled }, () => {
        console.log("Extension enabled state set to:", isEnabled);
    });
});

// Handle pronunciation toggle state changes
pronunciationToggle.addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ pronunciationEnabled: isEnabled }, () => {
        console.log("Pronunciation enabled state set to:", isEnabled);
    });
});