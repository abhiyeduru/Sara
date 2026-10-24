import sqlite3
import psycopg2
import sys

neon_url = 'postgresql://neondb_owner:npg_6GJxPg7eWtCY@ep-rapid-dream-b4zwam3p.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require'
pg_conn = psycopg2.connect(neon_url)
pg_cur = pg_conn.cursor()

sqlite_conn = sqlite3.connect('sara.db')
sqlite_conn.row_factory = sqlite3.Row
sqlite_cur = sqlite_conn.cursor()

pg_cur.execute("SELECT table_name, column_name FROM information_schema.columns WHERE data_type = 'boolean'")
bool_map = {}
for tbl, col in pg_cur.fetchall():
    if tbl not in bool_map:
        bool_map[tbl] = set()
    bool_map[tbl].add(col)

tables = [
    'credit_transactions',
    'customer_pipelines',
    'calls',
    'call_recordings',
    'call_intelligence',
    'call_transcripts',
    'call_events',
    'crm_tasks',
    'deals',
    'crm_communications',
    'crm_meetings',
    'crm_documents'
]

for table in tables:
    try:
        sqlite_cur.execute(f'SELECT * FROM {table}')
        rows = sqlite_cur.fetchall()
        if not rows:
            print(f'Empty table in sqlite: {table}', flush=True)
            continue
        
        col_names = [d[0] for d in sqlite_cur.description]
        cols_str = ', '.join([f'"{c}"' for c in col_names])
        placeholders = ', '.join(['%s'] * len(col_names))
        insert_sql = f'INSERT INTO "{table}" ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
        table_bools = bool_map.get(table, set())
        
        row_tuples = []
        for r in rows:
            vals = []
            for c in col_names:
                v = r[c]
                if c in table_bools and v is not None:
                    v = bool(v)
                vals.append(v)
            row_tuples.append(tuple(vals))
        
        pg_cur.executemany(insert_sql, row_tuples)
        pg_conn.commit()
        print(f'Migrated {len(rows)} rows to Neon: {table}', flush=True)
    except Exception as e:
        pg_conn.rollback()
        print(f'Error migrating {table}: {e}', flush=True)

pg_conn.close()
sqlite_conn.close()
print('Migration finished!', flush=True)
