import React, { useEffect, useState, useMemo } from 'react';
import { Search, Folder, Play, Monitor, RefreshCw, GamepadIcon, CalendarIcon, UserIcon, TagIcon } from 'lucide-react';

// Mock API for demo - replace with window.electronAPI in production
const mockAPI = {
  scanExoLocations: async () => [
    { path: '/home/user/eXoDOS', type: 'dos' },
    { path: '/home/user/eXoWin3x', type: 'win3x' }
  ],
  selectExoFolder: async () => ({ path: '/home/user/eXoDOS', type: 'dos' }),
  loadExoGames: async (path) => {
    const games = {
      '/home/user/eXoDOS': [
        { title: 'Doom', developer: 'id Software', publisher: 'id Software', releaseDate: '1993', genre: 'First-Person Shooter', path: '/path/doom', coverImage: '' },
        { title: 'Commander Keen', developer: 'id Software', publisher: 'Apogee', releaseDate: '1990', genre: 'Platform', path: '/path/keen', coverImage: '' },
        { title: 'Wolfenstein 3D', developer: 'id Software', publisher: 'Apogee', releaseDate: '1992', genre: 'First-Person Shooter', path: '/path/wolf3d', coverImage: '' },
        { title: 'Prince of Persia', developer: 'Broderbund', publisher: 'Broderbund', releaseDate: '1989', genre: 'Platform', path: '/path/pop', coverImage: '' },
        { title: 'Monkey Island', developer: 'LucasArts', publisher: 'LucasArts', releaseDate: '1990', genre: 'Adventure', path: '/path/monkey', coverImage: '' },
        { title: 'SimCity 2000', developer: 'Maxis', publisher: 'Maxis', releaseDate: '1993', genre: 'Simulation', path: '/path/simcity', coverImage: '' }
      ],
      '/home/user/eXoWin3x': [
        { title: 'Solitaire', developer: 'Microsoft', publisher: 'Microsoft', releaseDate: '1990', genre: 'Card', path: '/path/sol', coverImage: '' },
        { title: 'Minesweeper', developer: 'Microsoft', publisher: 'Microsoft', releaseDate: '1990', genre: 'Puzzle', path: '/path/mine', coverImage: '' }
      ]
    };
    return games[path] || [];
  },
  getGameInfo: async (path) => ({
    startCommand: 'GAME.EXE',
    dosboxConf: {},
    gamePath: path
  }),
  launchWithEmularity: async (info) => {
    console.log('Launching:', info);
    return true;
  }
};

const api = typeof window !== 'undefined' && window.electronAPI ? window.electronAPI : mockAPI;

