from database import SessionLocal
from models import Layer
import logging

# Configurar logging básico
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def cancel_all_processes():
    db = SessionLocal()
    try:
        logger.info("Buscardo procesos activos para cancelar...")
        
        # Buscar capas en estado de procesamiento
        active_statuses = ['processing', 'pending', 'paused', 'processing_overviews']
        affected_rows = db.query(Layer).filter(
            Layer.processing_status.in_(active_statuses)
        ).update({Layer.processing_status: 'cancelled'}, synchronize_session=False)
        
        db.commit()
        logger.info(f"✅ Se han cancelado {affected_rows} procesos activos en la base de datos.")
        
    except Exception as e:
        logger.error(f"❌ Error al limpiar procesos: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cancel_all_processes()
