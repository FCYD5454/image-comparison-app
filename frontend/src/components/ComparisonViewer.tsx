import React, { useEffect, useMemo, useRef, useState } from "react";
import { useComparisonStore } from "../store/comparisonStore";
import clsx from "classnames";
import { generateHeatmap } from "../utils/diff";

function buildFilter(channel: ReturnType<typeof useComparisonStore.getState>["channel"], gamma: number, brightness: number, edgeStrength: number, edgeOn: boolean) {
  const filters: string[] = [];
  switch (channel) {
    case "luma":
      filters.push("grayscale(1)");
      break;
    case "r":
      filters.push("grayscale(1)", "sepia(1)", "saturate(6)", "hue-rotate(-50deg)");
      break;
    case "g":
      filters.push("grayscale(1)", "sepia(1)", "saturate(6)", "hue-rotate(80deg)");
      break;
    case "b":
      filters.push("grayscale(1)", "sepia(1)", "saturate(6)", "hue-rotate(200deg)");
      break;
    default:
      break;
  }
  filters.push(`brightness(${brightness})`, `contrast(${gamma})`);
  if (edgeOn) {
    filters.push(`contrast(${1 + edgeStrength})`, `saturate(${1 + edgeStrength * 0.8})`);
  }
  return filters.join(" ");
}

