import sqlite3

conn = sqlite3.connect(r'd:\gest_phar\release\backup_pharmacie_2026-02-28.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print('Tables:', tables)

for table in tables:
    tname = table[0]
    cursor.execute(f"PRAGMA table_info({tname})")
    cols = cursor.fetchall()
    print(f'\nColonnes de {tname}:')
    for col in cols:
        print(' ', col)
    cursor.execute(f"SELECT COUNT(*) FROM {tname}")
    count = cursor.fetchone()
    print(f'  Nombre de lignes: {count[0]}')

conn.close()
