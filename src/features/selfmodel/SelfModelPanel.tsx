// Le panneau listait des objectifs codes en dur ; ils ont ete retires sans
// que la source reelle soit branchee, laissant `[].map(([name, status]) => ...)`
// — TypeScript infere `never[]`, d'ou l'erreur TS2488 qui cassait le build et
// maintenait le service en boucle de redemarrage.
//
// Il n'existe aucune API de lecture des objectifs cote dashboard : neronApi
// n'expose que `sendGoal` (POST /goal). Tant que Goal ne fournit pas de route
// de lecture, ce panneau affiche un etat vide explicite plutot que de laisser
// croire qu'il n'y a aucun objectif.
type Objectif = { name: string; status: string };

const objectifs: Objectif[] = [];

export function SelfModelPanel() {
  if (objectifs.length === 0) {
    return (
      <div className="list-panel">
        <h3>Modèle de soi · objectifs</h3>
        <p className="rack-refresh-note">Lecture des objectifs non disponible.</p>
      </div>
    );
  }

  return (
    <div className="list-panel">
      <h3>Modèle de soi · objectifs</h3>
      {objectifs.map(({ name, status }) => (
        <article key={name}>
          <div><strong>{name}</strong><small>Goal Engine</small></div>
          <span>{status}</span>
        </article>
      ))}
    </div>
  );
}
