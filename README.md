# BigQuery Release Notes Explorer & Tweet Studio

A sleek, premium web application built with Python Flask and vanilla CSS/JavaScript that ingests the Google Cloud BigQuery Atom feed, normalizes daily grouped updates into searchable log items, and provides a customized Tweet Studio workspace to draft and share updates on Twitter/X.

## 🚀 Key Features

*   **Granular Parsing:** Normalizes feed XML entries into separate, standalone updates based on category tags (`Feature`, `Announcement`, `Issue`, `Fix`, `Deprecated`).
*   **Offline Caching:** Implements a 1-hour automatic local JSON cache with automated offline fallback (serves expired data if the Google Cloud network feed is unreachable).
*   **Dynamic Categorization & Search:** Real-time query matching, category-based pills, and date sorting.
*   **Tweet Studio Workspace:**
    *   Generates custom templates containing headings, dates, cleaned descriptions, hashtags, and alternate source links.
    *   **Auto-Truncation Engine:** Automatically trims description characters to ensure the total draft length stays within X's 280-character limit.
    *   **Live Preview & Progress Ring:** Displays a real-time character limit countdown progress ring and a mockup matching X's visual post cards.
    *   **Web Intent Integration:** 1-click sharing directly to Twitter's native post composer.
*   **Responsive layouts:** Converts from a double-column dashboard on desktop to a slide-up bottom drawer overlay on mobile.

## 🛠️ Technology Stack

*   **Backend:** Python 3.13+, Flask, BeautifulSoup4 (HTML Parsing), ElementTree (XML Parsing)
*   **Frontend:** Vanilla HTML5, CSS3 (Custom design system, radial glows, glassmorphism), JavaScript (ES6+ State Manager)
*   **Icons:** Lucide Icons (CDN)
*   **Fonts:** Google Fonts (Outfit, Plus Jakarta Sans)

## 📁 Repository Structure

```
├── app.py                     # Flask application & API Controller
├── requirements.txt           # Python package dependencies
├── release_notes_cache.json   # Local file-based caching database (Auto-generated)
├── templates/
│   └── index.html             # Application dashboard HTML layout
└── static/
    ├── css/
    │   └── style.css          # Core CSS variables, typography, animations
    └── js/
        └── main.js            # Frontend event listeners & state managers
```

## ⚙️ Local Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/YuInH/YuInH-event-talks-app.git
    cd YuInH-event-talks-app
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    # On Windows:
    python -m venv .venv
    .venv\Scripts\activate

    # On macOS/Linux:
    python3 -m venv .venv
    source .venv/bin/activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the Flask development server:**
    ```bash
    python app.py
    ```

5.  **Open the dashboard:**
    Open your browser and navigate to `http://127.0.0.1:5000`.

## 🔄 How Caching & Normalization Work

When a request is sent to the server:
1.  **Staleness Check:** If a valid `release_notes_cache.json` exists and was written less than 1 hour ago, the server reads it immediately (under 5ms response time).
2.  **External Sync:** If expired (or forced by a manual refresh), it downloads `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`.
3.  **BeautifulSoup Parsing:** Google writes multiple updates per day under a single XML `<entry>`. The backend splits the raw HTML string using `<h3>` header boundaries to isolate individual changes into dedicated JSON items containing custom metadata.
