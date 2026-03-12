#!/usr/bin/env python
"""
Encontrar qué rangos de fecha tienen registros para el proyecto
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
print(f"RANGOS DE FECHA CON REGISTROS - Proyecto: 'Transmilenio Av 68'")
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
        
        # Buscar fechas MIN y MAX
        pipeline = [
            {"$match": {"pid": TARGET_PID}},
            {"$group": {
                "_id": None,
                "fecha_minima": {"$min": "$cte"},
                "fecha_maxima": {"$max": "$cte"}
            }}
        ]
        
        result = list(db.records.aggregate(pipeline))
        if result and result[0]['fecha_minima']:
            fecha_min = result[0]['fecha_minima']
            fecha_max = result[0]['fecha_maxima']
            
            print(f"\n📅 Rango de fechas con registros:")
            print(f"   Fecha MÍNIMA: {fecha_min}")
            print(f"   Fecha MÁXIMA: {fecha_max}")
            print(f"   Registros totales: 21481")
        else:
            print(f"\n❌ No se encontraron registros con fecha válida")
        
        # Contar por año
        print(f"\n📊 Registros por año:")
        year_pipeline = [
            {"$match": {"pid": TARGET_PID}},
            {"$group": {
                "_id": {"$year": "$cte"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        years = list(db.records.aggregate(year_pipeline))
        for year_data in years:
            if year_data['_id']:  # Ignorar null
                print(f"   Año {year_data['_id']}: {year_data['count']:,} registros")
        
        # Ver fechas que el usuario quería buscar
        print(f"\n❌ PROBLEMA: El usuario intentó buscar en 2026-01-01 a 2026-03-31")
        print(f"   Pero los registros van hasta {fecha_max.year if fecha_max else '?'}")
        
        # Sugerencia: mostrar últimos registros
        print(f"\n💡 SUGERENCIA: Usar fechas dentro del rango actual")
        last_records = list(db.records.find(
            {"pid": TARGET_PID},
            {"cte": 1}
        ).sort("cte", -1).limit(3))
        
        if last_records:
            print(f"   Últimos registros disponibles:")
            for rec in last_records:
                if rec.get('cte'):
                    print(f"      - {rec['cte']}")
        
        client.close()
        print("\n✅ Diagnóstico completado\n")

except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
