#!/usr/bin/env python
"""
Encontrar qué proyecto corresponde al ID que tiene 789 registros
"""
import os
from dotenv import load_dotenv
from sshtunnel import SSHTunnelForwarder
from pymongo import MongoClient
from bson.objectid import ObjectId

load_dotenv()

SSH_HOST = os.getenv('SSH_HOST')
SSH_USER = os.getenv('SSH_USER')
SSH_KEY_PATH = os.getenv('SSH_KEY_PATH')
SSH_PASSPHRASE = os.getenv('SSH_PASSPHRASE')
MONGO_PORT = int(os.getenv('MONGO_PORT', 27017))
DB_NAME = os.getenv('DB_NAME')

# ID del proyecto que tiene 789 registros
TARGET_PID = "5f231f11682b965f9889826c"

print("\n" + "=" * 80)
print(f"BÚSQUEDA: ¿Qué proyecto tiene PID '{TARGET_PID}'?")
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
        
        # Intentar como string ObjectId
        try:
            oid = ObjectId(TARGET_PID)
            project = db.projects.find_one({"_id": oid})
            if project:
                print(f"\n✅ Proyecto encontrado (como ObjectId):")
                print(f"   Nombre: {project.get('name')}")
                print(f"   _id: {project['_id']}")
                print(f"   Descripción: {project.get('description', 'N/A')[:100]}")
                
                # Contar registros con este PID
                count1 = db.records.count_documents({"pid": TARGET_PID})
                print(f"\n   📊 Registros en esta colección con este PID (como string): {count1}")
                
                count2 = db.records.count_documents({"pid": str(oid)})
                print(f"   📊 Registros con pid como string de ObjectId: {count2}")
        except:
            print(f"   ✗ No es un ObjectId válido o no encontrado")
        
        # Buscar en registros para ver si ese PID existe
        print(f"\n🔍 Verificando PID directamente en registros:")
        sample = db.records.find_one({"pid": TARGET_PID})
        if sample:
            print(f"   ✅ Existe registro con PID={TARGET_PID}")
            print(f"   Fecha: {sample.get('cte')}")
            print(f"   Usuario: {sample.get('user')}")
        else:
            print(f"   ❌ No hay registros con PID={TARGET_PID}")
        
        # Ver todos los registros con fecha 2026-01-01 a 2026-03-31
        from datetime import datetime
        fecha_inicio = datetime(2026, 1, 1)
        fecha_fin = datetime(2026, 3, 31, 23, 59, 59)
        
        count_all = db.records.count_documents({
            "cte": {
                "$gte": fecha_inicio,
                "$lte": fecha_fin
            }
        })
        print(f"\n📅 Total de registros en fecha 2026-01-01 a 2026-03-31: {count_all}")
        
        # Con el PID específico
        count_specific = db.records.count_documents({
            "pid": TARGET_PID,
            "cte": {
                "$gte": fecha_inicio,
                "$lte": fecha_fin
            }
        })
        print(f"    Con PID={TARGET_PID}: {count_specific}")
        
        client.close()
        print("\n✅ Diagnóstico completado\n")

except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
