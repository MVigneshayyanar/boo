import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Download,
  RotateCcw,
  FlipHorizontal,
  Sparkles,
  X,
  VideoOff,
  ScanFace
} from 'lucide-react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { resolveImageUrl } from '../api.js';

function detectPlacementPreset(product) {
  const text = `${product.category || ''} ${product.type || ''} ${product.name || ''}`.toLowerCase();
  if (text.includes('earring') || text.includes('jhumka') || text.includes('stud')) return 'earrings';
  if (text.includes('tikka') || text.includes('maang') || text.includes('forehead')) return 'maangtikka';
  if (
    text.includes('necklace') ||
    text.includes('choker') ||
    text.includes('pendant') ||
    text.includes('chain') ||
    product.category === 'Jewelry'
  ) {
    return 'necklace';
  }
  return 'dress';
}

// Compute overlay transform (relative to stage center) from MediaPipe 468 face landmarks
function computeTransformFromLandmarks(landmarks, stageW, stageH, preset, mirrored) {
  const pt = (idx) => {
    const lm = landmarks[idx];
    return {
      x: (mirrored ? 1 - lm.x : lm.x) * stageW,
      y: lm.y * stageH
    };
  };

  const leftEar = pt(234);
  const rightEar = pt(454);
  const chin = pt(152);
  const forehead = pt(10);
  const leftEye = pt(33);
  const rightEye = pt(263);

  const faceWidth = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y);
  const faceHeight = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  const angleRad = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const angleDeg = (angleRad * 180) / Math.PI;

  const baseOverlaySize = Math.min(stageW, stageH) * 0.85;
  let anchorX = stageW / 2;
  let anchorY = stageH / 2;
  let targetWidth = faceWidth;

  if (preset === 'necklace') {
    anchorX = chin.x;
    anchorY = chin.y + faceHeight * 0.42;
    targetWidth = faceWidth * 1.45;
  } else if (preset === 'earrings') {
    anchorX = (leftEar.x + rightEar.x) / 2;
    anchorY = (leftEar.y + rightEar.y) / 2 + faceHeight * 0.14;
    targetWidth = faceWidth * 1.28;
  } else if (preset === 'maangtikka') {
    anchorX = forehead.x;
    anchorY = forehead.y + faceHeight * 0.06;
    targetWidth = faceWidth * 0.42;
  } else {
    // Dress / Lehenga / Gown / Sherwani
    anchorX = chin.x;
    anchorY = chin.y + faceHeight * 1.65;
    targetWidth = faceWidth * 2.65;
  }

  const computedScale = Math.max(0.22, Math.min(2.0, targetWidth / baseOverlaySize));
  return {
    x: anchorX - stageW / 2,
    y: anchorY - stageH / 2,
    scale: computedScale,
    rotation: Math.max(-45, Math.min(45, angleDeg))
  };
}