export const ComparisonViewer: React.FC = () => {
  const {
    beforeImage,
    afterImage,
    thirdImage,
    mode,
    // splitDirection,
    // splitCount,
    zoom,
    pan,
    setZoom,
    setPan,
    heatmap,
    heatmapImage,
    heatmapStatus,
    setHeatmapImage,
    setHeatmapStatus,
    blink,
    magnifier,
    channel,
    edgeEmphasis,
    gammaPreview,
    gridRuler,
    sliderOpacity,
    sliderPositions,
    images,
    compareOrder,
    layerSettings,
    sequence,
    setSequence,
    getChain,
  } = useComparisonStore();

  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [magnifierSource, setMagnifierSource] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
         setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const [blinkVisible, setBlinkVisible] = useState(true);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const transitionProgressRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const [transitionProgress, setTransitionProgress] = useState(0);

  const filter = useMemo(
    () =>
      buildFilter(
        channel,
        gammaPreview.enabled ? gammaPreview.gamma : 1,
        gammaPreview.enabled ? gammaPreview.brightness : 1,
        edgeEmphasis.strength,
        edgeEmphasis.enabled
      ),
    [channel, gammaPreview.enabled, gammaPreview.gamma, gammaPreview.brightness, edgeEmphasis.enabled, edgeEmphasis.strength]
  );

  const applyOnAfter = heatmap.applyTo === "after" || heatmap.applyTo === "both";
  const applyOnBefore = heatmap.applyTo === "before" || heatmap.applyTo === "both";

  const baseTransform = `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`;

  const layerVisible = (id?: string) => (id ? layerSettings[id]?.visible ?? true : true);
  const layerOpacity = (id?: string) => (id ? layerSettings[id]?.opacity ?? 1 : 1);

  const renderImage = (url: string, alt: string, absolute = true, extraOpacity = 1, id?: string) => {
    const visible = layerVisible(id);
    if (!visible) return null;
    const effectiveOpacity = extraOpacity * layerOpacity(id);
    const img = (
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-contain"
        style={{
          filter,
          transform: baseTransform,
          transformOrigin: "center",
          transition: "filter 120ms ease",
          opacity: effectiveOpacity,
        }}
        draggable={false}
      />
    );
    if (absolute) {
      return <div className="absolute inset-0 flex items-center justify-center">{img}</div>;
    }
    return <div className="flex h-full w-full items-center justify-center">{img}</div>;
  };

  // Blink timer
  useEffect(() => {
    if (!blink.enabled) {
      setBlinkVisible(true);
      return;
    }
    const intervalMs = 1000 / blink.rateHz / 2;
    const timer = setInterval(() => {
      setBlinkVisible((v) => !v);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [blink.enabled, blink.rateHz]);

  // Init worker once
  useEffect(() => {
    if (typeof Worker === "undefined") return;
    const w = new Worker(new URL("../workers/heatmapWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const resolveImageById = (id?: string) => images.find((img) => img.id === id);
  const layers = useMemo(() => {
    const explicit = compareOrder
      .map((id) => resolveImageById(id))
      .filter(Boolean) as typeof images;
    if (explicit.length > 0) return explicit; // layers
    // fallback to legacy
    return [beforeImage, afterImage, thirdImage].filter(Boolean) as typeof images;
  }, [compareOrder, images, beforeImage, afterImage, thirdImage]);
  const sideBySide = useComparisonStore((s) => s.sideBySide);
  const hasBoth = layers.length >= 2;

  // When layers change, reset zoom/pan to keep aligned
  useEffect(() => {
    if (layers.length) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [layers, setZoom, setPan]);

  // Sequence Playback Logic
  useEffect(() => {
    if (mode !== "sequence" || !sequence.playing || layers.length === 0) {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        return;
    }

    // Determine next index first to check relationship
    const nextIndex = sequence.direction === "backward"
        ? (sequence.index - 1 + layers.length) % layers.length
        : (sequence.index + 1) % layers.length;
    
    // Check if current and next are linked
    const currentLayer = layers[sequence.index % layers.length];
    const nextLayer = layers[nextIndex];
    
    // Only crossfade if enabled globally AND (not limited to linked OR (limited to linked AND they are linked))
    // Determine linkage: Check if current -> linkedId === next or next -> linkedId === current?
    // Actually our link is directional (linkedId points to next). But for playback, we might want "belong to same chain".
    // Or strictly A -> B link. 
    // "linkedId" property points to the NEXT image in a chain.
    // If playing backward, we go B -> A. If B is linked from A, does it count?
    // Let's use "belong to same chain" logic or "direct link".
    // User said "關聯 image". Usually means they are in the same group.
    
    // Let's check if they share a groupName or direct link.
    // getChain(id) returns the whole chain.
    // A simpler check: 
    const areLinked = currentLayer?.groupName && nextLayer?.groupName && currentLayer.groupName === nextLayer.groupName;
    // Or strict link? "one image can bond to anther".
    // If user set "crossfadeOnlyLinked", we only fade if `areLinked` is true.
    
    const shouldCrossfade = sequence.crossfade && (!sequence.crossfadeOnlyLinked || areLinked);

    if (!shouldCrossfade) {
        // Simple Interval Logic
        const intervalMs = 1000 / Math.max(1, sequence.speed);
        const timer = setInterval(() => {
          setSequence({
            index:
              sequence.direction === "backward"
                ? (sequence.index - 1 + layers.length) % layers.length
                : (sequence.index + 1) % layers.length,
          });
        }, intervalMs);
        return () => clearInterval(timer);
    } else {
        // Crossfade Animation Logic
        let lastTime = performance.now();
        // Reset progress when starting a new transition
        // Actually this effect re-runs when index changes? No, only when dependencies change.
        // Index is in dependency. So this effect runs ONCE per frame change?
        // No, `sequence.index` changes, so effect re-runs.
        // We need to handle the animation for ONE transition here.
        // Wait, if effect re-runs, we lose local vars? Yes.
        // But `transitionProgressRef` persists.
        
        // Correct approach:
        // We need a persistent animation loop that handles index updates itself, OR
        // this effect handles ONE transition and then triggers the next index update.
        // If we use `setSequence` to update index, it triggers re-render and re-effect.
        
        // Let's reset progress to 0 at start of effect (new index).
        transitionProgressRef.current = 0;
        setTransitionProgress(0);

        const animate = (time: number) => {
            const deltaTime = time - lastTime;
            lastTime = time;
            
            // Speed = FPS (frames per second)
            // Duration of one full transition = (1000ms / speed) / crossfadeSpeedFactor
            const baseDuration = 1000 / Math.max(0.1, sequence.speed);
            const duration = baseDuration / Math.max(0.1, sequence.crossfadeSpeed);
            
            // Increment progress
            transitionProgressRef.current += deltaTime / duration;
            
            if (transitionProgressRef.current >= 1) {
                // Advance frame
                setSequence({
                    index: nextIndex
                });
                // Effect will re-run for next frame
                return; 
            }
            
            setTransitionProgress(transitionProgressRef.current);
            animationFrameRef.current = requestAnimationFrame(animate);
        };
        
        animationFrameRef.current = requestAnimationFrame(animate);
        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }
  }, [mode, sequence.playing, sequence.speed, sequence.direction, sequence.crossfade, sequence.crossfadeOnlyLinked, sequence.crossfadeSpeed, layers.length, sequence.index, setSequence]);

  // Heatmap generation lifecycle (prefers worker, fallback to main thread)
  useEffect(() => {
    const w = workerRef.current;
    const selBase = heatmap.baseId ? layers.find((l) => l.id === heatmap.baseId) : layers[0];
    const selTarget = heatmap.targetId ? layers.find((l) => l.id === heatmap.targetId) : layers[1];
    const baseUrl = selBase?.url;
    const targetUrl = selTarget?.url;

    if (!heatmap.enabled || !baseUrl || !targetUrl) {
      setHeatmapImage(null, null);
      setHeatmapStatus("idle");
      return;
    }

    const reqId = ++requestIdRef.current;
    setHeatmapStatus("processing");

    if (w) {
      const handleMessage = (event: MessageEvent<any>) => {
        const data = event.data;
        if (!data || data.id !== reqId) return;
        if (data.error) {
          setHeatmapStatus("error");
          setHeatmapImage(null, null);
        } else {
          setHeatmapImage(data.dataUrl, { mean: data.mean, max: data.max });
          setHeatmapStatus("idle");
        }
      };
      w.addEventListener("message", handleMessage);
      w.postMessage({ id: reqId, beforeUrl: baseUrl, afterUrl: targetUrl, threshold: heatmap.threshold });
      return () => {
        w.removeEventListener("message", handleMessage);
      };
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await generateHeatmap(baseUrl, targetUrl, { threshold: heatmap.threshold });
        if (cancelled) return;
        setHeatmapImage(res.dataUrl, { mean: res.meanDelta, max: res.maxDelta });
        setHeatmapStatus("idle");
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setHeatmapStatus("error");
        setHeatmapImage(null, null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [heatmap.enabled, heatmap.threshold, beforeImage?.url, afterImage?.url, setHeatmapImage, setHeatmapStatus]);

  const targetGroupBaseIndex = useMemo(() => {
    if (!blink.enabled || !blink.targetGroup) return -1;
    return layers.findIndex(l => l.groupName === blink.targetGroup);
  }, [blink.enabled, blink.targetGroup, layers]);

  const visibleLayers = useMemo(() => {
    return layers.filter(l => layerVisible(l.id));
  }, [layers, layerSettings]);

  const { cols, rows } = useMemo(() => {
    if (mode !== "multiSplit" || visibleLayers.length === 0 || containerSize.width === 0) return { cols: 1, rows: 1 };
    
    // Average Aspect Ratio
    let totalAR = 0;
    let count = 0;
    visibleLayers.forEach(l => {
        if (l.width && l.height) {
            totalAR += l.width / l.height;
            count++;
        }
    });
    const avgAR = count > 0 ? totalAR / count : (4/3); // Default to 4:3 if unknown

    const countN = visibleLayers.length;
    let bestCols = Math.ceil(Math.sqrt(countN));
    let bestFill = 0;

    for (let c = 1; c <= countN; c++) {
        const r = Math.ceil(countN / c);
        const cellW = containerSize.width / c;
        const cellH = containerSize.height / r;
        
        if (cellW <= 0 || cellH <= 0) continue;

        const cellAR = cellW / cellH;
        // Fill factor
        const fill = cellAR > avgAR ? (avgAR / cellAR) : (cellAR / avgAR);
        
        if (fill > bestFill) {
            bestFill = fill;
            bestCols = c;
        }
    }
    
    return { cols: bestCols, rows: Math.ceil(countN / bestCols) };

  }, [mode, visibleLayers, containerSize.width, containerSize.height]);

  return (
    <div id="comparison-container" ref={containerRef} className="glass-panel relative mt-4 h-[70vh] overflow-hidden rounded-2xl border border-slate-800/80">
      <div
        className="absolute inset-0 bg-slate-900/50"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const local = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          setCursor(local);
          setContainerSize({ width: rect.width, height: rect.height });

          if (!magnifier.enabled || layers.length === 0) {
            setMagnifierSource(null);
            return;
          }

          const getUrlById = (id?: string | null) => (id ? layers.find((l) => l.id === id)?.url ?? null : null);

          // If user指定目標層
          if (magnifier.targetId) {
            setMagnifierSource(getUrlById(magnifier.targetId));
            return;
          }

          const magnifierLinks = useComparisonStore.getState().magnifierLinks;
          // Show Current - 1 layer (wrapping to top if bottom)
          const getPrevUrl = (idx: number) => {
            const len = layers.length;
            // Iterate backwards from idx to find first visible layer
            for (let i = 1; i < len; i++) {
               const prevIdx = (idx - i + len) % len;
               const layer = layers[prevIdx];
               if (layer && layerVisible(layer.id)) {
                 return layer.url;
               }
            }
            return null; // No other visible layers
          };

          if (mode === "slider") {
            // In slider mode (overlay), we want to show the layer UNDER the cursor.
            // But visually, multiple layers can be stacked.
            // We find the TOP-MOST layer that is visible at the current X position.
            // Layer 0 is base (always visible if nothing covers it).
            // Layer i (i>=1) is visible if cursor X is to the left of its slider (if clipping left side?)
            // Wait, clipPath: inset(0 ${100 - clip}% 0 0) means it clips the RIGHT side.
            // So the layer is visible from 0 to clip%.
            // If clip is 50%, layer is visible from 0% to 50%.
            // So if cursor is at 20%, Layer 1 (50%) covers Layer 0.
            // If cursor is at 60%, Layer 1 is clipped, so Layer 0 is visible.
            // We iterate from top (highest index) to bottom. The first one that "covers" the cursor is the current one.
            
            let currentLayerIdx = 0;
            const xPercent = (local.x / rect.width) * 100;
            
            // Check layers from top to bottom (excluding base layer 0)
            for (let i = layers.length - 1; i >= 1; i--) {
               // Skip invisible layers
               if (!layerVisible(layers[i].id)) continue;

               const sliderPos = sliderPositions[i - 1] ?? 50;
               // If cursor is within the visible range of this layer (0 to sliderPos)
               if (xPercent <= sliderPos) {
                 currentLayerIdx = i;
                 break;
               }
            }
            
            // Show the layer "previous" to the one we are looking at (透視 effect)
            setMagnifierSource(getPrevUrl(currentLayerIdx));
          } else if (mode === "sideBySide") {
            const isLeft = local.x < rect.width / 2;
            const left = sideBySide.leftId ? layers.find((l) => l.id === sideBySide.leftId) : layers[0];
            const right =
              sideBySide.rightId ? layers.find((l) => l.id === sideBySide.rightId) : layers.find((l) => l !== left) ?? layers[1];
            const targetUrl = isLeft ? right?.url ?? null : left?.url ?? null;
            setMagnifierSource(targetUrl);
          } else if (mode === "multiSplit") {
            const count = visibleLayers.length;
            if (count === 0) {
                setMagnifierSource(null);
                return;
            }
            // Use pre-calculated grid layout
            const cellW = containerSize.width / cols;
            const cellH = containerSize.height / rows;

            const colIdx = Math.min(cols - 1, Math.max(0, Math.floor(local.x / cellW)));
            const rowIdx = Math.min(rows - 1, Math.max(0, Math.floor(local.y / cellH)));
            
            const layerIdx = rowIdx * cols + colIdx;
            const current = visibleLayers[layerIdx]; // Use visibleLayers instead of layers

            if (current?.id) {
                // 1. Manual Link
                const linkedId = magnifierLinks[current.id];
                if (linkedId) {
                    const target = layers.find(l => l.id === linkedId);
                    setMagnifierSource(target?.url ?? null);
                } else {
                    // 2. Chain Logic (Bonded Range)
                    const fullChain = getChain(current.id);
                    // Filter chain to only those in current 'layers' (regardless of visibility for magnifier target)
                    const activeChain = fullChain.filter(item => 
                        layers.some(l => l.id === item.id)
                    );

                    if (activeChain.length > 1) {
                        const chainIdx = activeChain.findIndex(item => item.id === current!.id);
                        if (chainIdx !== -1) {
                            // Current - 1 within chain (wrapping)
                            const prevItem = activeChain[(chainIdx - 1 + activeChain.length) % activeChain.length];
                            setMagnifierSource(prevItem.url);
                        } else {
                            setMagnifierSource(null);
                        }
                    } else {
                        // Not in a chain -> Disable magnifier
                        setMagnifierSource(null);
                    }
                }
            } else {
                setMagnifierSource(null);
            }
          } else {
            setMagnifierSource(null);
          }
        }}
        onMouseLeave={() => {
          setCursor(null);
          setMagnifierSource(null);
        }}
      >
        {!hasBoth ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
            <p className="text-lg font-semibold text-slate-200">請先上傳 Before / After 圖片</p>
            <p className="text-sm text-slate-500">上方控制區可設定滑桿、並排、熱度圖、閃爍等人眼感知模式</p>
          </div>
        ) : null}

        {layers.length >= 2 && mode === "slider" ? (
          <div className="relative h-full w-full">
            {/* base layer */}
            {(() => {
                const layer0 = layers[0];
                if (!layer0) return null;
                
                // If blinking is enabled AND a specific target group is selected:
                // Hide base layer if it doesn't match the group.
                if (blink.enabled && blink.targetGroup && layer0.groupName !== blink.targetGroup) {
                    return null;
                }
                return renderImage(layer0.url, layer0.filename ?? "Layer 1", true, 1, layer0.id);
            })()}

            {/* overlay layers controlled by sliderPositions */}
            {layers.slice(1).map((layer, idx) => {
              // Only blink if layer is part of a bonded chain
              const chain = getChain(layer.id!);
              const isLinked = chain.length > 1;
              const matchesGroup = blink.targetGroup ? layer.groupName === blink.targetGroup : true;
              const isBlinking = blink.enabled && isLinked && matchesGroup;
              const realIndex = idx + 1;
              
              // If blinking is enabled AND a specific target group is selected:
              // Hide layers that do NOT match the target group (and are not the base layer 0).
              // This isolates the view to only the blinking group.
              if (blink.enabled && blink.targetGroup && layer.groupName !== blink.targetGroup) {
                  return null;
              }

              const clip = isBlinking ? 100 : (sliderPositions[idx] ?? 50); // Show full if blinking
              
              // Determine opacity: if blinking, toggle 0/1. If not, use legacy/settings.
              // We also respect the layer's own opacity setting (handled inside renderImage via layerOpacity).
              // Here we apply an *extra* opacity multiplier for the blinking effect.
              let extraOpacity = idx === 0 ? sliderOpacity : 1; 
              if (isBlinking) {
                 // If this layer is the base of the target group (the lowest index in that group), keep it visible.
                 const isGroupBase = blink.targetGroup && realIndex === targetGroupBaseIndex;
                 extraOpacity = (blinkVisible || isGroupBase) ? 1 : 0;
              }

              return (
                <div
                  key={layer.id ?? idx}
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - clip}% 0 0)` }}
                >
                  {renderImage(layer.url, layer.filename ?? `Layer ${idx + 2}`, true, extraOpacity, layer.id)}
                </div>
              );
            })}

          </div>
        ) : null}

        {layers.length >= 2 && mode === "sideBySide" ? (() => {
          const left = sideBySide.leftId ? layers.find((l) => l.id === sideBySide.leftId) : layers[0];
          const right = sideBySide.rightId
            ? layers.find((l) => l.id === sideBySide.rightId)
            : layers.find((l) => l !== left) ?? layers[1];
          const pair = [left, right].filter(Boolean) as typeof layers;
          return (
          <div className={`grid h-full w-full ${layers.length >= 2 ? "grid-cols-2" : "grid-cols-1"} divide-x divide-slate-800/70`}>
            {pair.map((layer, idx) => (
              <div key={`${layer.id ?? idx}-${idx}`} className="flex items-center justify-center bg-slate-950/60">
                  {renderImage(layer.url, layer.filename ?? `Layer ${idx + 1}`, false, 1, layer.id)}
                </div>
            ))}
          </div>
          );
        })() : null}

        {layers.length >= 1 && mode === "multiSplit" ? (
          <div
            className="h-full w-full grid"
            style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
            }}
          >
            {visibleLayers.map((layer, idx) => (
              <div key={layer.id ?? idx} className="flex items-center justify-center bg-slate-950/60 overflow-hidden">
                {renderImage(layer.url, layer.filename ?? `Layer ${idx + 1}`, false, 1, layer.id)}
              </div>
            ))}
          </div>
        ) : null}

        {layers.length >= 1 && mode === "sequence" ? (
          <div className="flex h-full w-full items-center justify-center bg-slate-950/60 relative overflow-hidden">
            {(() => {
              const safeIndex = sequence.index % layers.length;
              const currentLayer = layers[safeIndex];
              const nextIndex = sequence.direction === "backward"
                    ? (safeIndex - 1 + layers.length) % layers.length
                    : (safeIndex + 1) % layers.length;
              const nextLayer = layers[nextIndex];

              const areLinked = currentLayer?.groupName && nextLayer?.groupName && currentLayer.groupName === nextLayer.groupName;
              const shouldCrossfade = sequence.crossfade && (!sequence.crossfadeOnlyLinked || areLinked);
              
              if (!shouldCrossfade) {
                  // Standard Playback
                  return currentLayer
                    ? renderImage(
                        currentLayer.url,
                        currentLayer.filename ?? `Layer ${safeIndex + 1}`,
                        false,
                        1,
                        currentLayer.id
                      )
                    : null;
              } else {
                  // Crossfade Playback
                  return (
                    <>
                        {/* Next Layer (Background) */}
                        {nextLayer && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                {renderImage(
                                    nextLayer.url,
                                    nextLayer.filename ?? `Layer ${nextIndex + 1}`,
                                    false,
                                    1, // Full opacity
                                    nextLayer.id
                                )}
                            </div>
                        )}
                        
                        {/* Current Layer (Foreground, Fading Out) */}
                        {currentLayer && (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 1 - transitionProgress }}>
                                {renderImage(
                                    currentLayer.url,
                                    currentLayer.filename ?? `Layer ${safeIndex + 1}`,
                                    false,
                                    1, // Base opacity 1, controlled by div style
                                    currentLayer.id
                                )}
                            </div>
                        )}
                    </>
                  );
              }
            })()}
          </div>
        ) : null}

        {heatmap.enabled && layers.length >= 2 && heatmapImage ? (
          <>
            {mode === "slider" ? (
              <>
                {applyOnAfter ? (
                  <div
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    style={(() => {
                        // Find Target Layer index to determine clipping
                        const targetId = heatmap.targetId;
                        // If no explicit targetId, fallback to index 1 (standard 2-layer)
                        const targetIndex = targetId 
                            ? layers.findIndex(l => l.id === targetId)
                            : 1;
                        
                        if (targetIndex > 0) {
                            // Clipped by the slider BEFORE it (index - 1)
                            const clip = sliderPositions[targetIndex - 1] ?? 50;
                            return { clipPath: `inset(0 ${100 - clip}% 0 0)` };
                        }
                        // If targetIndex is 0 (Base) or not found, show full (or maybe hide?)
                        // If Target is Layer 0, it's the background, so full width.
                        return {}; 
                    })()}
                  >
                    <img
                      src={heatmapImage}
                      alt="Heatmap"
                      className="h-full w-full object-contain"
                      style={{
                        mixBlendMode: "screen",
                        opacity: heatmap.opacity,
                        transform: baseTransform,
                        transformOrigin: "center",
                      }}
                      draggable={false}
                    />
                  </div>
                ) : null}
                {applyOnBefore ? (
                  <div
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    style={(() => {
                        const baseId = heatmap.baseId;
                        const baseIndex = baseId
                            ? layers.findIndex(l => l.id === baseId)
                            : 0;

                        if (baseIndex > 0) {
                             const clip = sliderPositions[baseIndex - 1] ?? 50;
                             return { clipPath: `inset(0 ${100 - clip}% 0 0)` };
                        }
                        // If base is Layer 0, full width.
                        return {};
                    })()}
                  >
                    <img
                      src={heatmapImage}
                      alt="Heatmap"
                      className="h-full w-full object-contain"
                      style={{
                        mixBlendMode: "screen",
                        opacity: heatmap.opacity,
                        transform: baseTransform,
                        transformOrigin: "center",
                      }}
                      draggable={false}
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {mode === "sideBySide" ? (
              <div className="pointer-events-none absolute inset-0 grid h-full w-full grid-cols-2 divide-x divide-transparent">
                <div className="relative">
                  {(() => {
                     // Check Left Cell
                     const leftId = sideBySide.leftId ?? layers[0]?.id;
                     const show = (applyOnBefore && leftId === (heatmap.baseId ?? layers[0]?.id)) ||
                                  (applyOnAfter && leftId === (heatmap.targetId ?? layers[1]?.id));
                     if (!show) return null;
                     return (
                        <img
                          src={heatmapImage}
                          alt="Heatmap"
                          className="h-full w-full object-contain"
                          style={{
                            mixBlendMode: "screen",
                            opacity: heatmap.opacity,
                            transform: baseTransform,
                            transformOrigin: "center",
                          }}
                          draggable={false}
                        />
                     );
                  })()}
                </div>
                <div className="relative">
                  {(() => {
                     // Check Right Cell
                     const rightId = sideBySide.rightId ?? layers[1]?.id;
                     const show = (applyOnBefore && rightId === (heatmap.baseId ?? layers[0]?.id)) ||
                                  (applyOnAfter && rightId === (heatmap.targetId ?? layers[1]?.id));
                     if (!show) return null;
                     return (
                        <img
                          src={heatmapImage}
                          alt="Heatmap"
                          className="h-full w-full object-contain"
                          style={{
                            mixBlendMode: "screen",
                            opacity: heatmap.opacity,
                            transform: baseTransform,
                            transformOrigin: "center",
                          }}
                          draggable={false}
                        />
                     );
                  })()}
                </div>
              </div>
            ) : null}

            {mode === "multiSplit" ? (
              <div
                className="pointer-events-none absolute inset-0 grid"
                style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                }}
              >
                {visibleLayers.map((layer, idx) => {
                  const show = (applyOnBefore && layer.id === (heatmap.baseId ?? layers[0]?.id)) ||
                               (applyOnAfter && layer.id === (heatmap.targetId ?? layers[1]?.id));
                  return (
                    <div key={idx} className="relative">
                      {show ? (
                        <img
                          src={heatmapImage}
                          alt="Heatmap"
                          className="h-full w-full object-contain"
                          style={{
                            mixBlendMode: "screen",
                            opacity: heatmap.opacity,
                            transform: baseTransform,
                            transformOrigin: "center",
                          }}
                          draggable={false}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}

        {magnifier.enabled && cursor && hasBoth && magnifierSource
          ? (() => {
              if (!containerSize.width || !containerSize.height) return null;

              const circle = (offsetX: number, offsetY: number, width: number, height: number) => (
                <div
                  className="pointer-events-none absolute"
                  style={{ left: offsetX, top: offsetY, width, height, overflow: "hidden" }}
                >
                  <div
                    className="absolute inset-0"
                    style={{ clipPath: `circle(${magnifier.radius}px at ${cursor.x - offsetX}px ${cursor.y - offsetY}px)` }}
                  >
                    <img
                      src={magnifierSource}
                      alt="Magnifier view"
                      className="h-full w-full object-contain"
                      style={{
                        filter,
                        transform: baseTransform,
                        transformOrigin: "center",
                      }}
                      draggable={false}
                    />
                  </div>
                </div>
              );

              if (mode === "slider") {
                return circle(0, 0, containerSize.width, containerSize.height);
              }

              if (mode === "sideBySide") {
                const cellW = containerSize.width / 2;
                const isLeft = cursor.x < cellW;
                const offsetX = isLeft ? 0 : cellW;
                return circle(offsetX, 0, cellW, containerSize.height);
              }

              if (mode === "multiSplit") {
                const cellW = containerSize.width / cols;
                const cellH = containerSize.height / rows;

                const colIdx = Math.min(cols - 1, Math.max(0, Math.floor(cursor.x / cellW)));
                const rowIdx = Math.min(rows - 1, Math.max(0, Math.floor(cursor.y / cellH)));
                
                const offsetX = colIdx * cellW;
                const offsetY = rowIdx * cellH;
                
                return circle(offsetX, offsetY, cellW, cellH);
              }
              return null;
            })()
          : null}

        {magnifier.enabled && cursor && hasBoth && magnifierSource ? (
          <div
            className="pointer-events-none absolute rounded-full ring-2 ring-cyan-300/80"
            style={{
              width: magnifier.radius * 2,
              height: magnifier.radius * 2,
              left: cursor.x - magnifier.radius,
              top: cursor.y - magnifier.radius,
            }}
          />
        ) : null}

        {heatmap.enabled && heatmapStatus === "processing" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
            <div className="rounded-full border-4 border-cyan-400/50 border-t-transparent p-6 animate-spin" />
          </div>
        ) : null}

        {(gridRuler.showGrid || gridRuler.showRuler) && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {gridRuler.showGrid && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(148,163,184,0.1) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(148,163,184,0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: `${gridRuler.gridSize}px ${gridRuler.gridSize}px`,
                  mixBlendMode: "screen",
                }}
              />
            )}
            
            {gridRuler.showRuler && (
              <>
                {/* Horizontal Ruler */}
                <div className="absolute top-0 left-8 right-0 h-6 bg-slate-900/80 border-b border-slate-700/50 flex select-none">
                  {Array.from({ length: Math.ceil(containerSize.width / 100) }).map((_, i) => (
                    <div key={i} className="absolute h-full flex items-end pb-1 border-l border-slate-500/50" style={{ left: i * 100 }}>
                      <span className="text-[9px] text-slate-300 ml-1 -mb-0.5">{i * 100}</span>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <div
                          key={j}
                          className={clsx(
                            "absolute bottom-0 w-px bg-slate-500/30",
                            (j + 1) === 5 ? "h-2" : "h-1"
                          )}
                          style={{ left: (j + 1) * 10 }}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                {/* Vertical Ruler */}
                <div className="absolute top-6 left-0 bottom-0 w-8 bg-slate-900/80 border-r border-slate-700/50 flex flex-col select-none">
                  {Array.from({ length: Math.ceil(containerSize.height / 100) }).map((_, i) => (
                    <div key={i} className="absolute w-full flex justify-end pr-1 border-t border-slate-500/50" style={{ top: i * 100 }}>
                      <span className="text-[9px] text-slate-300 mr-1 -mt-2 origin-bottom-right -rotate-90">{i * 100}</span>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <div
                          key={j}
                          className={clsx(
                            "absolute right-0 h-px bg-slate-500/30",
                            (j + 1) === 5 ? "w-2" : "w-1"
                          )}
                          style={{ top: (j + 1) * 10 }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                
                {/* Corner Box */}
                <div className="absolute top-0 left-0 w-8 h-6 bg-slate-800 border-r border-b border-slate-700/50 z-30 flex items-center justify-center">
                    <span className="text-[9px] text-slate-400">px</span>
                </div>
                
                {/* Dynamic Cursor Guides */}
                {cursor && (
                    <>
                        {/* H-Line */}
                        <div 
                            className="absolute left-0 w-8 border-t border-cyan-400/50 pointer-events-none" 
                            style={{ top: cursor.y }} 
                        />
                        <div 
                             className="absolute left-1 bg-cyan-900/80 text-cyan-300 text-[9px] px-1 rounded transform -translate-y-1/2"
                             style={{ top: cursor.y }}
                        >
                            {Math.round(cursor.y)}
                        </div>

                        {/* V-Line */}
                        <div 
                            className="absolute top-0 h-6 border-l border-cyan-400/50 pointer-events-none" 
                            style={{ left: cursor.x }} 
                        />
                        <div 
                             className="absolute top-1 bg-cyan-900/80 text-cyan-300 text-[9px] px-1 rounded transform -translate-x-1/2"
                             style={{ left: cursor.x }}
                        >
                            {Math.round(cursor.x)}
                        </div>
                    </>
                )}
              </>
            )}
          </div>
        )}

        {/* 移除舊的背景預覽圓，避免多重 after 圖。若需要視覺框線可在 magnifier 區段加上 ring。 */}
      </div>
    </div>
  );
};

