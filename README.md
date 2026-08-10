# TransitPro — SaaS de gestion du transit & de la douane

Application web pour les **entreprises de transit**, **commissionnaires en douane** et **sociétés de logistique** :
gestion des dossiers, suivi des conteneurs, documents douaniers, facturation, clients, employés et rapports,
dans une interface moderne et sécurisée.

## Prérequis

- **Node.js ≥ 22.5** (utilise `node:sqlite`, intégré — aucune dépendance native)

## Installation

```bash
npm install
```

## Premier lancement (développement)

```bash
npm run dev        # API sur http://localhost:3001 + interface sur http://localhost:5173
```

Ou en deux terminaux :

```bash
npm run api        # API Express + SQLite
npm run dev        # Vite / React
```

Au premier démarrage, la base est vide : la page de connexion propose de **créer le compte
administrateur** (nom, e-mail, mot de passe ≥ 8 caractères). Ce compte est le seul à pouvoir gérer
les employés et le journal d'audit ; il crée ensuite les autres comptes (responsable, comptable,
employé, client) via la page *Employés*.

## Déploiement en production

```bash
npm run build      # vérification TypeScript + build de l'interface dans dist/
npm start          # API + interface servie par Express (un seul port)
```

L'application complète tourne alors sur un seul processus/port (par défaut `3001`) :
l'API sous `/api/*`, les fichiers téléversés sous `/uploads/*`, et l'interface React
avec repli SPA pour toutes les autres routes.

### Variables d'environnement

Copiez `.env.example` vers `.env` (ou exportez les variables) :

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3001` | Port HTTP du serveur (API + interface) |
| `DATA_DIR` | `data/` | Dossier contenant la base SQLite |
| `DB_PATH` | `data/app.db` | Chemin complet de la base SQLite |
| `UPLOAD_DIR` | `uploads/` | Dossier des documents téléversés |

### Persistance et sauvegarde

- Les données sont dans `data/app.db` (format SQLite) — sauvegardez ce fichier.
- Les documents téléversés sont dans `uploads/` — sauvegardez ce dossier avec la base.
- En cas de déploiement multi-instances, les sessions étant en mémoire, configurez un
  répartiteur avec « sticky sessions » ou remplacez le stockage de sessions par un cache partagé.

## Modules

- **Tableau de bord** — statistiques en temps réel, dossiers en cours, conteneurs en transit,
  expéditions en retard, CA, paiements en attente, calendrier des 7 prochains jours, notifications.
- **Clients** — fiches clients, contacts, historique des dossiers, documents, factures et solde client.
- **Dossiers** — numérotation automatique (`DOS-2026-XXX`), référence interne, client, agent responsable,
  type d'opération (Import/Export/Transit), pays et ports, ETA, date de livraison, statut.
- **Conteneurs** — numéro, taille (20′, 40′, HC…), compagnie maritime, navire, voyage, position,
  statut et historique des mouvements.
- **Suivi des opérations** — 9 étapes personnalisables par dossier (création → réception des documents →
  déclaration en douane → paiement des droits → contrôle douanier → mainlevée → chargement → livraison →
  clôture), validables pas à pas.
- **Gestion documentaire** — facture commerciale, packing list, BL, certificat d'origine, déclaration
  douanière… téléversement de fichiers (PDF, images), suivi des expirations, téléchargement et impression.
- **Finance** — devis et factures (numérotation automatique, impression), encaissements, dépenses,
  solde client et tableau de rentabilité.
- **Employés** — comptes utilisateurs, rôles et permissions, équipes.
- **Notifications** — documents expirés, dossiers en retard, paiements reçus, nouveaux dossiers.
- **Rapports** — CA par période et par mois, rentabilité, volume par type d'opération et par statut,
  performances des agents, statistiques par client.

## Rôles et permissions

- **Administrateur** — accès complet + gestion des employés + journal d'audit.
- **Responsable Transit** — dossiers, conteneurs, suivi des opérations, clients, rapports.
- **Comptable** — devis, factures, encaissements, dépenses, rapports financiers.
- **Employé** — dossiers, conteneurs, documents, suivi des opérations.
- **Client** — portail sécurisé : uniquement ses dossiers, ses documents et ses factures.

## Sécurité

- Mots de passe hachés avec **scrypt** (sel aléatoire par compte, `node:crypto`).
- Sessions avec expiration (7 jours, glissantes) et limite de tentatives de connexion
  (10 par fenêtre de 15 minutes).
- Restrictions d'accès **côté serveur** par rôle — le portail client ne reçoit jamais
  les données des autres clients.
- Journal d'audit de toutes les actions sensibles.

## Architecture

```
server/
  db.js         Schéma SQLite (node:sqlite, sans dépendance native)
  index.js      API Express (auth, rôles, journal d'audit, interface statique en production)
src/
  api.ts        Client API + formatage (dates, montants, libellés)
  components/   UI kit (cartes, tableaux, modales, badges) + layout (sidebar, notifications)
  pages/        Tableau de bord, Clients, Dossiers, Conteneurs, Documents, Finance,
                Employés, Rapports, Journal d'audit, Notifications
data/app.db     Base de données SQLite (créée au premier démarrage)
uploads/        Fichiers téléversés (documents)
```

Stack : **Node.js** (SQLite intégré) · **Express** · **React 19** · **Vite** · **Tailwind CSS 4** ·
**React Router** · **lucide-react** · **date-fns**.

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | API + interface en parallèle (concurrently) |
| `npm run api` | API seule (avec rechargement automatique) |
| `npm run build` | Vérification TypeScript + build de production |
| `npm start` | Serveur de production (API + interface) |
