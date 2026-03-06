/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Zap, Star, Shield, Volume2, VolumeX, Pause } from 'lucide-react';
import { audioService } from './services/audioService';

// Game Constants
const PLAYER_SIZE = 30;
const GRAVITY_SPEED = 0.35; // Ultra fast flipping
const SPEED_INCREMENT = 0.0008;
const INITIAL_SPEED = 5;
const OBSTACLE_WIDTH = 40;
const OBSTACLE_MIN_GAP = 350; // Even more breathing room
const COLLECTIBLE_SIZE = 15;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'top' | 'bottom' | 'moving' | 'sine';
  direction?: number;
  offset?: number;
}

interface Collectible {
  x: number;
  y: number;
  type: 'point' | 'shield';
  collected: boolean;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [bombCount, setBombCount] = useState(0);
  const [hasBomb, setHasBomb] = useState(false);
  const [canRestart, setCanRestart] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Game State Refs
  const playerRef = useRef({
    y: 0,
    displayY: 0,
    gravityDir: 1, // 1 for down, -1 for up
    shieldHits: 0, // Shield hits remaining
    rotation: 0,
    scaleX: 1,
    scaleY: 1
  });
  
  const bombCountRef = useRef(0);
  const hasBombRef = useRef(false);
  const boostTimerRef = useRef(0);
  const isPausedRef = useRef(false);
  const lastNearMissRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const speedRef = useRef(INITIAL_SPEED);
  const frameRef = useRef(0);
  const lastObstacleXRef = useRef(0);
  const lastCollectibleXRef = useRef(0);

