import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def log(msg, success=True):
    status = "[OK]" if success else "[FAIL]"
    print(f"{status} {msg}")

def check_backend_health():
    try:
        resp = requests.get(f"{BASE_URL}/")
        if resp.status_code == 200:
            log("Backend health check passed")
            return True
        else:
            log(f"Backend returned {resp.status_code}", False)
            return False
    except Exception as e:
        log(f"Backend connection failed: {e}", False)
        return False

def test_user_flow():
    # 1. Get or Create User
    # Try getting user 1
    user_id = 1
    resp = requests.get(f"{BASE_URL}/users/{user_id}")
    
    if resp.status_code == 200:
        log(f"User {user_id} found")
        return user_id, True
    elif resp.status_code == 404:
        log(f"User {user_id} not found", False)
        return user_id, False
    else:
        log(f"Get User failed: {resp.text}", False)
        return user_id, False

def test_project_flow(user_id):
    # 2. Create Project
    project_data = {
        "name": "Integration Test Project",
        "description": "Created by automated script"
    }
    
    # Construct URL with query param as per current implementation? 
    # Wait, in main.py: 
    # @app.post("/projects/", response_model=schemas.ProjectRead)
    # def create_project(project: schemas.ProjectCreate, user_id: int, db: Session = Depends(get_db)):
    # usage: POST /projects/?user_id=1 Body: JSON
    
    log(f"Creating project for user {user_id}...")
    resp = requests.post(f"{BASE_URL}/projects/", params={"user_id": user_id}, json=project_data)
    
    if resp.status_code == 200:
        project = resp.json()
        log(f"Project created: ID {project['id']}, Name: {project['name']}")
        
        # 3. List Projects
        resp_list = requests.get(f"{BASE_URL}/projects/{user_id}")
        if resp_list.status_code == 200:
            projects = resp_list.json()
            log(f"Fetched {len(projects)} projects for user {user_id}")
            found = any(p['id'] == project['id'] for p in projects)
            if found:
                log("Created project found in list")
            else:
                log("Created project NOT found in list", False)
        else:
            log(f"Failed to list projects: {resp_list.text}", False)
            
    else:
        log(f"Failed to create project: {resp.text}", False)

if __name__ == "__main__":
    if check_backend_health():
        uid, ok = test_user_flow()
        if ok:
            test_project_flow(uid)
        else:
            log("Skipping project tests due to user error", False)
