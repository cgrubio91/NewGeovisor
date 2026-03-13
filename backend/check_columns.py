from sqlalchemy import create_engine, inspect
engine = create_engine("postgresql://postgres:1064112177@localhost:5432/geovisor_db")
inspector = inspect(engine)
columns = inspector.get_columns('layers')
for column in columns:
    print(column['name'])
