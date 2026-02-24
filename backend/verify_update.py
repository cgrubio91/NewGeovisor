from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:1064112177@localhost:5432/geovisor_db')
with engine.connect() as conn:
    result = conn.execute(text('SELECT id, name, icon, description, link FROM measurements WHERE id = 13'))
    for row in result:
        print(row._mapping)
