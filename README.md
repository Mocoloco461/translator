# Hover Translator (EN → Any)

A simple, lightweight Chrome Extension to translate text instantly. Supports **Hover Translation** and **Right-Click Context Menu**, with a modern dark-mode UI.

## Features

-   **Hover Translation**: Simply highlight text and wait, or hover over selection to see translation instantly.
-   **Context Menu**: Right-click any text and select "Translate Selection".
-   **130+ Languages**: Supports all Google Translate languages (Afrikaans to Zulu).
-   **Auto-Detection**: Automatically detects the source language.
-   **Dark Mode UI**: Beautiful glassmorphism design that fits any website.

## Installation

Since this is a developer extension, you need to load it manually:

1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Toggle **"Developer mode"** in the top right corner.
3.  Click **"Load unpacked"**.
4.  Select the folder containing these files.

## How to Use

### 1. Set Your Language
The extension defaults to **Hebrew**. To change it:
1.  Click the extension icon in the Chrome toolbar.
2.  Type to search for your desired language (e.g., "Spanish", "French").
3.  Click the language to save it.

### 2. Translate Text
*   **Method A (Hover)**: Highlight any text on a page. The translation will appear in a popup box above the text.
*   **Method B (Right-Click)**: Right-click selected text > "Translate Selection".

### 3. Close Popup
*   The popup automatically disappears after a few seconds.
*   Hover over the popup to keep it open.
*   Click the **"X"** button to close it immediately.

## Translation API

This extension uses **Google Translate's unofficial public API** for translation. Specifically:

-   **API Endpoint**: `https://translate.googleapis.com/translate_a/single`
-   **Authentication**: **No API key or token required** - this is a free, public endpoint
-   **Client Parameter**: Uses `client=gtx` to access Google's free translation service
-   **Source Language**: Set to `auto` for automatic detection
-   **Target Language**: Configurable through the extension popup (defaults to Hebrew)

**Important Notes:**
-   This is an **unofficial API** endpoint that Google provides for their own web services
-   No authentication, registration, or API limits to worry about
-   The API is free and doesn't require any API tokens or credentials
-   Translation happens directly from the browser without any intermediary servers

## Troubleshooting

**"Extension context invalidated" / Error Messages**
If you recently installed or updated the extension, existing web pages won't recognize it.
*   **Fix**: Refresh the web page (F5 / Cmd+R) to reload the extension scripts.

**Popup not showing?**
*   Some strict websites block unauthorized scripts. The extension uses a background proxy to bypass most restrictions, but extremely secure pages (like specific banking sites or `chrome://` pages) may still block it.
