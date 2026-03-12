#!/usr/bin/env python
"""
Script de diagnóstico para verificar discrepancias entre consultas MongoDB
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

print("=" * 70)
print("DIAGNÓSTICO DE CONSULTAS MONGODB")
print("=" * 70)

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
        
        print(f"\n✅ Conectado a {DB_NAME} vía SSH túnel")
        
        # 1. Contar total de registros
        total = db.records.count_documents({})
        print(f"\n📊 Total de documentos en 'records': {total}")
        
        # 2. Contar registros en rango de fechas
        fecha_inicio = datetime(2026, 1, 1)
        fecha_fin = datetime(2026, 3, 31, 23, 59, 59)
        
        count_by_date = db.records.count_documents({
            "cte": {
                "$gte": fecha_inicio,
                "$lte": fecha_fin
            }
        })
        print(f"\n📅 Registros entre 2026-01-01 y 2026-03-31: {count_by_date}")
        
        # 3. Ver campos únicos en un registro de ejemplo
        sample = db.records.find_one({"cte": {"$gte": fecha_inicio, "$lte": fecha_fin}})
        if sample:
            print(f"\n🔍 Ejemplo de documento:")
            print(f"   Campos: {list(sample.keys())}")
            print(f"   pid: {sample.get('pid')}")
            print(f"   cte: {sample.get('cte')}")
            print(f"   codigo: {sample.get('codigo')}")
        
        # 4. Ver PIDs únicos en la colección de registros
        print(f"\n📌 Verificando PIDs en registros:")
        pids_in_records = db.records.distinct("pid")
        print(f"   Total de PIDs únicos: {len(pids_in_records)}")
        print(f"   Primeros 5 PIDs: {pids_in_records[:5] if pids_in_records else 'Ninguno'}")
        
        # 5. Ver proyectos disponibles
        print(f"\n🏗️  Proyectos en base de datos:")
        projects = db.projects.find({}, {"_id": 1, "name": 1}).limit(5)
        for proj in projects:
            print(f"   ID: {proj['_id']} → Nombre: {proj.get('name', 'N/A')}")
        
        # 6. Buscar específicamente por "Transmismetro Av 68"
        print(f"\n🔎 Buscando 'Transmismetro Av 68':")
        project = db.projects.find_one({"name": {"$regex": "Transmismetro", "$options": "i"}})
        if project:
            project_id = str(project['_id'])
            print(f"   Proyecto encontrado: {project.get('name')}")
            print(f"   ID: {project_id}")
            
            # Contar registros con ese project_id
            count_for_project = db.records.count_documents({
                "pid": project_id,
                "cte": {
                    "$gte": fecha_inicio,
                    "$lte": fecha_fin
                }
            })
            print(f"   Registros con este proyecto en fecha rango: {count_for_project}")
        else:
            print(f"   ❌ Proyecto no encontrado")
        
        # 7. Probar la consulta exacta del backend
        print(f"\n🧪 Probando consulta del backend:")
        if project:
            match_filter = {
                "cte": {
                    "$gte": fecha_inicio,
                    "$lte": fecha_fin
                },
                "pid": project_id
            }
            
            pipeline = [
                {"$match": match_filter},
                {"$addFields": {"pid_oid": {"$toObjectId": "$pid"}}},
                {
                    "$lookup": {
                        "from": "projects",
                        "localField": "pid_oid",
                        "foreignField": "_id",
                        "as": "info_proy"
                    }
                },
                {"$unwind": "$info_proy"},
                {"$count": "total"}
            ]
            
            result = list(db.records.aggregate(pipeline))
            if result:
                print(f"   Registros encontrados con pipeline: {result[0]['total']}")
            else:
                print(f"   Registros encontrados con pipeline: 0")
                print(f"   ⚠️  Verificando si el $toObjectId es el problema...")
                
                # Intentar sin converter a ObjectId
                match_filter2 = {
                    "cte": {
                        "$gte": fecha_inicio,
                        "$lte": fecha_fin
                    },
                    "pid": project_id
                }
                count2 = db.records.count_documents(match_filter2)
                print(f"   Registros sin convertir pid a ObjectId: {count2}")
        
        client.close()
        print("\n✅ Diagnóstico completado\n")

except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
