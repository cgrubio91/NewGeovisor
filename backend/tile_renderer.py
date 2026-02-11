"""
High-performance tile renderer using WarpedVRT + COG overviews.

Key optimizations:
1. Uses WarpedVRT to let GDAL read from internal overviews automatically
2. Keeps file handles open via LRU cache (avoids re-open per tile)
3. Reads only the needed window, not the full raster
4. Uses WEBP output (much smaller than PNG, ~70% savings)
5. Global min/max normalization (computed once per file, cached)
6. Transparent tile returned instantly for out-of-bounds requests
"""

import os
import io
import logging
import hashlib
import numpy as np
from functools import lru_cache
from threading import Lock

import rasterio
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import transform_bounds
from PIL import Image

logger = logging.getLogger(__name__)

# --- Constants ---
TILE_SIZE = 256
EPSG_3857 = "EPSG:3857"
EPSG_4326 = "EPSG:4326"
EARTH_HALF_CIRC = 20037508.342789244  # a = semi-major axis × π

# Pre-generate a transparent PNG tile (used for empty/out-of-bounds tiles)
_EMPTY_IMG = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))
_EMPTY_BUF = io.BytesIO()
_EMPTY_IMG.save(_EMPTY_BUF, format="WEBP", quality=80, lossless=False)
EMPTY_TILE_BYTES = _EMPTY_BUF.getvalue()

# Also keep a PNG version for compatibility
_EMPTY_BUF_PNG = io.BytesIO()
_EMPTY_IMG.save(_EMPTY_BUF_PNG, format="PNG")
EMPTY_TILE_PNG = _EMPTY_BUF_PNG.getvalue()


