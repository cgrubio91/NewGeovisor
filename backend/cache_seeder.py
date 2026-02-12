"""
Cache seeder — pre-warms tile cache for uploaded rasters.

Uses the new tile_renderer (VRT-based) instead of the old
open-reproject-per-tile approach. This is ~10-50x faster.
"""

import os
import logging
import rasterio
from rasterio.warp import transform_bounds
import mercantile

from database import SessionLocal
from shared import tile_cache, UPLOAD_DIR
from convert_cogs import update_layer_progress, check_layer_status
from tile_renderer import tile_renderer

logger = logging.getLogger(__name__)


def seed_cache_for_layer(file_path, layer_id):
    """
    Pre-seeds the tile cache for a given raster layer.
    
    Strategy:
    - Zoom 12–18: Seed ALL tiles (relatively few tiles, fast)
    - Zoom 19–20: Seed ALL tiles (moderate count, still viable)
    - Zoom 21+: Skip pre-seeding, rely on on-demand generation + cache
    
    This way, the user gets instant response up to zoom 20,
    and zoom 21-22 tiles are generated on-demand (fast with VRT + COG overviews)
    and cached after first view.
    """
    db = SessionLocal()
    try:
        filename = os.path.basename(file_path)
        logger.info(f"Starting cache seeding for {filename}...")
        
        with rasterio.open(file_path) as src:
            bounds = src.bounds
            crs = src.crs
            
            # Reproject bounds to WGS84 for mercantile
            wgs84_bounds = transform_bounds(crs, 'EPSG:4326', *bounds)
        
        # Determine zoom levels based on image resolution
        # For a 9cm GSD ortho, native resolution ≈ zoom 20-21
        # Pre-seed up to zoom 20 (reasonable tile count)
        min_zoom = 12
        max_zoom = 20
        
        # Count total tiles for progress tracking
        tiles_to_process = []
        for z in range(min_zoom, max_zoom + 1):
            tiles = list(mercantile.tiles(*wgs84_bounds, z))
            tiles_to_process.extend([(z, t.x, t.y) for t in tiles])
        
        total_count = len(tiles_to_process)
        logger.info(f"Seeding {total_count} tiles for {filename} (zoom {min_zoom}-{max_zoom})")
        
        update_layer_progress(db, layer_id, "processing", 0)
        
        processed = 0
        skipped = 0
        
        for z, x, y in tiles_to_process:
            cache_key = f"{filename}-{z}-{x}-{y}"
            
            # Skip if already cached
            if tile_cache.get(cache_key):
                skipped += 1
                processed += 1
                continue
            
            # Generate tile using the fast VRT renderer
            try:
                content = tile_renderer.render_tile(file_path, z, x, y)
                if content:
                    tile_cache.set(cache_key, content, expire=86400 * 30)  # 30 days
            except Exception as e:
                logger.warning(f"Seed error {z}/{x}/{y}: {e}")
            
            processed += 1
            
            # Update progress every 20 tiles
            if processed % 20 == 0:
                pct = int((processed / total_count) * 100)
                update_layer_progress(db, layer_id, "processing", pct)
                
                # Check status
                status = check_layer_status(db, layer_id)
                import time
                while status == "paused":
                    time.sleep(2)
                    status = check_layer_status(db, layer_id)
                
                if status == "cancelled":
                    logger.info(f"Seeding cancelled for layer {layer_id}")
                    return

        update_layer_progress(db, layer_id, "completed", 100)
        logger.info(
            f"Cache seeding completed for {filename}: "
            f"{processed} processed, {skipped} already cached"
        )

    except Exception as e:
        logger.error(f"Error seeding cache: {e}")
        # Don't fail the layer if seeding fails
        update_layer_progress(db, layer_id, "completed", 100)
    finally:
        db.close()
