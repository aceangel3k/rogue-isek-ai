import { useState, useEffect } from 'react';

function getPlayerId() {
  return localStorage.getItem('playerId') || null;
}

export default function SavedGames({ onLoadGame, onClose }) {
  const [saves, setSaves] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavesAndProgress();
  }, []);

  const loadSavesAndProgress = async () => {
    const playerId = getPlayerId();
    if (!playerId) {
      setLoading(false);
      return;
    }

    try {
      // Load saves
      const savesResponse = await fetch(
        `/api/get-saves?player_id=${playerId}&completed_only=true`
      );
      if (savesResponse.ok) {
        const savesData = await savesResponse.json();
        setSaves(savesData.saves || []);
      }

      // Load progress
      const progressResponse = await fetch(
        `/api/get-progress?player_id=${playerId}`
      );
      if (progressResponse.ok) {
        const progressData = await progressResponse.json();
        setProgress(progressData.progress);
      }
    } catch (error) {
      console.error('Error loading saves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSave = (save) => {
    onLoadGame(save);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center" style={{ zIndex: 10000 }}>
        <div className="text-white text-2xl">Loading saves...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
      <div className="retro-panel max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{ padding: '32px' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-cyan-400">Saved Games</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Campaign Progress */}
        {progress && progress.dungeons_completed > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border-2 border-cyan-500">
            <h3 className="text-xl font-bold text-cyan-400 mb-4">Campaign Progress</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{progress.dungeons_completed}</div>
                <div className="text-gray-400 text-sm">Dungeons Cleared</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">{progress.total_gold}</div>
                <div className="text-gray-400 text-sm">Total Gold</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400">{progress.total_kills}</div>
                <div className="text-gray-400 text-sm">Total Kills</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">
                  {formatTime(progress.total_time)}
                </div>
                <div className="text-gray-400 text-sm">Total Time</div>
              </div>
            </div>
          </div>
        )}

        {/* Saved Games List */}
        <div className="space-y-4">
          {saves.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-xl mb-2">No completed dungeons yet</p>
              <p>Complete a dungeon to see it here!</p>
            </div>
          ) : (
            saves.map((save) => (
              <div
                key={save.id}
                className="bg-gray-800 rounded-lg p-4 border-2 border-gray-700 hover:border-cyan-500 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <p className="text-gray-400 text-sm">
                      Completed: {formatDate(save.completed_at)}
                    </p>
                  </div>
                  <button
            onClick={() => handleLoadSave(save)}
            className="px-4 py-2 retro-button font-bold"
          >
            [LOAD]
          </button>
                </div>
                
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-gray-500 text-xs">Kills</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-yellow-400">{save.gold}</div>
                    <div className="text-gray-500 text-xs">Gold</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-blue-400">
                      {formatTime(save.time_elapsed)}
                    </div>
                    <div className="text-gray-500 text-xs">Time</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-green-400">Lv {save.level_number}</div>
                    <div className="text-gray-500 text-xs">Level</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-6 py-3 retro-button font-bold"
          >
            [CLOSE]
          </button>
        </div>
      </div>
    </div>
  );
}
