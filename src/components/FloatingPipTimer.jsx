import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function FloatingPipTimer({
  mode,
  isRunning,
  displayTime,
  currentTag,
  start,
  pause,
  reset,
  lap,
  setMode,
  formatTime,
  dailyTotal,
  showButton = true
}) {
  const [pipWindow, setPipWindow] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const hasDocPip = 'documentPictureInPicture' in window;
    const hasVideoPip = 'pictureInPictureEnabled' in document;
    setIsSupported(hasDocPip || hasVideoPip);
  }, []);

  useEffect(() => {
    return () => {
      if (pipWindow) {
        try {
          pipWindow.close();
        } catch (e) {}
      }
    };
  }, [pipWindow]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    const gradient = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(255, 238, 0, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = isRunning ? 'rgba(255, 238, 0, 0.4)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = isRunning ? '#FFEE00' : '#888888';
    const modeLabel = (mode || 'TIMER').toUpperCase();
    ctx.fillText(`${modeLabel} • ${currentTag || 'FOCUS'}`, 24, 38);

    ctx.beginPath();
    ctx.arc(w - 30, 32, 6, 0, Math.PI * 2);
    ctx.fillStyle = isRunning ? '#00FF66' : '#FFAA00';
    ctx.fill();

    ctx.font = 'bold 64px monospace';
    ctx.fillStyle = '#FFEE00';
    ctx.textAlign = 'center';
    ctx.fillText(displayTime || '00:00', w / 2, 125);
    ctx.textAlign = 'left';

    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(`Daily Total: ${formatTime ? formatTime(dailyTotal) : ''}`, 24, 175);
    ctx.textAlign = 'right';
    ctx.fillText(isRunning ? '▶ Running' : '⏸ Paused', w - 24, 175);
    ctx.textAlign = 'left';
  }, [mode, isRunning, displayTime, currentTag, formatTime, dailyTotal]);

  useEffect(() => {
    if (!pipWindow && videoRef.current && document.pictureInPictureElement === videoRef.current) {
      drawCanvas();
    }
  }, [displayTime, isRunning, mode, currentTag, pipWindow, drawCanvas]);

  const togglePip = useCallback(async () => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }

    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch (e) {}
      return;
    }

    if ('documentPictureInPicture' in window) {
      try {
        const pip = await window.documentPictureInPicture.requestWindow({
          width: 360,
          height: 195
        });

        [...document.querySelectorAll('link[rel="stylesheet"], style')].forEach((el) => {
          pip.document.head.appendChild(el.cloneNode(true));
        });

        const fontLink = pip.document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&family=JetBrains+Mono:wght@500;700&display=swap';
        pip.document.head.appendChild(fontLink);

        const style = pip.document.createElement('style');
        style.textContent = `
          * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
          body {
            background-color: #0d0d0d;
            color: #ffffff;
            font-family: Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            width: 100vw;
          }
          .material-symbols-outlined {
            font-family: 'Material Symbols Outlined';
            font-weight: normal;
            font-style: normal;
            font-size: 20px;
            line-height: 1;
            letter-spacing: normal;
            text-transform: none;
            display: inline-block;
            white-space: nowrap;
            word-wrap: normal;
            direction: ltr;
            -webkit-font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
          }
        `;
        pip.document.head.appendChild(style);

        pip.addEventListener('pagehide', () => {
          setPipWindow(null);
        });

        setPipWindow(pip);
        return;
      } catch (err) {
        console.warn('Document PiP request failed, falling back to video canvas PiP:', err);
      }
    }

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      drawCanvas();
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      await video.play();
      await video.requestPictureInPicture();

      video.addEventListener(
        'leavepictureinpicture',
        () => {
          video.pause();
          video.srcObject = null;
        },
        { once: true }
      );
    } catch (err) {
      console.error('Picture-in-Picture error:', err);
      alert('Picture-in-Picture is not supported or was blocked by your browser.');
    }
  }, [pipWindow, drawCanvas]);

  useEffect(() => {
    const handleToggle = () => togglePip();
    window.addEventListener('toggle-pip', handleToggle);
    return () => window.removeEventListener('toggle-pip', handleToggle);
  }, [togglePip]);

  const isPipActive = !!pipWindow || (typeof document !== 'undefined' && !!document.pictureInPictureElement);

  if (!isSupported) return null;

  return (
    <>
      <div className="hidden" aria-hidden="true" style={{ display: 'none' }}>
        <canvas ref={canvasRef} width={400} height={200} />
        <video ref={videoRef} muted playsInline autoPlay />
      </div>

      {showButton && (
        <button
          onClick={togglePip}
          className={`p-3 rounded-full transition-all flex items-center justify-center cursor-pointer ${
            isPipActive
              ? 'bg-primary text-black font-bold shadow-[0_0_15px_rgba(255,238,0,0.6)]'
              : 'bg-white/10 hover:bg-white/20 text-primary active:scale-95'
          }`}
          title={isPipActive ? 'Close Floating Mini Timer (P)' : 'Floating Mini Timer (P)'}
          aria-label="Toggle Floating Picture-in-Picture Mini Timer"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isPipActive ? 'pip_exit' : 'picture_in_picture_alt'}
          </span>
        </button>
      )}

      {pipWindow &&
        createPortal(
          <div
            style={{
              width: '100%',
              height: '100%',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              backgroundColor: '#0f0f0f',
              backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(255, 238, 0, 0.08) 0%, rgba(0, 0, 0, 0) 70%)',
              border: '1px solid rgba(255, 238, 0, 0.25)',
              borderRadius: '16px',
              boxSizing: 'border-box'
            }}
          >
            {/* Top Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isRunning ? '#00FF66' : '#FFEE00',
                    boxShadow: isRunning ? '0 0 8px #00FF66' : 'none'
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#FFEE00', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {mode}
                </span>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
                  {currentTag}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setMode('pomodoro')}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    border: 'none',
                    cursor: 'pointer',
                    background: mode === 'pomodoro' ? '#FFEE00' : 'rgba(255,255,255,0.1)',
                    color: mode === 'pomodoro' ? '#000000' : '#ffffff',
                    fontWeight: mode === 'pomodoro' ? 'bold' : 'normal'
                  }}
                >
                  Focus
                </button>
                <button
                  onClick={() => setMode('break')}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    border: 'none',
                    cursor: 'pointer',
                    background: mode === 'break' ? '#FFEE00' : 'rgba(255,255,255,0.1)',
                    color: mode === 'break' ? '#000000' : '#ffffff',
                    fontWeight: mode === 'break' ? 'bold' : 'normal'
                  }}
                >
                  Break
                </button>
                <button
                  onClick={() => setMode('stopwatch')}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    border: 'none',
                    cursor: 'pointer',
                    background: mode === 'stopwatch' ? '#FFEE00' : 'rgba(255,255,255,0.1)',
                    color: mode === 'stopwatch' ? '#000000' : '#ffffff',
                    fontWeight: mode === 'stopwatch' ? 'bold' : 'normal'
                  }}
                >
                  Stopwatch
                </button>
              </div>
            </div>

            {/* Main Clock */}
            <div style={{ textAlign: 'center', margin: 'auto 0' }}>
              <div
                style={{
                  fontSize: '44px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 'bold',
                  color: '#FFEE00',
                  letterSpacing: '-1px',
                  textShadow: '0 0 16px rgba(255, 238, 0, 0.4)'
                }}
              >
                {displayTime}
              </div>
            </div>

            {/* Bottom Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                Daily: {formatTime ? formatTime(dailyTotal) : ''}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {mode === 'stopwatch' && (
                  <button
                    onClick={lap}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#FFEE00',
                      border: '1px solid rgba(255,238,0,0.3)',
                      cursor: 'pointer'
                    }}
                  >
                    Lap
                  </button>
                )}
                {(mode === 'pomodoro' || mode === 'break') && (
                  <button
                    onClick={reset}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#FFEE00',
                      border: '1px solid rgba(255,238,0,0.3)',
                      cursor: 'pointer'
                    }}
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={isRunning ? pause : start}
                  style={{
                    padding: '4px 18px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: '#FFEE00',
                    color: '#000000',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(255, 238, 0, 0.4)'
                  }}
                >
                  {isRunning ? 'Pause' : 'Start'}
                </button>
              </div>
            </div>
          </div>,
          pipWindow.document.body
        )}
    </>
  );
}