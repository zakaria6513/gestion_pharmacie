# 💊 GestPhar - Application de Gestion de Pharmacie

**GestPhar** (Pharmacie Amdjarass) est une application desktop moderne et performante conçue pour la gestion complète des opérations d'une pharmacie : gestion des stocks, point de vente (caisse), suivi des ventes et administration des utilisateurs.

---

## 🚀 Fonctionnalités Principales

- 📊 **Tableau de Bord (Dashboard)** : Visualisation globale des ventes, statistiques en temps réel et alertes de péremption/rupture de stock.
- 🛒 **Point de Vente (POS / Caisse)** : Interface rapide et intuitive pour l'encaissement, la recherche d'articles et la validation des paniers.
- 📦 **Gestion des Stocks & Produits** : Suivi des stocks de médicaments, gestion des prix, alertes de péremption et réapprovisionnement.
- 📜 **Historique des Ventes** : Consultation, filtrage et analyse détaillée des transactions passées.
- 👥 **Gestion des Utilisateurs & Rôles** : Contrôle d'accès sécurisé différenciant les rôles (Administrateur / Caissier).
- 💾 **Base de Données Locale** : Fonctionnement hors-ligne autonome grâce à SQLite.

---

## 🛠️ Stack Technique

- **Desktop Framework** : [Electron](https://www.electronjs.org/)
- **Frontend** : [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Styling** : [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
- **Icônes** : [Lucide React](https://lucide.dev/)
- **Base de données** : [SQLite](https://sqlite.org/) via `better-sqlite3`
- **Build & Packaging** : `electron-builder` (génération d'installateur Windows NSIS `.exe`)

---

## 📂 Structure du Projet

```text
gest_phar/
├── electron/          # Script principal et configuration Electron
├── src/
│   ├── components/    # Composants de pages (Dashboard, POS, Products, etc.)
│   ├── context/       # Contextes React (AuthContext, ThemeContext)
│   ├── layout/        # Structure et navigation principale
│   ├── App.tsx        # Routage principal
│   └── main.tsx       # Point d'entrée React
├── public/            # Ressources statiques (icônes, images)
└── package.json       # Dépendances et scripts du projet
```

---

## 🔧 Installation et Développement

### Prérequis
- [Node.js](https://nodejs.org/) (Version 18+ recommandée)
- npm ou yarn

### 1. Cloner le dépôt
```bash
git clone https://github.com/votre-compte/gest_phar.git
cd gest_phar
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Lancer en mode Développement
```bash
npm run dev
```

---

## 📦 Build et Distribution

Pour générer l'installateur Windows (`.exe`) :

```bash
npm run build
```

Le fichier `.exe` généré se trouvera dans le dossier `release/`.

---

## 🔒 Licence & Sécurité

Ce projet est sous licence privée et est destiné à une utilisation interne ou de démonstration. Les bases de données SQLite (`*.db`) ainsi que les exports réels de la pharmacie sont volontairement ignorés par `.gitignore` pour des raisons de confidentialité.
