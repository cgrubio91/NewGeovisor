import os
import shutil
import rasterio
from rasterio.enums import Resampling
import numpy as np
from database import SessionLocal
import models
import logging

from shared import UPLOAD_DIR, BACKUP_DIR

logger = logging.getLogger(__name__)

def update_layer_progress(db, layer_id, status, progress):
    """Update layer status and progress in database"""
    if not layer_id:
        return
        
    try:
        layer = db.query(models.Layer).filter(models.Layer.id == layer_id).first()
        if layer:
            if status:
                layer.processing_status = status
            if progress is not None:
                layer.processing_progress = progress
            db.commit()
    except Exception as e:
        logger.error(f"Error updating layer progress: {e}")
        db.rollback()

def convert_to_cog(filepath, layer_id=None):
    """
    Convierte un archivo TIFF a un formato optimizado (COG-like):
    - Tiled (256x256)
    - Compressed (Deflate/LZW)
    - Overviews (Piramides internas)
    
    Arguments:
        filepath: ruta del archivo
        layer_id: ID opcional de la capa para actualizar progreso en BD
    """
    db = SessionLocal() if layer_id else None
    
    try:
        if layer_id:
            update_layer_progress(db, layer_id, "processing", 0)

        with rasterio.open(filepath) as src:
            # Check if already optimized (rough check)
            is_tiled = src.profile.get('tiled', False)
            has_overviews = len(src.overviews(1)) > 0
            if is_tiled and has_overviews:
                print(f"✅ {filepath} ya parece optimizado. Saltando.")
                if layer_id:
                    update_layer_progress(db, layer_id, "completed", 100)
                return False

            print(f"🔄 Optimizando {filepath}...")
            if layer_id:
                update_layer_progress(db, layer_id, "processing", 10)
            
            # Define profile for COG
            profile = src.profile.copy()
            profile.update({
                'driver': 'GTiff',
                'tiled': True,
                'blockxsize': 256,
                'blockysize': 256,
                'compress': 'deflate',
                'predictor': 2,
                'bigtiff': 'IF_NEEDED'
            })
            
            # Create a temporary file
            temp_path = filepath + ".tmp"
            
            with rasterio.open(temp_path, 'w', **profile) as dst:
                # Copy data with windows for memory efficiency and progress tracking
                # Get list of all windows (blocks)
                windows = [window for ij, window in dst.block_windows()]
                total_windows = len(windows)
                
                print(f"Processing {total_windows} blocks...")
                
                for i, (ij, window) in enumerate(dst.block_windows()):
                    # Read using window from source
                    # Note: src might not be tiled the same way, but windowed reading works if driver supports it
                    # If src is stripped, window read might be slower but safer for RAM
                    try:
                        data = src.read(window=window)
                        dst.write(data, window=window)
                    except Exception as e:
                        # Fallback for some drivers/shapes? 
                        # If window read fails, we might just have to do band-by-band for that chunk
                        # But standard rasterio should handle it.
                        print(f"Warning reading window {window}: {e}")
                    
                    # Update progress every 5%
                    is_p_step = total_windows > 20 and i % (total_windows // 20) == 0
                    if layer_id and is_p_step:
                        # Map 10-80% to copying phase
                        current_pct = 10 + int((i / total_windows) * 70)
                        update_layer_progress(db, layer_id, "processing", current_pct)
                
                if layer_id:
                    update_layer_progress(db, layer_id, "processing_overviews", 80)
                
                # Copy tags/metadata
                dst.update_tags(**src.tags())
                
                # Build overviews (powers of 2)
                print("Building overviews...")
                factors = [2, 4, 8, 16, 32, 64]
                dst.build_overviews(factors, Resampling.average)
                dst.update_tags(ns='rio_overview', resampling='average')

        # Replace original with optimized version
        # First backup
        if not os.path.exists(BACKUP_DIR):
            os.makedirs(BACKUP_DIR)
        
        backup_path = os.path.join(BACKUP_DIR, os.path.basename(filepath))
        shutil.copy2(filepath, backup_path)
        
        # CRITICAL FIX FOR WINDOWS: 
        # Invalidate cache in tile_renderer to close the file handle BEFORE moving/overwriting
        try:
            from tile_renderer import tile_renderer
            tile_renderer.invalidate(filepath)
            logger.info(f"Released file handle for {filepath} before overwriting")
        except Exception as e:
            logger.warning(f"Could not invalidate tile renderer cache: {e}")

        # Move temp to original
        try:
            if os.path.exists(filepath):
                os.remove(filepath) # Explicit remove first on Windows
            shutil.move(temp_path, filepath)
        except OSError as e:
            # Fallback for windows file lock issues
            logger.warning(f"Standard move failed ({e}), trying copy+delete with retry...")
            import time
            time.sleep(1)
            try:
                # Retry invalidation
                from tile_renderer import tile_renderer
                tile_renderer.invalidate(filepath)
                if os.path.exists(filepath):
                    os.remove(filepath)
                shutil.move(temp_path, filepath)
            except Exception as e2:
                logger.error(f"Failed to replace original file: {e2}")
                # If we can't move, keeps temp? No, try to restore or leave temp
                return False
            
        print(f"✨ Optimizado: {filepath}")
        
        if layer_id:
            update_layer_progress(db, layer_id, "completed", 100)
            
        return True

    except Exception as e:
        print(f"❌ Error optimizando {filepath}: {e}")
        if layer_id:
             update_layer_progress(db, layer_id, "failed", 0)
             
        if os.path.exists(filepath + ".tmp"):
            try:
                os.remove(filepath + ".tmp")
            except:
                pass
        return False
    finally:
        if db:
            db.close()

if __name__ == "__main__":
    # Test run
    pass