export default function App() {
  const [exoLocations, setExoLocations] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [games, setGames] = useState([]);
  const [filteredGames, setFilteredGames] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    filterGames();
  }, [games, searchTerm, selectedGenre]);

  async function initializeApp() {
    setLoading(true);
    setStatus('Scanning for eXoDOS/eXoWin3x installations...');
    
    try {
      const locations = await api.scanExoLocations();
      setExoLocations(locations);
      
      if (locations.length > 0) {
        await loadLocation(locations[0]);
      } else {
        setStatus('No eXo installations found. Click "Add Folder" to select your eXoDOS or eXoWin3x folder.');
        setLoading(false);
      }
    } catch (err) {
      setStatus('Error: ' + err.message);
      setLoading(false);
    }
  }

  async function loadLocation(location) {
    setLoading(true);
    setCurrentLocation(location);
    setStatus(`Loading games from ${location.type === 'dos' ? 'eXoDOS' : 'eXoWin3x'}...`);
    
    try {
      const gameList = await api.loadExoGames(location.path);
      setGames(gameList);
      setStatus(`Loaded ${gameList.length} games from ${location.path.split('/').pop()}`);
    } catch (err) {
      setStatus('Error loading games: ' + err.message);
    }
    
    setLoading(false);
  }

  async function addFolder() {
    const location = await api.selectExoFolder();
    if (location) {
      setExoLocations([...exoLocations, location]);
      await loadLocation(location);
    }
  }

  function filterGames() {
    let filtered = games;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.title.toLowerCase().includes(term) ||
        g.developer?.toLowerCase().includes(term) ||
        g.publisher?.toLowerCase().includes(term) ||
        g.genre?.toLowerCase().includes(term)
      );
    }
    
    if (selectedGenre !== 'all') {
      filtered = filtered.filter(g => g.genre === selectedGenre);
    }
    
    setFilteredGames(filtered);
  }

  async function launchGame(game) {
    setStatus(`Preparing ${game.title}...`);
    
    try {
      const gameInfo = await api.getGameInfo(game.path);
      setStatus(`Launching ${game.title}...`);
      await api.launchWithEmularity({ ...gameInfo, title: game.title });
      setStatus(`✓ ${game.title} launched successfully`);
      setTimeout(() => setStatus('Ready'), 3000);
    } catch (err) {
      setStatus(`✗ Failed to launch: ${err.message}`);
      setTimeout(() => setStatus('Ready'), 5000);
    }
  }

  const genres = useMemo(() => {
    const genreSet = new Set(games.map(g => g.genre).filter(Boolean));
    return ['all', ...Array.from(genreSet)].sort();
  }, [games]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="bg-slate-900/70 backdrop-blur-xl border-b border-cyan-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <GamepadIcon className="w-10 h-10 text-cyan-400" />
                <div className="absolute -inset-1 bg-cyan-400/20 blur-xl rounded-full"></div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  eXoDOS Launcher
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">Powered by Emularity - The Archive.org Engine</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {exoLocations.map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => loadLocation(loc)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    currentLocation?.path === loc.path
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {loc.type === 'dos' ? '💾 DOS' : '🪟 Win3.x'}
                </button>
              ))}
              <button
                onClick={addFolder}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all font-medium"
              >
                <Folder className="w-4 h-4" />
                Add Folder
              </button>
              <button
                onClick={initializeApp}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-3">
            <div className="flex-1 relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search games, developers, publishers..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-100 placeholder-slate-500"
              />
            </div>
            
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-100 cursor-pointer hover:bg-slate-800 transition-all"
            >
              {genres.map(g => (
                <option key={g} value={g}>
                  {g === 'all' ? 'All Genres' : g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-slate-900/40 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between text-sm">
          <div className="text-slate-300">{status}</div>
          <div className="text-cyan-400 font-medium">{filteredGames.length} games</div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <RefreshCw className="w-12 h-12 animate-spin text-cyan-400 mb-4" />
            <p className="text-slate-400">Loading games...</p>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-32">
            <GamepadIcon className="w-20 h-20 mx-auto mb-6 text-slate-700" />
            <h3 className="text-2xl font-bold mb-3 text-slate-300">
              {searchTerm || selectedGenre !== 'all' ? 'No games found' : 'No eXo collection found'}
            </h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              {searchTerm || selectedGenre !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Download eXoDOS or eXoWin3x from retro-exo.com, extract it, run setup.bat, then add the folder here.'}
            </p>
            {!searchTerm && selectedGenre === 'all' && (
              <button
                onClick={addFolder}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg font-medium shadow-lg shadow-cyan-500/20 transition-all"
              >
                Add eXo Folder
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGames.map((game) => (
              <div
                key={game.path}
                className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl hover:border-cyan-500/50 transition-all duration-300 overflow-hidden hover:shadow-xl hover:shadow-cyan-500/10"
              >
                {/* Game Cover */}
                <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
                  {game.coverImage ? (
                    <img src={game.coverImage} alt={game.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <GamepadIcon className="w-16 h-16 text-slate-700 group-hover:text-slate-600 transition-colors" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  {/* Play Button Overlay */}
                  <button
                    onClick={() => launchGame(game)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="bg-cyan-500 hover:bg-cyan-400 rounded-full p-4 shadow-2xl transform scale-0 group-hover:scale-100 transition-transform duration-300">
                      <Play className="w-8 h-8 text-white fill-current" />
                    </div>
                  </button>
                </div>

                {/* Game Info */}
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2 text-slate-100 truncate" title={game.title}>
                    {game.title}
                  </h3>
                  
                  <div className="space-y-1.5 text-sm mb-4">
                    {game.developer && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <UserIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{game.developer}</span>
                      </div>
                    )}
                    {game.genre && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <TagIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{game.genre}</span>
                      </div>
                    )}
                    {game.releaseDate && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{game.releaseDate}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => launchGame(game)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-medium transition-all shadow-lg shadow-cyan-500/20"
                  >
                    <Play className="w-4 h-4" />
                    Play Game
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/40 backdrop-blur-sm border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="text-center text-sm text-slate-400">
            <p className="mb-1">
              <strong>🎮 Powered by Emularity</strong> - The same emulation engine used by Internet Archive
            </p>
            <p className="text-xs text-slate-500">
              eXoDOS and eXoWin3x collections by eXo • Visit retro-exo.com for downloads
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}