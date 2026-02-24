from sqlalchemy import create_engine, text
try:
    engine = create_engine('postgresql://postgres:1064112177@localhost:5432/geovisor_db')
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE measurements ADD COLUMN IF NOT EXISTS link TEXT'))
        conn.commit()
    print("Column 'link' added successfully.")
except Exception as e:
    print(f"Error updating database: {e}")
