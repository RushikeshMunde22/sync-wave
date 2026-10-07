from flask import Flask, jsonify, request
from flask_cors import CORS
import jiosaavn

app = Flask(__name__)
app.secret_key = 'syncwave_jiosaavn_api_production_key_2026'
CORS(app)

def parse_lyrics_flag():
    val = request.args.get('lyrics', 'false').lower()
    return val in ['true', '1', 'yes']

@app.route('/')
def home():
    return "API is UP and running"

@app.route('/result')
@app.route('/result/')
def result():
    query = request.args.get('query')
    if not query:
        return jsonify({
            'success': False,
            'message': 'You need to enter a query',
            'data': [],
        })
    with_lyrics = parse_lyrics_flag()
    res = jiosaavn.universal_search(query, lyrics=with_lyrics)
    return jsonify(res)

@app.route('/song')
@app.route('/song/')
def song():
    query = request.args.get('query')
    if not query:
        return jsonify({
            'success': False,
            'message': 'You need to enter a query',
            'data': [],
        })
    with_lyrics = parse_lyrics_flag()
    res = jiosaavn.search_for_song(query, lyrics=with_lyrics)
    return jsonify(res)

@app.route('/playlist')
@app.route('/playlist/')
def playlist():
    query = request.args.get('query')
    if not query:
        return jsonify({
            'success': False,
            'message': 'You need to enter a query',
            'data': [],
        })
    with_lyrics = parse_lyrics_flag()
    res = jiosaavn.search_for_playlist(query, lyrics=with_lyrics)
    return jsonify(res)

@app.route('/album')
@app.route('/album/')
def album():
    query = request.args.get('query')
    if not query:
        return jsonify({
            'success': False,
            'message': 'You need to enter a query',
            'data': [],
        })
    with_lyrics = parse_lyrics_flag()
    res = jiosaavn.search_for_album(query, lyrics=with_lyrics)
    return jsonify(res)

@app.route('/lyrics')
@app.route('/lyrics/')
def lyrics():
    query = request.args.get('query')
    if not query:
        return jsonify({
            'success': False,
            'message': 'You need to enter a query (song id or link)',
            'lyrics': '',
        })
    lyrics_text = jiosaavn.get_lyrics(query)
    return jsonify({
        'success': bool(lyrics_text),
        'lyrics': lyrics_text,
        'query': query
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
