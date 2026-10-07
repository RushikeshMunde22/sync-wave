import json
import requests
import re
import endpoints
import formatter

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
}

def extract_token_from_url(url: str) -> str:
    url = url.split('?')[0].rstrip('/')
    parts = [p for p in url.split('/') if p]
    if parts:
        return parts[-1]
    return ""

def get_lyrics(song_id_or_url: str):
    if not song_id_or_url:
        return ""
    song_id = song_id_or_url
    if 'http' in song_id_or_url:
        token = extract_token_from_url(song_id_or_url)
        song_res = get_song_by_token(token)
        if song_res and isinstance(song_res, dict) and song_res.get('id'):
            song_id = song_res['id']

    try:
        url = endpoints.lyrics_base_url + str(song_id)
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.ok:
            data = res.json()
            return data.get('lyrics') or ""
    except Exception as e:
        print(f"[JioSaavn] get_lyrics failed for {song_id}: {e}")
    return ""

def get_song(song_id: str, lyrics: bool = False):
    try:
        url = endpoints.song_details_base_url + str(song_id)
        res = requests.get(url, headers=HEADERS, timeout=10)
        data = res.json()
        raw_song = data.get(song_id) or (list(data.values())[0] if data else None)
        if raw_song:
            return formatter.format_song(raw_song, include_lyrics=lyrics, fetch_lyrics_fn=get_lyrics)
    except Exception as e:
        print(f"[JioSaavn] get_song failed for {song_id}: {e}")
    return None

def get_song_by_token(token: str, lyrics: bool = False):
    try:
        url = f"{endpoints.webapi_base_url}{token}&type=song"
        res = requests.get(url, headers=HEADERS, timeout=10)
        data = res.json()
        if data:
            raw_song = list(data.values())[0] if isinstance(data, dict) else data[0]
            return formatter.format_song(raw_song, include_lyrics=lyrics, fetch_lyrics_fn=get_lyrics)
    except Exception as e:
        print(f"[JioSaavn] get_song_by_token failed for {token}: {e}")
    return None

def search_for_song(query: str, lyrics: bool = False):
    result = {
        'success': True,
        'data': [],
        'query': query
    }

    if not query:
        return result

    # Check if direct JioSaavn URL
    if query.startswith('http') and 'saavn.com' in query:
        token = extract_token_from_url(query)
        song = get_song_by_token(token, lyrics=lyrics)
        if song:
            result['data'] = [song]
            return result

    try:
        url = endpoints.search_base_url + requests.utils.quote(query)
        res = requests.get(url, headers=HEADERS, timeout=10)
        data = res.json()
        songs_raw = data.get('songs', {}).get('data', [])

        formatted_songs = []
        # Batch fetch song details for top results to obtain full decrypted media URLs
        pids = [s.get('id') for s in songs_raw if s.get('id')]
        if pids:
            batch_url = endpoints.song_details_base_url + ','.join(pids[:10])
            batch_res = requests.get(batch_url, headers=HEADERS, timeout=10)
            batch_data = batch_res.json()
            for pid in pids[:10]:
                if pid in batch_data:
                    s = formatter.format_song(batch_data[pid], include_lyrics=lyrics, fetch_lyrics_fn=get_lyrics)
                    if s:
                        formatted_songs.append(s)

        result['data'] = formatted_songs
    except Exception as e:
        print(f"[JioSaavn] search_for_song error: {e}")
        result['success'] = False

    return result

def get_playlist(playlist_id: str, lyrics: bool = False):
    try:
        url = endpoints.playlist_details_base_url + str(playlist_id)
        res = requests.get(url, headers=HEADERS, timeout=10)
        data = res.json()
        return formatter.format_playlist(data, include_lyrics=lyrics, fetch_lyrics_fn=get_lyrics)
    except Exception as e:
        print(f"[JioSaavn] get_playlist failed: {e}")
    return None

