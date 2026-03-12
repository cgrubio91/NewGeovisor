#!/usr/bin/env python
"""
Diagnóstico avanzado - Verificar todos los proyectos y registros
"""
import os
from dotenv import load_dotenv
from sshtunnel import SSHTunnelForwarder
from pymongo import MongoClient

load_dotenv()

SSH_HOST = os.getenv('SSH_HOST')
SSH_USER = os.getenv('SSH_USER')
SSH_KEY_PATH = os.getenv('SSH_KEY_PATH')
SSH_PASSPHRASE = os.getenv('SSH_PASSPHRASE')
MONGO_PORT = int(os.getenv('MONGO_PORT', 27017))
DB_NAME = os.getenv('DB_NAME')

print("\n" + "=" * 80)
print("DIAGNÓSTICO AVANZADO - PROYECTOS Y REGISTROS")
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
        
        # 1. Todos los proyectos
        print("\n📋 TODOS LOS PROYECTOS EN MONGODB:")
        print("-" * 80)
        all_projects = list(db.projects.find({}, {"_id": 1, "name": 1, "description": 1}).sort("name", 1))
        for i, proj in enumerate(all_projects, 1):
            proj_id = str(proj['_id'])
            proj_name = proj.get('name', 'N/A')
            print(f"{i:3}. {proj_name:<50} | ID: {proj_id}")
        
        # 2. PIDs únicos en registros y sus cuentas
        print("\n\n📊 PIDS EN REGISTROS Y SUS CUENTAS:")
        print("-" * 80)
        pipeline = [
            {"$group": {
                "_id": "$pid",
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 50}
        ]
        
        pid_counts = list(db.records.aggregate(pipeline))
        
        print(f"{'PID (ObjectId String)':<30} | {'Registros':<10} | {'Nombre Proyecto':<40}")
        print("-" * 80)
        
        for item in pid_counts:
            pid = item['_id']
            count = item['count']
            
            # Buscar el proyecto por su ObjectId
            try:
                from bson.objectid import ObjectId
                project = db.projects.find_one({"_id": ObjectId(pid)})
                proj_name = project.get('name', 'NO ENCONTRADO') if project else 'NO ENCONTRADO'
            except:
                proj_name = 'ERROR AL BUSCAR'
            
            print(f"{pid:<30} | {count:<10} | {proj_name:<40}")
        
        # 3. Verificar si el proyecto "Transmismetro" existe con otra búsqueda
        print("\n\n🔍 BÚSQUEDA ESPECÍFICA 'TRANSMIS':")
        print("-" * 80)
        transmis = list(db.projects.find({"name": {"$regex": "transmis", "$options": "i"}}, {"_id": 1, "name": 1}))
        if transmis:
            for t in transmis:
                print(f"Encontrado: {t['name']} - ID: {str(t['_id'])}")
        else:
            print("❌ No se encontró proyecto con 'transmis' en el nombre")
        
        # 4. Ver cuáles son los primeros registros sin relación con proyectos
        print("\n\n⚠️  REGISTROS SIN MATCH CON PROYECTOS:")
        print("-" * 80)
        orphan_pipeline = [
            {"$lookup": {
                "from": "projects",
                "localField": "pid",
                "foreignField": "_id",
                "as": "project"
            }},
            {"$match": {"project": []}},
            {"$limit": 5},
            {"$project": {"pid": 1, "cte": 1, "user": 1, "codigo": 1}}
        ]
        
        # First, convert pid strings to ObjectId
        orphans = []
        sample_records = list(db.records.find({}, {"pid": 1, "cte": 1}).limit(3))
        for rec in sample_records:
            print(f"Ejemplo de registro: pid={rec.get('pid')} (tipo: {type(rec.get('pid')).__name__})")
        
        client.close()
        print("\n✅ Diagnóstico completado\n")

except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
