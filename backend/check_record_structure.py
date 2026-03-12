#!/usr/bin/env python
"""
Ver la estructura exacta de los registros
"""
import os
from dotenv import load_dotenv
from sshtunnel import SSHTunnelForwarder
from pymongo import MongoClient
import json

load_dotenv()

SSH_HOST = os.getenv('SSH_HOST')
SSH_USER = os.getenv('SSH_USER')
SSH_KEY_PATH = os.getenv('SSH_KEY_PATH')
SSH_PASSPHRASE = os.getenv('SSH_PASSPHRASE')
MONGO_PORT = int(os.getenv('MONGO_PORT', 27017))
DB_NAME = os.getenv('DB_NAME')

TARGET_PID = "5f231f11682b965f9889826c"

print("\n" + "=" * 80)
print(f"ESTRUCTURA DE REGISTROS - Proyecto: 'Transmilenio Av 68'")
print("=" * 80)

try:
    with SSHTunnelForwarder(
        (SSH_HOST, 22),
        ssh_username=SSH_USER,
        ssh_pkey=SSH_KEY_PATH,
        ssh_private_key_password=SSH_PASSPHRASE.encode(),
        remote_bind_address=('127.0.0.1', MONGO_PORT),
        set_keepalive=30.0
    ) as server:
        client = MongoClient('127.0.0.1', server.local_bind_port)
        db = client[DB_NAME]
        
        # Ver 3 registros de ejemplo
        print(f"\n🔍 Primeros 3 registros:")
        samples = list(db.records.find({"pid": TARGET_PID}).limit(3))
        
        for i, sample in enumerate(samples, 1):
            print(f"\n--- Registro {i} ---")
            # Mostrar todos los campos excepto _id que es muy largo
            for key, value in sample.items():
                if key != '_id':
                    if isinstance(value, list) and len(str(value)) > 50:
                        print(f"  {key}: [{len(value)} items]")
                    elif isinstance(value, dict) and len(str(value)) > 50:
                        num_keys = len(value)
                        print(f"  {key}: {num_keys} keys")
                    else:
                        print(f"  {key}: {value}")

        
        # Contar registros con campo 'cte'
        count_with_cte = db.records.count_documents({
            "pid": TARGET_PID,
            "cte": {"$exists": True, "$ne": None}
        })
        
        count_with_date = db.records.count_documents({
            "pid": TARGET_PID,
            "cte": {"$type": "date"}
        })
        
        print(f"\n📊 Análisis del campo 'cte':")
        print(f"   Registros totales: 21481")
        print(f"   Con campo 'cte' (no nulo): {count_with_cte}")
        print(f"   Con 'cte' tipo date: {count_with_date}")
        
        # Listar todos los campos del documento
        print(f"\n📝 Lista de campos disponibles:")
        all_fields = set()
        for doc in db.records.find({"pid": TARGET_PID}).limit(10):
            all_fields.update(doc.keys())
        
        for field in sorted(all_fields):
            print(f"   - {field}")
        
        client.close()
        print("\n✅ Diagnóstico completado\n")

except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
