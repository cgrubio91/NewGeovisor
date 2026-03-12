#!/usr/bin/env python
"""
Probar que la búsqueda funciona con el campo 'cre' correcto
"""
import os
from dotenv import load_dotenv
from sshtunnel import SSHTunnelForwarder
from pymongo import MongoClient
from datetime import datetime

load_dotenv()

SSH_HOST = os.getenv('SSH_HOST')
SSH_USER = os.getenv('SSH_USER')
SSH_KEY_PATH = os.getenv('SSH_KEY_PATH')
SSH_PASSPHRASE = os.getenv('SSH_PASSPHRASE')
MONGO_PORT = int(os.getenv('MONGO_PORT', 27017))
DB_NAME = os.getenv('DB_NAME')

TARGET_PID = "5f231f11682b965f9889826c"

print("\n" + "=" * 80)
print(f"TEST: Consulta con campo 'cre' (CORREGIDO)")
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
        
        print(f"\n✅ Proyecto: 'Transmilenio Av 68'")
        print(f"   MongoDB PID: {TARGET_PID}")
        
        # Test 1: Rango que SÍ tiene datos (2020)
        print(f"\n📅 TEST 1: Rango 2020-08-01 a 2020-09-30 (Debe tener datos)")
        fecha_inicio = datetime(2020, 8, 1)
        fecha_fin = datetime(2020, 9, 30, 23, 59, 59)
        
        count_2020 = db.records.count_documents({
            "pid": TARGET_PID,
            "cre": {
                "$gte": fecha_inicio,
                "$lte": fecha_fin
            }
        })
        print(f"   Registros encontrados: {count_2020}")
        
        # Test 2: Rango que NO tiene datos (2026)
        print(f"\n❌ TEST 2: Rango 2026-01-01 a 2026-03-31 (NO tiene datos)")
        fecha_inicio = datetime(2026, 1, 1)
        fecha_fin = datetime(2026, 3, 31, 23, 59, 59)
        
        count_2026 = db.records.count_documents({
            "pid": TARGET_PID,
            "cre": {
                "$gte": fecha_inicio,
                "$lte": fecha_fin
            }
        })
        print(f"   Registros encontrados: {count_2026}")
        
        # Verificar rango de datos disponibles
        print(f"\n📊 INFO: Rango de fechas disponibles en 'Transmilenio Av 68':")
        pipeline = [
            {"$match": {"pid": TARGET_PID}},
            {"$group": {
                "_id": None,
                "fecha_min": {"$min": "$cre"},
                "fecha_max": {"$max": "$cre"}
            }}
        ]
        result = list(db.records.aggregate(pipeline))
        if result and result[0]['fecha_min']:
            print(f"   Desde: {result[0]['fecha_min']}")
            print(f"   Hasta: {result[0]['fecha_max']}")
        
        client.close()
        print("\n✅ Test completado\n")

except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