export default function VirtualTryOnModal({ product, onClose }) {
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const photoImgRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);

  const [mode, setMode] = useState('upload'); // 'upload' | 'camera'
  const [userPhotoUrl, setUserPhotoUrl] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);

  // MediaPipe AI Auto-Tracking state
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiReady, setAiReady] = useState(false);
  const [aiStatus, setAiStatus] = useState('Initializing AI tracker...');
  const [preset, setPreset] = useState(() => detectPlacementPreset(product));

  // Overlay transform state (manual fine-tuning or AI-driven)
  const [pos, setPos] = useState({ x: 0, y: product.category === 'Jewelry' ? -30 : 40 });
  const [scale, setScale] = useState(product.category === 'Jewelry' ? 0.65 : 1.05);
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(0.96);
  const [flipX, setFlipX] = useState(false);
  const [removeWhiteBg, setRemoveWhiteBg] = useState(false);
  const [processedProductUrl, setProcessedProductUrl] = useState(resolveImageUrl(product.imageUrl));

  const dragRef = useRef(null);
  const smoothRef = useRef(null);

  // Initialize MediaPipe FaceLandmarker once
  useEffect(() => {
    let cancelled = false;
    async function initMediaPipe() {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU'
          },
          runningMode: 'IMAGE',
          numFaces: 1
        });
        if (!cancelled) {
          landmarkerRef.current = landmarker;
          setAiReady(true);
          setAiStatus('AI Face & Body Landmark Tracking Ready');
        }
      } catch (err) {
        console.warn('MediaPipe init fallback:', err);
        if (!cancelled) {
          setAiStatus('Manual drag mode active (AI model offline)');
          setAiEnabled(false);
        }
      }
    }
    initMediaPipe();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
    };
  }, []);

  // Optional white-background removal for uploaded studio photos
  useEffect(() => {
    const rawUrl = resolveImageUrl(product.imageUrl);
    if (!removeWhiteBg || !rawUrl) {
      setProcessedProductUrl(rawUrl);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 400;
        canvas.height = img.naturalHeight || 400;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        setProcessedProductUrl(canvas.toDataURL('image/png'));
      } catch {
        setProcessedProductUrl(rawUrl);
      }
    };
    img.onerror = () => setProcessedProductUrl(rawUrl);
    img.src = rawUrl;
    return () => {
      cancelled = true;
    };
  }, [removeWhiteBg, product.imageUrl]);

  // Run AI landmark detection on uploaded static photo
  const runStaticPhotoDetection = async () => {
    if (!aiEnabled || !landmarkerRef.current || !photoImgRef.current || !stageRef.current) return;
    try {
      await landmarkerRef.current.setOptions({ runningMode: 'IMAGE' });
      const res = landmarkerRef.current.detect(photoImgRef.current);
      if (res.faceLandmarks && res.faceLandmarks.length > 0) {
        const rect = stageRef.current.getBoundingClientRect();
        const t = computeTransformFromLandmarks(res.faceLandmarks[0], rect.width, rect.height, preset, false);
        setPos({ x: t.x, y: t.y });
        setScale(Number(t.scale.toFixed(2)));
        setRotation(Math.round(t.rotation));
        setAiStatus('Auto-aligned to detected face & neck landmarks');
      } else {
        setAiStatus('No face detected in photo — drag manually to position');
      }
    } catch {
      // ignore detection error
    }
  };

  useEffect(() => {
    if (mode === 'upload' && userPhotoUrl && aiEnabled && aiReady && landmarkerRef.current) {
      const timer = setTimeout(runStaticPhotoDetection, 180);
      return () => clearTimeout(timer);
    }
  }, [mode, userPhotoUrl, preset, aiEnabled, aiReady]);

  // Attach MediaStream to <video> once the element is mounted
  useEffect(() => {
    if (mode === 'camera' && cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [mode, cameraActive]);

  // Real-time live webcam tracking loop
  useEffect(() => {
    if (!cameraActive || mode !== 'camera' || !aiEnabled || !aiReady || !landmarkerRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let stopped = false;
    let lastTs = -1;

    async function startLoop() {
      try {
        await landmarkerRef.current.setOptions({ runningMode: 'VIDEO' });
      } catch {
        return;
      }

      const tick = () => {
        if (stopped) return;
        const video = videoRef.current;
        const stage = stageRef.current;
        if (video && stage && video.readyState >= 2 && video.currentTime !== lastTs) {
          lastTs = video.currentTime;
          try {
            const res = landmarkerRef.current.detectForVideo(video, performance.now());
            if (res.faceLandmarks && res.faceLandmarks.length > 0) {
              const rect = stage.getBoundingClientRect();
              const target = computeTransformFromLandmarks(
                res.faceLandmarks[0],
                rect.width,
                rect.height,
                preset,
                false
              );
              // Exponential smoothing to prevent jitter
              const prev = smoothRef.current || target;
              const alpha = 0.35;
              const smoothed = {
                x: prev.x + (target.x - prev.x) * alpha,
                y: prev.y + (target.y - prev.y) * alpha,
                scale: prev.scale + (target.scale - prev.scale) * alpha,
                rotation: prev.rotation + (target.rotation - prev.rotation) * alpha
              };
              smoothRef.current = smoothed;
              setPos({ x: smoothed.x, y: smoothed.y });
              setScale(Number(smoothed.scale.toFixed(2)));
              setRotation(Math.round(smoothed.rotation));
            }
          } catch {
            // ignore frame error
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    startLoop();
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraActive, mode, aiEnabled, aiReady, preset]);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  async function startCamera() {
    setCameraError('');
    setMode('camera');
    smoothRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError('Could not access camera. Please allow camera permission or upload a photo instead.');
      setCameraActive(false);
    }
  }

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    setMode('upload');
    setUserPhotoUrl(URL.createObjectURL(file));
  }

  function handlePointerDown(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Pause auto-track while user manually drags to fine-tune
    if (cameraActive && aiEnabled) setAiEnabled(false);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y
    };
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function resetTransform() {
    setPos({ x: 0, y: product.category === 'Jewelry' ? -30 : 40 });
    setScale(product.category === 'Jewelry' ? 0.65 : 1.05);
    setRotation(0);
    setOpacity(0.96);
    setFlipX(false);
    if (mode === 'upload' && userPhotoUrl && aiEnabled) {
      runStaticPhotoDetection();
    }
  }

  async function handleDownloadSnapshot() {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const outW = 720;
    const outH = 960;
    const scaleFactor = outW / rect.width;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1b1714';
    ctx.fillRect(0, 0, outW, outH);

    const drawCover = (source, sw, sh) => {
      const targetRatio = outW / outH;
      const srcRatio = sw / sh;
      let sx = 0, sy = 0, cw = sw, ch = sh;
      if (srcRatio > targetRatio) {
        cw = sh * targetRatio;
        sx = (sw - cw) / 2;
      } else {
        ch = sw / targetRatio;
        sy = (sh - ch) / 2;
      }
      ctx.drawImage(source, sx, sy, cw, ch, 0, 0, outW, outH);
    };

    if (mode === 'camera' && videoRef.current && cameraActive) {
      drawCover(videoRef.current, videoRef.current.videoWidth || 720, videoRef.current.videoHeight || 960);
    } else if (userPhotoUrl) {
      const bgImg = await new Promise((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = userPhotoUrl;
      });
      if (bgImg) drawCover(bgImg, bgImg.naturalWidth, bgImg.naturalHeight);
    }

    const prodImg = await new Promise((resolve) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = processedProductUrl;
    });

    if (prodImg) {
      const maxW = outW * 0.85;
      const maxH = outH * 0.85;
      const ratio = Math.min(maxW / prodImg.naturalWidth, maxH / prodImg.naturalHeight);
      const drawW = prodImg.naturalWidth * ratio;
      const drawH = prodImg.naturalHeight * ratio;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(outW / 2 + pos.x * scaleFactor, outH / 2 + pos.y * scaleFactor);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipX ? -scale : scale, scale);
      ctx.drawImage(prodImg, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

    const link = document.createElement('a');
    link.download = `tryon-${product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color="var(--gold)" /> AI Virtual Try-On Studio
            </h2>
            <div style={{ fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
              Trying on: <strong>{product.name}</strong> ({product.type} · {product.color})
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            <X size={16} /> Close
          </button>
        </div>

        <div className="modal-body">
          <div className="tryon-layout">
            {/* Interactive Stage */}
            <div className="tryon-stage" ref={stageRef}>
              {mode === 'camera' && cameraActive ? (
                <video
                  ref={videoRef}
                  className="user-video"
                  autoPlay
                  playsInline
                  muted
                />
              ) : userPhotoUrl ? (
                <img
                  ref={photoImgRef}
                  className="user-photo"
                  src={userPhotoUrl}
                  alt="Your uploaded photo"
                  onLoad={runStaticPhotoDetection}
                />
              ) : (
                <div className="tryon-placeholder">
                  <ScanFace size={40} color="#d8ad56" />
                  <div>
                    <strong>Upload your photo or start Live Camera</strong>
                    <div style={{ fontSize: '0.82rem', opacity: 0.85, marginTop: 4 }}>
                      MediaPipe AI automatically detects your face, neck &amp; ears to align the {product.type.toLowerCase()} in real time.
                    </div>
                  </div>
                </div>
              )}

              {/* Product Overlay */}
              {processedProductUrl && (
                <img
                  src={processedProductUrl}
                  alt={product.name}
                  className="tryon-overlay"
                  draggable={false}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  style={{
                    opacity,
                    transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) rotate(${rotation}deg) scale(${flipX ? -scale : scale}, ${scale})`
                  }}
                />
              )}
            </div>

            {/* Controls Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label className="btn btn-primary" style={{ flex: 1 }}>
                  <Upload size={16} /> Upload Photo
                  <input type="file" accept="image/*" hidden onChange={handlePhotoUpload} />
                </label>
                {cameraActive ? (
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={stopCamera}>
                    <VideoOff size={16} /> Stop Camera
                  </button>
                ) : (
                  <button className="btn btn-gold" style={{ flex: 1 }} onClick={startCamera}>
                    <Camera size={16} /> Live Camera
                  </button>
                )}
              </div>

              {cameraError && <div className="alert alert-error" style={{ marginBottom: 0 }}>{cameraError}</div>}

              {/* MediaPipe AI Auto-Tracking Controls */}
              <div className="card" style={{ padding: 14, boxShadow: 'none', background: 'var(--gold-soft)', borderColor: '#ebd5a7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <strong style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gold-dark)' }}>
                    <ScanFace size={16} /> MediaPipe AI Auto-Align
                  </strong>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                      style={{ accentColor: 'var(--gold)' }}
                    />
                    <span>{aiEnabled ? 'ON' : 'OFF'}</span>
                  </label>
                </div>

                <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginBottom: 10 }}>{aiStatus}</div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'necklace', label: 'Necklace' },
                    { id: 'earrings', label: 'Earrings' },
                    { id: 'maangtikka', label: 'Maang Tikka' },
                    { id: 'dress', label: 'Dress' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`btn btn-sm ${preset === opt.id ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setPreset(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 14, boxShadow: 'none', background: 'var(--surface-soft)' }}>
                <div className="slider-group">
                  <div className="slider-row">
                    <label>
                      <span>Size / Scale</span>
                      <span>{Math.round(scale * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.2"
                      max="2.0"
                      step="0.02"
                      value={scale}
                      onChange={(e) => setScale(Number(e.target.value))}
                    />
                  </div>

                  <div className="slider-row">
                    <label>
                      <span>Rotation</span>
                      <span>{rotation}°</span>
                    </label>
                    <input
                      type="range"
                      min="-45"
                      max="45"
                      step="1"
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value))}
                    />
                  </div>

                  <div className="slider-row">
                    <label>
                      <span>Opacity</span>
                      <span>{Math.round(opacity * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.3"
                      max="1"
                      step="0.02"
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  <label className="toggle-row" style={{ background: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={removeWhiteBg}
                      onChange={(e) => setRemoveWhiteBg(e.target.checked)}
                    />
                    <span>Remove White Background</span>
                  </label>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setFlipX((f) => !f)}>
                      <FlipHorizontal size={14} /> Flip
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={resetTransform}>
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                </div>
              </div>

              <button type="button" className="btn btn-primary" onClick={handleDownloadSnapshot}>
                <Download size={16} /> Save Try-On Snapshot
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
