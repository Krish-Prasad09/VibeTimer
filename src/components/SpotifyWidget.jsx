import React, { useState, useEffect, useCallback } from 'react';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';

export default function SpotifyWidget({ isOpen, onClose }) {
  const [sdk, setSdk] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [playbackState, setPlaybackState] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize SDK
  useEffect(() => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    if (!clientId) {
      setError('Spotify Client ID is missing. Check .env file.');
      setIsLoading(false);
      return;
    }

    const redirectUrl = window.location.href.split('?')[0];
    const scopes = [
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-read-playback-state',
      'user-modify-playback-state'
    ];

    const spotifySdk = SpotifyApi.withUserAuthorization(clientId, redirectUrl, scopes);
    setSdk(spotifySdk);

    const checkAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hasCode = params.has('code');
        
        const token = await spotifySdk.getAccessToken();

        if (hasCode || token) {
          const authInfo = await spotifySdk.authenticate();
          if (authInfo && authInfo.authenticated) {
            setIsAuthenticated(true);
            if (hasCode) {
              window.history.replaceState({}, document.title, redirectUrl);
            }
          }
        }
      } catch (err) {
        console.error('Spotify auth error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Initialize Player once authenticated
  useEffect(() => {
    if (!isAuthenticated || !sdk) return;

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    document.body.appendChild(script);

    let spotifyPlayer = null;

    window.onSpotifyWebPlaybackSDKReady = () => {
      spotifyPlayer = new window.Spotify.Player({
        name: 'VibeCodeFlocus Web Player',
        getOAuthToken: cb => {
          sdk.getAccessToken().then(token => {
            if (token && token.access_token) {
              cb(token.access_token);
            }
          });
        },
        volume: 0.5
      });

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        setDeviceId(device_id);
        // Transfer playback to this device
        sdk.player.transferPlayback([device_id]).catch(err => {
          console.error('Failed to transfer playback', err);
        });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return;
        setPlaybackState(state);
      });

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        setError(message);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        setError(message);
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        setError("Spotify Premium is required for Web Playback.");
      });

      spotifyPlayer.connect();
      setPlayer(spotifyPlayer);
    };

    return () => {
      if (spotifyPlayer) {
        spotifyPlayer.disconnect();
      } else if (player) {
        player.disconnect();
      }
      document.body.removeChild(script);
      delete window.onSpotifyWebPlaybackSDKReady;
    };
  }, [isAuthenticated, sdk]);

  const handleLogin = async () => {
    if (sdk) {
      setIsLoading(true);
      await sdk.authenticate();
    }
  };

  const handlePlayPause = () => {
    if (player) {
      player.togglePlay();
    }
  };

  const handleNext = () => {
    if (player) {
      player.nextTrack();
    }
  };

  const handlePrevious = () => {
    if (player) {
      player.previousTrack();
    }
  };

  const track = playbackState?.track_window?.current_track;

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-20 left-0 w-80 glass-panel rounded-2xl p-4 shadow-2xl animate-fade-in border border-white/20 z-50 flex flex-col mb-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-h2 text-lg text-primary">Music</h3>
        <button onClick={onClose} className="text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {error ? (
        <div className="text-sm text-red-400 p-2 bg-red-400/10 rounded-lg">
          {error}
        </div>
      ) : isLoading ? (
        <div className="py-6 text-center text-sm text-on-surface-variant flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
          <span>Loading...</span>
        </div>
      ) : !isAuthenticated ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-on-surface-variant text-center">
            Log in to Spotify to listen to music.
          </p>
          <button
            onClick={handleLogin}
            className="px-4 py-2 rounded-lg bg-[#1DB954] text-black font-medium hover:bg-[#1ed760] transition-colors shadow-lg"
          >
            Login with Spotify
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {track ? (
            <>
              <div className="flex items-center gap-3">
                <img
                  src={track.album.images[0]?.url || ''}
                  alt={track.album.name}
                  className="w-14 h-14 rounded-md shadow-md object-cover"
                />
                <div className="flex flex-col overflow-hidden flex-1">
                  <span className="text-sm font-medium text-white truncate">
                    {track.name}
                  </span>
                  <span className="text-xs text-on-surface-variant truncate">
                    {track.artists.map(a => a.name).join(', ')}
                  </span>
                </div>
              </div>

              <div className="flex justify-center items-center gap-4">
                <button
                  onClick={handlePrevious}
                  className="text-on-surface-variant hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">skip_previous</span>
                </button>
                <button
                  onClick={handlePlayPause}
                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <span className="material-symbols-outlined text-2xl">
                    {playbackState.paused ? 'play_arrow' : 'pause'}
                  </span>
                </button>
                <button
                  onClick={handleNext}
                  className="text-on-surface-variant hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">skip_next</span>
                </button>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-sm text-on-surface-variant flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
              <span>Connecting to Spotify...</span>
              <span className="text-xs opacity-70 mt-2">
                You may need to play something on another device first to wake up the player.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