class VRTHandle:
    """Wraps a rasterio dataset opened through WarpedVRT for efficient tile reads."""
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.lock = Lock()
        self._src = None
        self._vrt = None
        self._bounds_3857 = None
        self._band_count = 0
        self._stats = None  # (global_min, global_max) per band or overall
        self._open()
    
    def _open(self):
        """Open the file with WarpedVRT pre-warped to EPSG:3857."""
        import time
        last_error = None
        for attempt in range(3):
            try:
                self._src = rasterio.open(self.file_path)
                self._vrt = WarpedVRT(
                    self._src,
                    crs=EPSG_3857,
                    resampling=Resampling.bilinear,
                    warp_mem_limit=256,
                )
                self._bounds_3857 = self._vrt.bounds
                self._band_count = self._vrt.count
                
                self._compute_stats()
                
                logger.info(
                    f"VRTHandle opened: {os.path.basename(self.file_path)}, "
                    f"bands={self._band_count}, dtype={self._vrt.dtypes[0]}, "
                    f"attempt={attempt+1}"
                )
                return
            except Exception as e:
                last_error = e
                logger.warning(f"Attempt {attempt+1} failed to open VRT for {self.file_path}: {e}")
                self.close()
                time.sleep(0.1 * (attempt + 1))
        
        logger.error(f"Failed to open VRT for {self.file_path} after 3 attempts: {last_error}")
        raise last_error

    def _compute_stats(self):
        """
        Compute global min/max for normalization using the lowest-res overview.
        This is fast because it reads from the smallest overview layer.
        """
        try:
            if self._vrt.dtypes[0] == 'uint8':
                # Already uint8, no normalization needed
                self._stats = None
                return
            
            # Read from the lowest resolution overview for speed
            # Use a very small output shape (like 256x256) to force overview usage
            overview_data = self._vrt.read(
                out_shape=(self._band_count, 256, 256),
                resampling=Resampling.average
            )
            # Exclude nodata/zeros for better range
            mask = overview_data != 0
            if mask.any():
                self._stats = (
                    float(np.nanmin(overview_data[mask])),
                    float(np.nanmax(overview_data[mask]))
                )
            else:
                self._stats = (0.0, 255.0)
                
            logger.info(
                f"Stats for {os.path.basename(self.file_path)}: "
                f"min={self._stats[0]:.2f}, max={self._stats[1]:.2f}"
            )
        except Exception as e:
            logger.warning(f"Could not compute stats: {e}, defaulting")
            self._stats = (0.0, 255.0)
    
    def close(self):
        """Close datasets safely with locking."""
        with self.lock:
            if self._vrt:
                try:
                    self._vrt.close()
                except:
                    pass
                self._vrt = None
            if self._src:
                try:
                    self._src.close()
                except:
                    pass
                self._src = None
    
    @property
    def bounds(self):
        return self._bounds_3857
    
    @property
    def band_count(self):
        return self._band_count
    
    @property
    def needs_normalization(self):
        return self._stats is not None
    
    @property
    def stats(self):
        return self._stats
    
    def read_tile(self, z: int, x: int, y: int) -> bytes | None:
        """
        Read a single tile. Returns WEBP bytes or None if tile is empty/OOB.
        """
        import time
        # 1. Tile bounds in EPSG:3857
        tile_size_m = EARTH_HALF_CIRC * 2 / (2 ** z)
        tile_left = -EARTH_HALF_CIRC + x * tile_size_m
        tile_top = EARTH_HALF_CIRC - y * tile_size_m
        tile_right = tile_left + tile_size_m
        tile_bottom = tile_top - tile_size_m
        
        # 2. Quick bounds check
        rb = self._bounds_3857
        if (tile_right <= rb.left or tile_left >= rb.right or
            tile_top <= rb.bottom or tile_bottom >= rb.top):
            return None  # Out of bounds
        
        # Retry loop for reading
        for attempt in range(3):
            try:
                with self.lock:
                    # Windows file lock check - ensure src is open
                    if self._src.closed or self._vrt.closed:
                        self._open()

                    window = rasterio.windows.from_bounds(
                        tile_left, tile_bottom, tile_right, tile_top,
                        transform=self._vrt.transform
                    )
                    
                    data = self._vrt.read(
                        window=window,
                        out_shape=(self._band_count, TILE_SIZE, TILE_SIZE),
                        resampling=Resampling.bilinear
                    )
                    
                    mask = self._vrt.read_masks(
                        1,
                        window=window,
                        out_shape=(1, TILE_SIZE, TILE_SIZE),
                        resampling=Resampling.nearest
                    )
                    if mask.ndim == 3:
                        mask = mask[0]
                
                break  # Success
            except Exception as e:
                # If it's a file lock error, wait and retry
                if attempt < 2:
                    time.sleep(0.05 * (attempt + 1))
                    continue
                logger.error(f"Error reading tile {z}/{x}/{y} from {os.path.basename(self.file_path)}: {e}")
                return None

        # 4. Check if tile is completely empty
        if not mask.any():
            return None
        
        try:
            data = np.nan_to_num(data)
            
            # 5. Normalize to uint8 if needed
            if self.needs_normalization:
                g_min, g_max = self._stats
                if g_max > g_min:
                    data = np.clip(data, g_min, g_max)
                    data = ((data - g_min) / (g_max - g_min) * 255).astype(np.uint8)
                else:
                    data = np.zeros_like(data, dtype=np.uint8)
            else:
                data = data.astype(np.uint8)
            
            # 6. Create image
            if self._band_count >= 3:
                img_data = np.transpose(data[:3], (1, 2, 0))
                img = Image.fromarray(img_data, mode='RGB')
            else:
                img = Image.fromarray(data[0], mode='L').convert('RGB')
            
            # Apply alpha mask
            img.putalpha(Image.fromarray(mask, mode='L'))
            
            # 7. Encode to WEBP
            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=82, method=4)
            return buf.getvalue()
            
        except Exception as e:
            logger.error(f"Error encoding/processing tile {z}/{x}/{y}: {e}")
            return None


class TileRenderer:
    """
    Manages VRT handles with an LRU-like mechanism.
    Keeps file handles open to avoid repeated open/close overhead.
    """
    
    def __init__(self, max_handles: int = 20):
        self._handles: dict[str, VRTHandle] = {}
        self._lock = Lock()
        self._max_handles = max_handles
    
    def _get_handle(self, file_path: str) -> VRTHandle:
        """Get or create a VRT handle for a file."""
        abs_path = os.path.abspath(file_path)
        
        with self._lock:
            if abs_path in self._handles:
                return self._handles[abs_path]
            
            # Evict oldest if at capacity
            if len(self._handles) >= self._max_handles:
                oldest_key = next(iter(self._handles))
                self._handles[oldest_key].close()
                del self._handles[oldest_key]
            
            handle = VRTHandle(abs_path)
            self._handles[abs_path] = handle
            return handle
    
    def render_tile(self, file_path: str, z: int, x: int, y: int) -> bytes | None:
        """
        Render a tile from a raster file.
        Returns WEBP bytes or None if tile is empty.
        """
        handle = self._get_handle(file_path)
        return handle.read_tile(z, x, y)
    
    def invalidate(self, file_path: str):
        """Close and remove a cached handle (e.g., after file update)."""
        abs_path = os.path.abspath(file_path)
        with self._lock:
            if abs_path in self._handles:
                self._handles[abs_path].close()
                del self._handles[abs_path]
    
    def close_all(self):
        """Close all handles."""
        with self._lock:
            for h in self._handles.values():
                h.close()
            self._handles.clear()


# Singleton instance
tile_renderer = TileRenderer()
