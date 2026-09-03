export function SelfModelPanel() {
  return (
    <div className="list-panel">
      <h3>Modèle de soi · objectifs</h3>
      {[
        
      ].map(([name, status]) => (
        <article key={name}>
          <div><strong>{name}</strong><small>Goal Engine</small></div>
          <span>{status}</span>
        </article>
      ))}
    </div>
  );
}
