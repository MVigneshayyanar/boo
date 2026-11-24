import React, { useEffect, useRef, useState } from 'react';
import { Crop, X, ZoomIn, RotateCcw } from 'lucide-react';

export default function SquareImageCropper({ file, onCancel, onCropped }) {
  const [imgSrc, setImgSrc] = useState('');
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const imgRef = useRef(null);

  const BOX_SIZE = 300; // 300x300 visual crop viewport

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleImageLoad(e) {
    const im = e.currentTarget;
    setImgSize({ w: im.naturalWidth, h: im.naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function handlePointerDown(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y
    };
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleApplyCrop() {
    const im = imgRef.current;
    if (!im || !imgSize.w || !imgSize.h) return;

    const OUT_SIZE = 800;
    const canvas = document.createElement('canvas');
    canvas.width = OUT_SIZE;
    canvas.height = OUT_SIZE;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);

    // Base cover scale in BOX_SIZE
    const baseScale = Math.max(BOX_SIZE / imgSize.w, BOX_SIZE / imgSize.h);
    const totalScale = baseScale * zoom;
    const ratio = OUT_SIZE / BOX_SIZE;

    const drawW = imgSize.w * totalScale * ratio;
    const drawH = imgSize.h * totalScale * ratio;
    const cx = OUT_SIZE / 2 + offset.x * ratio;
    const cy = OUT_SIZE / 2 + offset.y * ratio;

    ctx.drawImage(im, cx - drawW / 2, cy - drawH / 2, drawW, drawH);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const baseName = (file.name || 'product').replace(/\.[^.]+$/, '');
        const croppedFile = new File([blob], `${baseName}-1x1.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);
        onCropped(croppedFile, previewUrl);
      },
      'image/jpeg',
      0.92
    );
  }

  const baseScale = imgSize.w && imgSize.h ? Math.max(BOX_SIZE / imgSize.w, BOX_SIZE / imgSize.h) : 1;
  const dispW = imgSize.w * baseScale * zoom;
  const dispH = imgSize.h * baseScale * zoom;

  return (
    <div className="modal-backdrop" style={{ zIndex: 80 }} onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.15rem' }}>
            <Crop size={18} color="var(--gold)" /> Crop Image (1:1 Square)
          </h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
            <X size={15} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              width: BOX_SIZE,
              height: BOX_SIZE,
              maxWidth: '100%',
              aspectRatio: '1 / 1',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 12,
              background: '#1b1714',
              border: '2px solid var(--gold)',
              cursor: 'grab',
              touchAction: 'none',
              userSelect: 'none'
            }}
          >
            {imgSrc && (
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Crop preview"
                onLoad={handleImageLoad}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: dispW || 'auto',
                  height: dispH || 'auto',
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  pointerEvents: 'none',
                  maxWidth: 'none'
                }}
              />
            )}
            {/* Subtle 3x3 rule-of-thirds grid */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                border: '1px solid rgba(255,255,255,0.25)',
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)',
                backgroundSize: '33.33% 33.33%'
              }}
            />
          </div>

          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ZoomIn size={16} color="var(--ink-muted)" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.02"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--gold)' }}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 40 }}>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              title="Reset"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
            >
              <RotateCcw size={13} />
            </button>
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-outline" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-gold" onClick={handleApplyCrop}>
              <Crop size={15} /> Apply 1:1 Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
