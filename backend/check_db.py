from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
import os
from database import settings

def create_database_if_not_exists():
    db_url = settings.DATABASE_URL
    db_name = db_url.split("/")[-1]
    base_url = db_url.rsplit("/", 1)[0] + "/postgres"  # Connect to default 'postgres' db

    try:
        # Try connecting to the target database
        engine = create_engine(db_url)
        with engine.connect() as conn:
            print(f"Successfully connected to {db_name}")
            return True
    except OperationalError:
        print(f"Database {db_name} does not exist or connection failed. Trying to create it...")
        
        try:
            # Connect to 'postgres' database to create the new database
            engine = create_engine(base_url, isolation_level="AUTOCOMMIT")
            with engine.connect() as conn:
                # Check if database exists
                result = conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'"))
                if not result.fetchone():
                    print(f"Creating database {db_name}...")
                    conn.execute(text(f"CREATE DATABASE {db_name}"))
                    print(f"Database {db_name} created successfully.")
                else:
                    print(f"Database {db_name} already exists (but connection might have failed for other reasons).")
            return True
        except Exception as e:
            print(f"Failed to create database: {e}")
            return False

if __name__ == "__main__":
    create_database_if_not_exists()
