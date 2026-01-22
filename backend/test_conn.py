from sqlalchemy import create_engine
import sys

try:
    engine = create_engine("postgresql://postgres:password@localhost/postgres")
    with engine.connect() as conn:
        print("Connected to postgres!")
except Exception as e:
    err = str(e)
    print(err[:200])
