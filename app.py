import os
import json
import time
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "release_notes_cache.json"
CACHE_EXPIRY = 3600  # 1 hour in seconds

def parse_entry_content(entry_date, entry_timestamp, entry_link, entry_base_id, content_html):
    """
    Parses the HTML content of a single release notes entry (a specific day).
    Splits the content by <h3> headers to get individual release items.
    """
    if not content_html:
        return []
    
    soup = BeautifulSoup(content_html, 'html.parser')
    headers = soup.find_all('h3')
    
    # If no h3 headers, treat the entire content as a single 'General' item
    if not headers:
        text_content = soup.get_text().strip()
        return [{
            'id': f"{entry_base_id}-0",
            'date': entry_date,
            'timestamp': entry_timestamp,
            'link': entry_link,
            'category': 'General',
            'content_html': content_html,
            'content_text': text_content
        }]
        
    items = []
    for index, header in enumerate(headers):
        category = header.get_text().strip()
        
        # Accumulate siblings until the next h3
        sibling = header.next_sibling
        sibling_contents = []
        
        while sibling and sibling.name != 'h3':
            if sibling.name is not None:
                sibling_contents.append(str(sibling))
            elif isinstance(sibling, str) and sibling.strip():
                # Wrap loose text in paragraph or just append
                sibling_contents.append(sibling.strip())
            sibling = sibling.next_sibling
            
        html_segment = "".join(sibling_contents).strip()
        # Parse text from segment
        segment_soup = BeautifulSoup(html_segment, 'html.parser')
        text_segment = segment_soup.get_text().strip()
        
        items.append({
            'id': f"{entry_base_id}-{index}",
            'date': entry_date,
            'timestamp': entry_timestamp,
            'link': entry_link,
            'category': category,
            'content_html': html_segment,
            'content_text': text_segment
        })
        
    return items

def fetch_and_parse_feed():
    """
    Fetches the XML feed from Google, parses entries, structures updates,
    and caches the results.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Failed to download feed: {str(e)}")
        
    try:
        root = ET.fromstring(response.content)
    except Exception as e:
        raise RuntimeError(f"Failed to parse XML: {str(e)}")
        
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = root.findall('atom:entry', ns)
    
    all_items = []
    
    for entry in entries:
        title_el = entry.find('atom:title', ns)
        date_str = title_el.text.strip() if title_el is not None else "Unknown Date"
        
        updated_el = entry.find('atom:updated', ns)
        updated_str = updated_el.text.strip() if updated_el is not None else ""
        
        link_el = entry.find('atom:link', ns)
        link_str = link_el.attrib.get('href', '').strip() if link_el is not None else ""
        
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ""
        
        # Generate base ID from date or timestamp
        # E.g. June 16, 2026 -> 2026-06-16
        base_id = updated_str[:10] if updated_str else date_str.lower().replace(' ', '-').replace(',', '')
        
        entry_items = parse_entry_content(date_str, updated_str, link_str, base_id, content_html)
        all_items.extend(entry_items)
        
    # Sort all items by timestamp descending
    all_items.sort(key=lambda x: x['timestamp'], reverse=True)
    
    cache_data = {
        'last_fetched': time.time(),
        'items': all_items
    }
    
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache_data, f, ensure_ascii=False, indent=2)
        
    return cache_data

def get_release_notes(force_refresh=False):
    """
    Returns release notes from cache or fetches them if cache is missing/expired.
    """
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            # Check if cache is still valid
            if time.time() - cache_data.get('last_fetched', 0) < CACHE_EXPIRY:
                return cache_data, False  # Data, is_fallback=False
        except Exception:
            # If reading cache fails, we will attempt to fetch
            pass
            
    # Try fetching fresh data
    try:
        data = fetch_and_parse_feed()
        return data, False
    except Exception as e:
        # Fallback to cache if available
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                cache_data['fallback_warning'] = f"Could not fetch fresh updates ({str(e)}). Showing cached data."
                return cache_data, True
            except Exception:
                pass
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def api_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data, is_fallback = get_release_notes(force_refresh)
        return jsonify({
            'success': True,
            'last_fetched': data.get('last_fetched'),
            'items': data.get('items', []),
            'fallback': is_fallback,
            'warning': data.get('fallback_warning')
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