  const createExplosion = (x: number, y: number, color: string, count = 20) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color
      });
    }
  };

  const resetGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const groundY = canvas.height - 60;
    playerRef.current = {
      y: groundY - PLAYER_SIZE,
      displayY: groundY - PLAYER_SIZE,
      gravityDir: 1,
      shieldHits: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1
    };
    obstaclesRef.current = [];
    collectiblesRef.current = [];
    particlesRef.current = [];
    speedRef.current = INITIAL_SPEED;
    bombCountRef.current = 0;
    hasBombRef.current = false;
    boostTimerRef.current = 0;
    setBombCount(0);
    setHasBomb(false);
    setScore(0);
    setMultiplier(1);
    lastObstacleXRef.current = canvas.width;
    lastCollectibleXRef.current = canvas.width + 500;
  }, []);

  const togglePause = useCallback(() => {
    if (gameState !== 'playing') return;
    const newPaused = !isPausedRef.current;
    isPausedRef.current = newPaused;
    setIsPaused(newPaused);
    if (newPaused) {
      audioService.stopBGM();
    } else {
      if (!isMuted) audioService.startBGM();
    }
  }, [gameState, isMuted]);

  const useBomb = useCallback(() => {
    if (!hasBombRef.current || gameState !== 'playing' || isPausedRef.current) return;
    
    // Destroy all obstacles on screen
    obstaclesRef.current.forEach(obs => {
      createExplosion(obs.x + obs.width / 2, obs.y + obs.height / 2, '#ff00ff', 15);
    });
    obstaclesRef.current = [];
    
    // Reset bomb state
    hasBombRef.current = false;
    bombCountRef.current = 0;
    setHasBomb(false);
    setBombCount(0);
    
    if (!isMuted) audioService.playExplosion();
  }, [gameState, isMuted]);

  const handleAction = useCallback(() => {
    if (isPausedRef.current) return;
    if (!audioInitialized) {
      audioService.init();
      setAudioInitialized(true);
    }
    audioService.resume();

    if (gameState === 'start') {
      resetGame();
      setGameState('playing');
      audioService.startBGM();
    } else if (gameState === 'playing') {
      playerRef.current.gravityDir *= -1;
      // Squash and stretch effect
      playerRef.current.scaleX = 1.5;
      playerRef.current.scaleY = 0.5;
      if (!isMuted) audioService.playJump();
    } else if (gameState === 'gameover' && canRestart) {
      resetGame();
      setGameState('playing');
      audioService.startBGM();
    }
  }, [gameState, resetGame, audioInitialized, isMuted, canRestart]);

  useEffect(() => {
    audioService.setMute(isMuted);
  }, [isMuted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleAction();
      } else if (e.code === 'KeyB' || e.code === 'KeyE') {
        e.preventDefault();
        useBomb();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Re-center player on resize if playing
      if (gameState === 'playing') {
        const groundY = canvas.height - 60;
        const ceilingY = 60;
        playerRef.current.y = playerRef.current.gravityDir === 1 ? groundY - PLAYER_SIZE : ceilingY;
        playerRef.current.displayY = playerRef.current.y;
      }
    };
    
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let animationFrameId: number;

    const update = () => {
      if (gameState !== 'playing') return;

      const p = playerRef.current;
      const h = canvas.height;
      const groundY = h - 60;
      const ceilingY = 60;

      // Update Player Position (Smooth Gravity Flip)
      const targetY = p.gravityDir === 1 ? groundY - PLAYER_SIZE : ceilingY;
      p.y = targetY;
      p.displayY += (p.y - p.displayY) * GRAVITY_SPEED;
      
      // Dynamic rotation: rotate to match gravity direction (0 or 180 deg) + slight lean
      const targetRotation = p.gravityDir === 1 ? 0 : Math.PI;
      const lean = Math.sin(frameRef.current * 0.1) * 0.05; // Subtle breathing/lean
      p.rotation += (targetRotation + lean - p.rotation) * 0.2;

      // Recover scale (Squash & Stretch)
      p.scaleX += (1 - p.scaleX) * 0.15;
      p.scaleY += (1 - p.scaleY) * 0.15;
      
      if (boostTimerRef.current > 0) boostTimerRef.current--;

      // Speed up
      let currentSpeed = speedRef.current;
      if (boostTimerRef.current > 0) currentSpeed *= 1.5;
      
      speedRef.current += SPEED_INCREMENT;

      // Update Particles
      particlesRef.current.forEach(part => {
        part.x += part.vx;
        part.y += part.vy;
        part.life -= 0.02;
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      // Update Obstacles
      obstaclesRef.current.forEach(obs => {
        obs.x -= currentSpeed;
        if (obs.type === 'moving') {
          obs.y += (obs.direction || 1) * 2;
          if (obs.y > groundY - obs.height || obs.y < ceilingY) {
            obs.direction = (obs.direction || 1) * -1;
          }
        } else if (obs.type === 'sine') {
          obs.y = (ceilingY + (groundY - ceilingY) / 2) + Math.sin(frameRef.current * 0.05 + (obs.offset || 0)) * 100;
        }

        // Near Miss Detection
        if (obs.x < 100 + PLAYER_SIZE && obs.x + obs.width > 100) {
          const dy = Math.abs(p.displayY - obs.y);
          if (dy < PLAYER_SIZE + 30 && frameRef.current - lastNearMissRef.current > 30) {
            lastNearMissRef.current = frameRef.current;
            createExplosion(100, p.displayY, '#ffffff', 5);
          }
        }
      });
      obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > -100);

      // Update Collectibles
      collectiblesRef.current.forEach(col => {
        col.x -= currentSpeed;
        // Collision with player
        if (!col.collected) {
          const dx = (100 + PLAYER_SIZE / 2) - col.x;
          const dy = (p.displayY + PLAYER_SIZE / 2) - col.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < PLAYER_SIZE) {
            col.collected = true;
            if (col.type === 'point') {
              setScore(s => s + 500);
              
              // Bomb logic: every 5 stars
              if (!hasBombRef.current) {
                bombCountRef.current++;
                if (bombCountRef.current >= 5) {
                  hasBombRef.current = true;
                  setHasBomb(true);
                }
                setBombCount(bombCountRef.current);
              }

              createExplosion(col.x, col.y, '#ffff00', 10);
              if (!isMuted) audioService.playCollect();
            } else if (col.type === 'shield') {
              p.shieldHits = 2; // Hit-based shield
              boostTimerRef.current = 30; // Small boost for 0.5s
              createExplosion(col.x, col.y, '#00ffff', 15);
              if (!isMuted) audioService.playCollect();
            }
          }
        }
      });
      collectiblesRef.current = collectiblesRef.current.filter(col => col.x > -50);

      // Spawn Logic
      if (canvas.width - lastObstacleXRef.current > OBSTACLE_MIN_GAP) {
        const typeRoll = Math.random();
        let type: 'top' | 'bottom' | 'moving' | 'sine' = Math.random() > 0.5 ? 'top' : 'bottom';
        
        if (typeRoll > 0.8) type = 'moving';
        if (typeRoll > 0.92 && score > 3000) type = 'sine';

        const height = type === 'sine' ? 30 : (40 + Math.random() * 80);
        const width = type === 'sine' ? 30 : OBSTACLE_WIDTH;
        const x = canvas.width;
        
        // Randomize Y more for moving/sine, but keep top/bottom strictly at boundaries
        let y = type === 'bottom' ? groundY - height : ceilingY;
        if (type === 'moving' || type === 'sine') {
          y = ceilingY + Math.random() * (groundY - ceilingY - height);
        }
        
        obstaclesRef.current.push({ x, y, width, height, type, direction: Math.random() > 0.5 ? 1 : -1, offset: Math.random() * Math.PI * 2 });
        lastObstacleXRef.current = x;
      } else {
        lastObstacleXRef.current -= currentSpeed;
      }

      // Spawn Collectibles
      if (canvas.width - lastCollectibleXRef.current > 800) {
        const type = Math.random() > 0.85 ? 'shield' : 'point';
        const x = canvas.width;
        const y = Math.random() > 0.5 ? groundY - 30 : ceilingY + 30;
        collectiblesRef.current.push({ x, y, type, collected: false });
        lastCollectibleXRef.current = x;
      } else {
        lastCollectibleXRef.current -= currentSpeed;
      }

      // Collision Detection
      const playerRect = { x: 100, y: p.displayY, w: PLAYER_SIZE, h: PLAYER_SIZE };
      for (const obs of obstaclesRef.current) {
        if (
          playerRect.x < obs.x + obs.width &&
          playerRect.x + playerRect.w > obs.x &&
          playerRect.y < obs.y + obs.height &&
          playerRect.y + playerRect.h > obs.y
        ) {
          if (p.shieldHits > 0) {
            p.shieldHits--;
            const oldX = obs.x;
            const oldY = obs.y;
            obs.x = -1000; // Destroy obstacle
            setScore(s => s + 1000);
            createExplosion(oldX + obs.width/2, oldY + obs.height/2, '#00ffff', 15);
            continue;
          } else {
            setGameState('gameover');
            setCanRestart(false);
            setTimeout(() => setCanRestart(true), 500); // 0.5s delay before restart allowed
            audioService.stopBGM();
            createExplosion(playerRect.x + PLAYER_SIZE/2, playerRect.y + PLAYER_SIZE/2, '#ff00ff', 40);
            if (!isMuted) audioService.playExplosion();
            // Ensure we don't process any more updates this frame
            return;
          }
        }
      }

      setScore(s => s + Math.floor(currentSpeed));
      setMultiplier(1 + Math.floor(score / 10000) * 0.5);
    };

    const draw = () => {
      const currentSpeed = speedRef.current;
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const h = canvas.height;
      const w = canvas.width;

      // Draw Grid
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const offset = (frameRef.current * currentSpeed) % 50;
      for (let i = -offset; i < w; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      }

      // Draw Boundaries
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(w, 60); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h - 60); ctx.lineTo(w, h - 60); ctx.stroke();

      // Draw Particles
      particlesRef.current.forEach(part => {
        ctx.globalAlpha = part.life;
        ctx.fillStyle = part.color;
        ctx.fillRect(part.x, part.y, 4, 4);
      });
      ctx.globalAlpha = 1.0;

      // Draw Player
      const p = playerRef.current;
      
      ctx.save();
      ctx.translate(100 + PLAYER_SIZE / 2, p.displayY + PLAYER_SIZE / 2);
      ctx.rotate(p.rotation);
      ctx.scale(p.scaleX, p.scaleY);
      
      // Shield Glow
      if (p.shieldHits > 0) {
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20 + Math.sin(frameRef.current * 0.1) * 10;
        ctx.strokeStyle = ctx.shadowColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_SIZE * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw hit indicators
        ctx.fillStyle = '#00ffff';
        for (let i = 0; i < p.shieldHits; i++) {
          ctx.beginPath();
          ctx.arc(Math.cos(i * Math.PI) * 20, Math.sin(i * Math.PI) * 20, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = '#ff00ff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 20;
      ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-PLAYER_SIZE / 2 + 2, -PLAYER_SIZE / 2 + 2, PLAYER_SIZE - 4, PLAYER_SIZE - 4);
      ctx.restore();

      // Draw Collectibles
      collectiblesRef.current.forEach(col => {
        if (col.collected) return;
        ctx.save();
        ctx.translate(col.x, col.y);
        ctx.rotate(frameRef.current * 0.05);
        ctx.fillStyle = col.type === 'shield' ? '#00ffff' : '#ffff00';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 15;
        
        if (col.type === 'shield') {
          ctx.beginPath();
          ctx.moveTo(0, -COLLECTIBLE_SIZE);
          ctx.lineTo(COLLECTIBLE_SIZE, 0);
          ctx.lineTo(0, COLLECTIBLE_SIZE);
          ctx.lineTo(-COLLECTIBLE_SIZE, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            ctx.lineTo(Math.cos((i * 72) * Math.PI / 180) * COLLECTIBLE_SIZE, 
                       Math.sin((i * 72) * Math.PI / 180) * COLLECTIBLE_SIZE);
            ctx.lineTo(Math.cos((i * 72 + 36) * Math.PI / 180) * (COLLECTIBLE_SIZE/2), 
                       Math.sin((i * 72 + 36) * Math.PI / 180) * (COLLECTIBLE_SIZE/2));
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      });

      // Draw Obstacles
      obstaclesRef.current.forEach(obs => {
        ctx.save();
        ctx.fillStyle = obs.type === 'sine' ? '#ffffff' : '#00ffff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 15;
        
        if (obs.type === 'sine') {
          ctx.translate(obs.x + obs.width/2, obs.y + obs.height/2);
          ctx.rotate(frameRef.current * 0.1);
          ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
        } else {
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(obs.x + obs.width / 2, obs.y);
          ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height);
          ctx.stroke();
        }
        ctx.restore();
      });

      ctx.shadowBlur = 0;
      frameRef.current++;
      ctx.restore();
    };

    const loop = () => {
      if (!isPausedRef.current) {
        update();
      }
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'gameover') {
      if (score > highScore) setHighScore(score);
    }
  }, [gameState, score, highScore]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#050505] select-none touch-none overflow-hidden">
      {/* HUD */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-cyan-400 text-[10px] font-display uppercase tracking-widest opacity-70">Distance</span>
          <span className="text-3xl sm:text-4xl font-display font-bold neon-glow">{Math.floor(score / 100)}m</span>
          {multiplier > 1 && (
            <motion.span 
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="text-fuchsia-500 text-xs font-bold"
            >
              x{multiplier.toFixed(1)} Speed Bonus
            </motion.span>
          )}
        </div>
        
        <div className="hidden sm:flex flex-col items-center">
          <h1 className="text-xl font-display font-bold italic tracking-tighter text-white">
            NEON<span className="text-fuchsia-500">FLIP</span>
          </h1>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex gap-2 mb-2 pointer-events-auto">
            {gameState === 'playing' && (
              <button 
                onClick={(e) => { e.stopPropagation(); togglePause(); }}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                {isPaused ? <Play size={16} className="text-green-400" /> : <Pause size={16} className="text-yellow-400" />}
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              {isMuted ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} className="text-cyan-400" />}
            </button>
          </div>
          <span className="text-fuchsia-400 text-[10px] font-display uppercase tracking-widest opacity-70">Best</span>
          <span className="text-3xl sm:text-4xl font-display font-bold text-fuchsia-500">{Math.floor(highScore / 100)}m</span>
          
          {/* Bomb Progress / Button */}
          <div className="mt-4 flex flex-col items-end pointer-events-auto">
            <AnimatePresence mode="wait">
              {hasBomb ? (
                <motion.button
                  key="bomb-btn"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); useBomb(); }}
                  className="w-12 h-12 rounded-full bg-fuchsia-600 flex items-center justify-center shadow-[0_0_20px_#f0f] border-2 border-white/20"
                >
                  <Zap size={24} className="text-white fill-white" />
                </motion.button>
              ) : (
                <motion.div 
                  key="bomb-progress"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex gap-1"
                >
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-2 h-2 rounded-full border border-fuchsia-500/30 ${i < bombCount ? 'bg-fuchsia-500 shadow-[0_0_5px_#f0f]' : 'bg-transparent'}`} 
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <span className="text-[8px] text-fuchsia-400/50 uppercase tracking-tighter mt-1">
              {hasBomb ? 'PRESS B TO BLAST' : 'COLLECT 5 STARS'}
            </span>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div ref={containerRef} className="relative w-full h-full max-h-[600px] bg-[#0a0a0a] overflow-hidden border-y border-cyan-500/20" 
        onClick={(e) => {
          if (gameState === 'playing') handleAction();
        }}
      >
        <canvas ref={canvasRef} className="w-full h-full" />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === 'start' && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer"
              onClick={(e) => { e.stopPropagation(); handleAction(); }}
            >
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                className="flex flex-col items-center"
              >
                <div className="w-20 h-20 rounded-full bg-cyan-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,255,255,0.6)]">
                  <Play size={40} className="text-black ml-1" />
                </div>
                <h2 className="text-3xl font-display font-bold mb-2 tracking-widest">NEON FLIP</h2>
                <p className="text-cyan-400/70 font-display text-xs animate-pulse text-center px-8">
                  TAP TO FLIP GRAVITY<br/>AVOID SPIKES • COLLECT ORBS
                </p>
              </motion.div>
            </motion.div>
          )}

          {isPaused && gameState === 'playing' && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
              onClick={(e) => { e.stopPropagation(); togglePause(); }}
            >
              <motion.div 
                initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="w-20 h-20 rounded-full bg-yellow-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,0,0.4)]">
                  <Pause size={40} className="text-black" />
                </div>
                <h2 className="text-4xl font-display font-bold mb-2 tracking-widest text-white">PAUSED</h2>
                <p className="text-yellow-400/70 font-display text-xs animate-pulse">
                  TAP TO RESUME
                </p>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md cursor-pointer"
              onClick={(e) => { e.stopPropagation(); if (canRestart) handleAction(); }}
            >
              <div className="text-fuchsia-500 mb-4">
                <Zap size={64} fill="currentColor" />
              </div>
              <h2 className="text-5xl font-display font-bold mb-2 tracking-tighter text-white">SYSTEM FAILURE</h2>
              <div className="flex gap-12 mb-10">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Final Distance</p>
                  <p className="text-4xl font-display font-bold">{Math.floor(score / 100)}m</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Personal Best</p>
                  <p className="text-4xl font-display font-bold text-cyan-400">{Math.floor(highScore / 100)}m</p>
                </div>
              </div>
              
              <button 
                onClick={(e) => { e.stopPropagation(); if (canRestart) handleAction(); }}
                disabled={!canRestart}
                className={`px-10 py-5 bg-white text-black font-display font-bold rounded-full flex items-center gap-3 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)] ${!canRestart ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cyan-400'}`}
              >
                <RotateCcw size={24} />
                REBOOT SYSTEM
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Controls Hint */}
        {gameState === 'playing' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 opacity-20 pointer-events-none sm:hidden">
            <div className="flex flex-col items-center">
              <Zap size={20} />
              <span className="text-[8px] uppercase">Tap to Flip</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-4 w-full px-8 flex justify-between items-center text-[10px] text-gray-600 uppercase tracking-[0.2em]">
        <div className="flex gap-4">
          <div className="flex items-center gap-1"><Star size={10} className="text-yellow-500"/> +500 PTS</div>
          <div className="flex items-center gap-1"><Shield size={10} className="text-cyan-500"/> SHIELD</div>
        </div>
        <p className="opacity-50">v1.2 // STABLE BUILD</p>
      </div>
    </div>
  );
}
