import base64
import html
from pyDes import des, ECB, PAD_PKCS5

def decrypt_url(url: str) -> str:
    try:
        if not url:
            return ""
        des_cipher = des(b"38346591", ECB, b"\0\0\0\0\0\0\0\0", pad=None, padmode=PAD_PKCS5)
        enc_url = base64.b64decode(url.strip())
        dec_url = des_cipher.decrypt(enc_url, padmode=PAD_PKCS5).decode('utf-8')
        return dec_url
    except Exception as e:
        print(f"[Decryption Error] Failed to decrypt URL: {e}")
        return ""

def clean_text(string):
    if not string:
        return ""
    if not isinstance(string, str):
        string = str(string)
    try:
        # Unescape HTML entities & Unicode escapes safely
        string = html.unescape(string)
        string = string.replace("&quot;", '"').replace("&amp;", "&").replace("&#039;", "'")
    except Exception:
        pass
    return string.strip()

def string_to_array(raw_data):
    if not raw_data:
        return []
    if isinstance(raw_data, list):
        return [clean_text(item) for item in raw_data if item]
    cleaned = clean_text(raw_data)
    parts = cleaned.split(',')
    return [p.strip() for p in parts if p.strip()]

def format_song(data, include_lyrics=False, fetch_lyrics_fn=None):
    if not data or not isinstance(data, dict):
        return None

    song_data = {}
    media = {}

    # Extract or decrypt 320kbps full studio media URL
    enc_media_url = data.get('encrypted_media_url') or data.get('more_info', {}).get('encrypted_media_url')
    if enc_media_url:
        dec = decrypt_url(enc_media_url)
        if dec:
            media['96kbps'] = dec.replace("_320.mp4", "_96.mp4").replace("_160.mp4", "_96.mp4")
            media['160kbps'] = dec.replace("_320.mp4", "_160.mp4").replace("_96.mp4", "_160.mp4")
            media['320kbps'] = dec.replace("_96.mp4", "_320.mp4").replace("_160.mp4", "_320.mp4")

    # Fallback to media_preview_url if encrypted_media_url wasn't available
    if not media.get('320kbps'):
        preview_url = data.get('media_preview_url') or data.get('more_info', {}).get('media_preview_url')
        if preview_url:
            aac_url = preview_url.replace('preview', 'aac').replace('_96_p.mp4', '_96.mp4')
            media['96kbps'] = aac_url
            media['160kbps'] = aac_url.replace('_96.mp4', '_160.mp4')
            media['320kbps'] = aac_url.replace('_96.mp4', '_320.mp4')

    more_info = data.get('more_info', {}) if isinstance(data.get('more_info'), dict) else {}

    # Image upscaling to 500x500
    raw_img = data.get('image', '')
    if raw_img:
        raw_img = raw_img.replace("150x150", "500x500").replace("50x50", "500x500")

    song_id = data.get('id') or more_info.get('id') or ''
    title = clean_text(data.get('song') or data.get('title') or '')
    album = clean_text(data.get('album') or more_info.get('album') or '')
    primary_artists = clean_text(data.get('primary_artists') or more_info.get('artistMap', {}).get('primary_artists', '') if isinstance(more_info.get('artistMap'), dict) else data.get('primary_artists') or '')
    singers = string_to_array(data.get('singers') or more_info.get('singers') or primary_artists)
    duration = data.get('duration') or more_info.get('duration') or 0

    has_lyrics = str(data.get('has_lyrics') or more_info.get('has_lyrics') or 'false').lower() == 'true'

    song_data['id'] = song_id
    song_data['title'] = title
    song_data['album'] = album
    song_data['primary_artists'] = primary_artists
    song_data['singers'] = singers
    song_data['starring'] = string_to_array(data.get('starring') or more_info.get('starring') or '')
    song_data['media_url'] = media
    song_data['image'] = raw_img
    song_data['language'] = data.get('language') or ''
    song_data['play_count'] = data.get('play_count') or 0
    song_data['has_lyrics'] = 'true' if has_lyrics else 'false'
    song_data['release_date'] = data.get('release_date') or more_info.get('release_date') or ''
    song_data['320kbps'] = 'true' if '320kbps' in media else 'false'
    song_data['duration'] = str(duration)

    # Optional lyrics
    if include_lyrics and has_lyrics and fetch_lyrics_fn and song_id:
        try:
            lyrics_text = fetch_lyrics_fn(song_id)
            if lyrics_text:
                song_data['lyrics'] = lyrics_text
        except Exception:
            pass

    return song_data

def format_playlist(data, include_lyrics=False, fetch_lyrics_fn=None):
    if not data or not isinstance(data, dict):
        return None

    playlist_data = {}
    songs = []

    playlist_data['id'] = data.get('listid') or data.get('id') or ''
    playlist_data['name'] = clean_text(data.get('listname') or data.get('title') or '')
    playlist_data['followers'] = data.get('follower_count') or data.get('followers') or '0'
    playlist_data['image'] = (data.get('image') or '').replace("150x150", "500x500")
    playlist_data['song_count'] = data.get('list_count') or str(len(data.get('songs', [])))

    raw_songs = data.get('songs', [])
    if isinstance(raw_songs, list):
        for s in raw_songs:
            formatted = format_song(s, include_lyrics=include_lyrics, fetch_lyrics_fn=fetch_lyrics_fn)
            if formatted:
                songs.append(formatted)

    playlist_data['songs'] = songs
    return playlist_data

def format_album(data, include_lyrics=False, fetch_lyrics_fn=None):
    if not data or not isinstance(data, dict):
        return None

    album_data = {}
    songs = []

    album_data['id'] = data.get('albumid') or data.get('id') or ''
    album_data['title'] = clean_text(data.get('title') or data.get('name') or '')
    album_data['primary_artists'] = clean_text(data.get('primary_artists') or '')
    album_data['image'] = (data.get('image') or '').replace("150x150", "500x500")
    album_data['year'] = data.get('year') or ''
    album_data['song_count'] = str(len(data.get('songs', [])))

    raw_songs = data.get('songs', [])
    if isinstance(raw_songs, list):
        for s in raw_songs:
            formatted = format_song(s, include_lyrics=include_lyrics, fetch_lyrics_fn=fetch_lyrics_fn)
            if formatted:
                songs.append(formatted)

    album_data['songs'] = songs
    return album_data
