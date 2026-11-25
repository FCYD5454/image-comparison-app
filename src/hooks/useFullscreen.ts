import { useState, useCallback, useEffect } from 'react';

/**
 * Fullscreen API Hook
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenElement, setFullscreenElement] = useState<HTMLElement | null>(null);
  
  // 監聽全螢幕變化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  /**
   * 進入全螢幕
   */
  const enterFullscreen = useCallback(async (element: HTMLElement) => {
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
        setFullscreenElement(element);
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
    }
  }, []);
  
  /**
   * 退出全螢幕
   */
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreenElement(null);
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  }, []);
  
  /**
   * 切換全螢幕
   */
  const toggleFullscreen = useCallback(async (element: HTMLElement) => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen(element);
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);
  
  return {
    isFullscreen,
    fullscreenElement,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen
  };
}
