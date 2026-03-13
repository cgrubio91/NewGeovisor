import os
from pymongo import MongoClient
from sshtunnel import SSHTunnelForwarder
from dotenv import load_dotenv
import json
from bson import ObjectId, Decimal128
from datetime import datetime

load_dotenv()

ssh_host = os.getenv("SSH_HOST")
ssh_user = os.getenv("SSH_USER")
ssh_key_path = os.getenv("SSH_KEY_PATH")
ssh_passphrase = os.getenv("SSH_PASSPHRASE")
mongo_port = int(os.getenv("MONGO_PORT", 27017))
db_name = os.getenv("DB_NAME")

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        if isinstance(o, Decimal128):
            return str(o)
        try:
            return json.JSONEncoder.default(self, o)
        except:
            return str(o)

try:
    with SSHTunnelForwarder(
        (ssh_host, 22),
        ssh_username=ssh_user,
        ssh_pkey=ssh_key_path,
        ssh_private_key_password=ssh_passphrase,
        remote_bind_address=('127.0.0.1', mongo_port)
    ) as server:
        client = MongoClient('127.0.0.1', server.local_bind_port)
        db = client[db_name]
        
        project = db.projects.find_one({"name": {"$regex": "María Paz"}})
        if project:
            print("PROJECT DATA KEYS:")
            print(list(project.keys()))
            
            if "users" in project:
                print("\nUSERS FIELD IN PROJECT:")
                print(project["users"])
                
            print("\nSAMPLE PROJECT DATA:")
            # Only print a few relevant fields to avoid huge output
            small_project = {k: project[k] for k in ["_id", "name", "users"] if k in project}
            print(json.dumps(small_project, indent=2, cls=JSONEncoder))
            
            # Find users assigned to this project
            print("\nSEARCHING USERS COLLECTION FOR THIS PROJECT ID...")
            users = list(db.users.find({"projects": project["_id"]}, {"email": 1, "displayName": 1}))
            for u in users:
                print(f"- {u.get('email')} ({u.get('_id')})")
except Exception as e:
    print(f"Error: {e}")