def get_playlist_by_token(token: str, lyrics: bool = False):
    try:
        url = f"{endpoints.webapi_base_url}{token}&type=playlist"
        res = requests.get(url, headers=HEADERS, timeout=10)
        data = res.json()
        return formatter.format_playlist(data, include_lyrics=lyrics, fetch_lyrics_fn=get_lyrics)
    except Exception as e:
        print(f"[JioSaavn] get_playlist_by_token failed: {e}")
    return None

def search_for_playlist(query: str, lyrics: bool = False):
    result = {
        'success': True,
        'data': [],
        'query': query
    }

    if not query:
        return result

    if query.startswith('http') and 'saavn.com' in query:
        token = extract_token_from_url(query)
        playlist = get_playlist_by_token(token, lyrics=lyrics)
        if playlist:
            result['data'] = playlist
            return result

    try:
        url = endpoints.search_base_url + requests.utils.quote(query)
        res = requests.get(url, headers=HEADERS, timeout=10)
        data = res.json()
        playlists_raw = data.get('playlists', {}).get('data', [])

        playlists = []
        for p in playlists_raw[:5]:
            pid = p.get('id')
            if pid:
                pl = get_playlist(pid, lyrics=lyrics)
                if pl:
                    playlists.append(pl)
        result['data'] = playlists
    except Exception as e:
        print(f"[JioSaavn] search_for_playlist error: {e}")
        result['success'] = False

    return result

def get_album(album_id: str, lyrics: bool = False):
    try:
        url = endpoints.album_details_base_url + str(album_id)
        res = requests.get(url, headers=HEADERS, timeout=10)
        data = res.json()
        return formatter.format_album(data, include_lyrics=lyrics, fetch_lyrics_fn=get_lyrics)
    except Exception as e:
        print(f"[JioSaavn] get_album failed: {e}")
    return None

def get_album_by_token(token: str, lyrics: bool = False):
    try:
        url = f"{endpoints.webapi_base_url}{token}&type=album"
        res = requests.get(url, headers=HEADERS, timeout=10)
        data = res.json()
        return formatter.format_album(data, include_lyrics=lyrics, fetch_lyrics_fn=get_lyrics)
    except Exception as e:
        print(f"[JioSaavn] get_album_by_token failed: {e}")
    return None

def search_for_album(query: str, lyrics: bool = False):
    result = {
        'success': True,
        'data': [],
        'query': query
    }

    if not query:
        return result

    if query.startswith('http') and 'saavn.com' in query:
        token = extract_token_from_url(query)
        album = get_album_by_token(token, lyrics=lyrics)
        if album:
            result['data'] = album
            return result

    try:
        url = endpoints.search_base_url + requests.utils.quote(query)
        res = requests.get(url, headers=HEADERS, timeout=10)
        data = res.json()
        albums_raw = data.get('albums', {}).get('data', [])

        albums = []
        for a in albums_raw[:5]:
            aid = a.get('id')
            if aid:
                alb = get_album(aid, lyrics=lyrics)
                if alb:
                    albums.append(alb)
        result['data'] = albums
    except Exception as e:
        print(f"[JioSaavn] search_for_album error: {e}")
        result['success'] = False

    return result

def universal_search(query: str, lyrics: bool = False):
    if not query:
        return {'success': False, 'message': 'You need to enter a query', 'data': []}

    query_str = query.strip()

    # If it's a URL, detect type
    if query_str.startswith('http') and 'saavn.com' in query_str:
        token = extract_token_from_url(query_str)
        if '/song/' in query_str:
            song = get_song_by_token(token, lyrics=lyrics)
            return {'success': True, 'type': 'song', 'data': [song] if song else [], 'query': query}
        elif '/album/' in query_str:
            album = get_album_by_token(token, lyrics=lyrics)
            return {'success': True, 'type': 'album', 'data': album or {}, 'query': query}
        elif '/playlist/' in query_str or '/featured/' in query_str:
            playlist = get_playlist_by_token(token, lyrics=lyrics)
            return {'success': True, 'type': 'playlist', 'data': playlist or {}, 'query': query}

    # Otherwise standard song search
    return search_for_song(query_str, lyrics=lyrics)
