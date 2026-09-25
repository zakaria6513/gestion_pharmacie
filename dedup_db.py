import sqlite3
import shutil
import os
from datetime import datetime

DB_PATH = r'd:\gest_phar\release\backup_pharmacie_2026-02-28.db'
BACKUP_PATH = r'd:\gest_phar\release\backup_pharmacie_2026-02-28_AVANT_DEDUP.db'

# 1. Créer une sauvegarde de sécurité avant toute modification
print("Création d'une sauvegarde de sécurité...")
shutil.copy2(DB_PATH, BACKUP_PATH)
print(f"Sauvegarde créée : {BACKUP_PATH}")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# 2. Compter avant
cursor.execute("SELECT COUNT(*) FROM products")
total_avant = cursor.fetchone()[0]
print(f"\nNombre de produits AVANT: {total_avant}")

# 3. Identifier pour chaque nom le produit à GARDER:
#    - Celui avec le stock le plus élevé
#    - En cas d'égalité, on garde celui avec l'ID le plus petit (le plus ancien)
print("\nRecherche des doublons...")
cursor.execute("""
    SELECT LOWER(TRIM(name)) as nom_norm, COUNT(*) as nb
    FROM products
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
""")
doublons = cursor.fetchall()
print(f"Nombre de noms avec doublons: {len(doublons)}")

# 4. Pour chaque groupe de doublons, trouver l'ID à garder (max stock, puis min id)
ids_a_garder = []
for (nom_norm, nb) in doublons:
    cursor.execute("""
        SELECT id FROM products
        WHERE LOWER(TRIM(name)) = ?
        ORDER BY stock_quantity DESC, id ASC
        LIMIT 1
    """, (nom_norm,))
    row = cursor.fetchone()
    if row:
        ids_a_garder.append(row[0])

print(f"Nombre de produits à GARDER (un par nom): {len(ids_a_garder)}")

# 5. Identifier les IDs à supprimer
#    (tous les doublons sauf ceux dans ids_a_garder)
# On travaille par groupe
ids_a_supprimer = []
for (nom_norm, nb) in doublons:
    cursor.execute("""
        SELECT id FROM products
        WHERE LOWER(TRIM(name)) = ?
        ORDER BY stock_quantity DESC, id ASC
    """, (nom_norm,))
    rows = cursor.fetchall()
    # Le premier on le garde, les autres on les supprime
    for i, row in enumerate(rows):
        if i > 0:  # Sauter le premier (celui à garder)
            ids_a_supprimer.append(row[0])

print(f"Nombre de produits à SUPPRIMER: {len(ids_a_supprimer)}")

# 6. Supprimer en lots pour performance
print("\nSuppression des doublons en cours...")
batch_size = 500
total_supprime = 0
for i in range(0, len(ids_a_supprimer), batch_size):
    batch = ids_a_supprimer[i:i+batch_size]
    placeholders = ','.join(['?' for _ in batch])
    cursor.execute(f"DELETE FROM products WHERE id IN ({placeholders})", batch)
    total_supprime += cursor.rowcount
    if (i // batch_size) % 10 == 0:
        print(f"  Progression: {total_supprime}/{len(ids_a_supprimer)} supprimés...")

conn.commit()

# 7. Vérifier le résultat
cursor.execute("SELECT COUNT(*) FROM products")
total_apres = cursor.fetchone()[0]
print(f"\n=== RÉSULTAT ===")
print(f"Produits AVANT: {total_avant}")
print(f"Produits APRÈS: {total_apres}")
print(f"Produits supprimés: {total_avant - total_apres}")

# 8. Vérifier qu'il n'y a plus de doublons
cursor.execute("""
    SELECT COUNT(*) FROM (
        SELECT LOWER(TRIM(name)) as nom_norm
        FROM products
        GROUP BY LOWER(TRIM(name))
        HAVING COUNT(*) > 1
    )
""")
doublons_restants = cursor.fetchone()[0]
print(f"Doublons restants: {doublons_restants}")

# 9. VACUUM pour optimiser la base de données
print("\nOptimisation de la base de données (VACUUM)...")
conn.execute("VACUUM")
print("VACUUM terminé.")

conn.close()
print("\nOpération terminée avec succès!")
print(f"La base de données originale a été sauvegardée sous: {BACKUP_PATH}")
