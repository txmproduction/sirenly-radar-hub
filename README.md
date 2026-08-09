# Sirenly Prospector

logo https://res.cloudinary.com/dgfdye7cl/image/upload/v1786237162/kling_20260720_IMAGE_Modern_min_5818_0_xgfcuv.jpg Crée une application web "Sirenly" — un outil de prospection B2B, interface sombre et moderne façon SaaS.

1. BASE DE DONNÉES

Table "leads" : id (text, clé primaire), nom (text), contact (text), telephone (text), commune (text), activite (text), adresse (text), code_postal (text), forme_juridique (text), note_google (text), nb_avis_google (text), statut (text, défaut "non_qualifie"), notes (text), qualifie_par (text), rdv_date (text), rdv_heure (text), date_maj (timestamptz, défaut now()).

Table "emails_envoyes" : id (uuid, clé primaire par défaut), lead_id (text, référence leads.id), sujet (text), contenu (text), date_envoi (timestamptz, défaut now()), statut_envoi (text, ex "envoyé"/"ouvert"/"cliqué").

Table "reponses_formulaire" : id (uuid, clé primaire par défaut), lead_id (text, référence leads.id, peut être vide si non rattaché), nom_entreprise (text), reponses (jsonb — stocke les réponses brutes du formulaire), classification (text, "chaud"/"tiede"/"froid"), date_reponse (timestamptz, défaut now()).

Active la réplication temps réel sur les 3 tables.

2. TABLEAU DE BORD (page d'accueil)

- Stats en haut : leads qualifiés ce mois, emails envoyés (count sur emails_envoyes), taux de réponse (reponses_formulaire / emails_envoyes)

- Graphique des leads générés sur les 7 derniers jours

- Liste des derniers leads qualifiés avec statut

3. GÉNÉRATION DE LEADS

- Formulaire : département (texte, ex "74"), nombre de jours (nombre, défaut 7)

- Bouton "Lancer le radar" → Edge Function "generate-leads" :

  a) Appelle l'API BODACC (https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records), filtre où numerodepartement, familleavis_lib='Créations', dateparution >= date calculée

  b) Extrait nom, contact, activité, commune, code postal, adresse, forme juridique

  c) Exclut les activités/formes contenant : holding, portage, gestion de participations, société civile immobilière, coursier, livreur, livraison de repas, uber eats, à vélo

  d) Pour chaque lead retenu, appelle Google Places Text Search (clé dans le secret GOOGLE_PLACES_API_KEY) avec "{nom} {commune}" pour note et nb avis, puis Place Details pour le téléphone

  e) Upsert dans "leads" (id = slug nom+commune, ne pas écraser statut/notes/qualifie_par si déjà existant)

- Affiche le nombre de leads ajoutés

4. QUALIFICATION DES LEADS

- Liste filtrable par statut

- Par lead : changer statut (non_qualifie, pas_de_reponse, pas_interesse, pas_decisionnaire, rdv_pris), ajouter notes, définir date/heure RDV

- Synchronisation temps réel

5. DÉTAIL PAR LEAD — HISTORIQUE COMPLET

- En cliquant sur un lead, ouvrir une vue détail qui affiche :

  - Toutes ses infos (BODACC + Google Places)

  - L'historique des emails envoyés à ce lead (depuis emails_envoyes), avec sujet, date, statut

  - Sa réponse au formulaire si elle existe (depuis reponses_formulaire), avec le détail des réponses et sa classification chaud/tiède/froid affichée en badge coloré (🔥 chaud / 🌤️ tiède / ❄️ froid)

6. VUE "RÉPONSES FORMULAIRE"

- Page listant toutes les entrées de reponses_formulaire, triable/filtrable par classification (chaud/tiède/froid), avec lien vers la fiche du lead correspondant

Design : thème sombre, accents bleu/orange, cartes arrondies, typographie moderne façon dashboard SaaS professionnel.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sirenly-radar-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0715bd05-c326-4de8-850b-af265a63edba).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
