import sqlite3

conn = sqlite3.connect(r'd:\gest_phar\release\backup_pharmacie_2026-02-28.db')
cursor = conn.cursor()

# Analyser les doublons par nom (insensible à la casse)
cursor.execute("""
    SELECT LOWER(TRIM(name)) as nom_norm, COUNT(*) as nb, 
           MIN(stock_quantity), MAX(stock_quantity), 
           GROUP_CONCAT(id ORDER BY id) as ids
    FROM products
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
    ORDER BY nb DESC
    LIMIT 30
""")
doublons = cursor.fetchall()
print(f'Exemple de doublons (top 30):')
for d in doublons:
    print(f'  Nom: {d[0][:40]!r} | Nb: {d[1]} | Stock min: {d[2]} | Stock max: {d[3]} | IDs: {d[4][:60]}')

# Compter
cursor.execute("""
    SELECT COUNT(*) FROM (
        SELECT LOWER(TRIM(name)) as nom_norm
        FROM products
        GROUP BY LOWER(TRIM(name))
        HAVING COUNT(*) > 1
    )
""")
nb_noms_doublons = cursor.fetchone()[0]

cursor.execute("""
    SELECT COUNT(*) FROM products
    WHERE LOWER(TRIM(name)) IN (
        SELECT LOWER(TRIM(name)) FROM products
        GROUP BY LOWER(TRIM(name))
        HAVING COUNT(*) > 1
    )
""")
nb_prod_doublons = cursor.fetchone()[0]

print(f'\nNombre de noms avec doublons: {nb_noms_doublons}')
print(f'Nombre de produits concernés: {nb_prod_doublons}')
print(f'Total produits: 15873')

conn.close()
