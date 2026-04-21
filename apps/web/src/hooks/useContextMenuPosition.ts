import { useMemo, CSSProperties } from 'react';

/**
 * Hook to calculate context menu position based on viewport quadrants.
 * 
 * Logic:
 * - If click is in right half -> open left (using 'right' property)
 * - If click is in left half -> open right (using 'left' property)
 * - If click is in bottom half -> open up (using 'bottom' property)
 * - If click is in top half -> open down (using 'top' property)
 */
export const useContextMenuPosition = (x: number, y: number, padding: number = 10) => {
  return useMemo((): CSSProperties => {
    const vThreshold = window.innerHeight / 2;
    const hThreshold = window.innerWidth / 2;
    
    const styles: CSSProperties = {
      position: 'fixed' as const,
      zIndex: 1000,
      // Initialize with auto to prevent stale properties
      left: 'auto',
      right: 'auto',
      top: 'auto',
      bottom: 'auto'
    };

    // Horizontal calculation
    if (x > hThreshold) {
      styles.right = Math.max(padding, window.innerWidth - x);
    } else {
      styles.left = Math.max(padding, x);
    }

    // Vertical calculation
    if (y > vThreshold) {
      styles.bottom = Math.max(padding, window.innerHeight - y);
    } else {
      styles.top = Math.max(padding, y);
    }

    return styles;
  }, [x, y, padding]);
};
