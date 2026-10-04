import { useState } from 'react';
import { motion } from 'framer-motion';

const MOCK_TRACKS = [
  { id: '1', title: 'Midnight City', artist: 'M83', duration: 243, artworkUrl: 'https://picsum.photos/seed/1/300/300' },
  { id: '2', title: 'Blinding Lights', artist: 'The Weeknd', duration: 200, artworkUrl: 'https://picsum.photos/seed/2/300/300' },
  { id: '3', title: 'Levitating', artist: 'Dua Lipa', duration: 203, artworkUrl: 'https://picsum.photos/seed/3/300/300' },
  { id: '4', title: 'Good Days', artist: 'SZA', duration: 279, artworkUrl: 'https://picsum.photos/seed/4/300/300' },
];

export default function DiscoverPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold mb-6">Discover</h1>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search for songs, artists..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 text-lg transition-colors pl-14"
            />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl opacity-50">🔍</div>
          </div>
        </header>

        <section>
          <h2 className="text-xl font-bold mb-4">Moods & Genres</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
            {['Chill', 'Pop', 'Electronic', 'Hip Hop', 'Rock', 'Jazz'].map(genre => (
              <button key={genre} className="bg-neutral-900 border border-neutral-800 hover:border-indigo-500 px-6 py-2 rounded-full whitespace-nowrap transition-colors">
                {genre}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">Trending Now</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {MOCK_TRACKS.map((track) => (
              <motion.div 
                key={track.id}
                whileHover={{ scale: 1.02 }}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 group cursor-pointer"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-3">
                  <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-xl shadow-xl hover:scale-110 transition-transform">
                      ➕
                    </button>
                  </div>
                </div>
                <h3 className="font-bold truncate">{track.title}</h3>
                <p className="text-sm text-neutral-400 truncate">{track.artist}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
