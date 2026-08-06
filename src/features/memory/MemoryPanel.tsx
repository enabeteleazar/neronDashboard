import { useCallback, useEffect, useState } from 'react';
import { API_KEY, MEMORY_URL } from '../../lib/config';

// Le carnet est ce que Neron tient pour vrai, le brouillon ce qu il
// soupconne. Une fiche passe de l un a l autre a partir de SEUIL points :
// 1 point par message de l utilisateur, 0.5 par relecture.
const SEUIL = 2;

type Fact = {
  id: number; subject: string; predicate: string; object: string;
  created_at: string; retracted: boolean;
};

type Candidate = {
  id: number; subject: string; predicate: string; object: string;
  points: number; message_count: number; origines: string[];
  last_seen: string; promoted_at: string | null;
};

type Etat = {
  en_cours: boolean; relus: number; total: number;
  passes_total: number; derniere_passe: string | null;
};

async function api(chemin: string, init?: RequestInit) {
  const r = await fetch(`${MEMORY_URL}${chemin}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function Score({ points }: { points: number }) {
  const pct = Math.min((points / SEUIL) * 100, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 3 }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: pct >= 100 ? '#4ade80' : '#facc15',
          transition: 'width .4s ease',
        }} />
      </div>
      <span style={{ fontSize: 12, opacity: .7, whiteSpace: 'nowrap' }}>{points} / {SEUIL}</span>
    </div>
  );
}

function Triplet({ s, p, o }: { s: string; p: string; o: string }) {
  return (
    <span>
      <b>{s}</b>
      <span style={{ opacity: .5, margin: '0 6px' }}>{p.replace(/_/g, ' ')}</span>
      <b>{o}</b>
    </span>
  );
}

export function MemoryPanel() {
  const [onglet, setOnglet] = useState<'carnet' | 'brouillon'>('carnet');
  const [facts, setFacts] = useState<Fact[]>([]);
  const [candidats, setCandidats] = useState<Candidate[]>([]);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [phrases, setPhrases] = useState<Record<number, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      setErreur(null);
      const [f, c, e] = await Promise.all([
        api('/memory/facts?limit=500'),
        api('/memory/candidates?limit=500'),
        api('/memory/reread/status'),
      ]);
      setFacts((f.facts ?? []).filter((x: Fact) => !x.retracted));
      setCandidats(c.candidates ?? []);
      setEtat(e);
    } catch (err) {
      setErreur(String(err));
    }
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  // Tant qu une relecture tourne, on rafraichit : une passe dure environ
  // 400 s, l utilisateur doit voir que ca avance.
  useEffect(() => {
    if (!etat?.en_cours) return;
    const t = setInterval(() => { void charger(); }, 5000);
    return () => clearInterval(t);
  }, [etat?.en_cours, charger]);

  async function voirPhrase(cand: Candidate) {
    const origine = cand.origines[0];
    if (!origine || phrases[cand.id]) return;
    try {
      const r = await api(`/memory/records/${encodeURIComponent(origine)}`);
      setPhrases((p) => ({ ...p, [cand.id]: r.record?.content ?? 'introuvable' }));
    } catch { /* silencieux : l absence de phrase ne doit pas casser l ecran */ }
  }

  async function action(chemin: string, corps?: unknown) {
    try {
      await api(chemin, { method: 'POST', body: corps ? JSON.stringify(corps) : undefined });
      await charger();
    } catch (err) {
      setErreur(String(err));
    }
  }

  const enAttente = candidats.filter((c) => !c.promoted_at);

  return (
    <div className="memory-panel">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setOnglet('carnet')}
          style={{ opacity: onglet === 'carnet' ? 1 : .5 }}>
          Carnet ({facts.length})
        </button>
        <button onClick={() => setOnglet('brouillon')}
          style={{ opacity: onglet === 'brouillon' ? 1 : .5 }}>
          Brouillon ({enAttente.length})
        </button>
        <span style={{ flex: 1 }} />
        <button
          disabled={etat?.en_cours}
          onClick={() => action('/memory/reread', { limit: 5, background: true })}>
          {etat?.en_cours ? `Relecture ${etat.relus}/${etat.total}…` : 'Relire'}
        </button>
      </div>

      {erreur && <p style={{ color: '#f87171' }}>Erreur : {erreur}</p>}

      {onglet === 'carnet' && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {facts.map((f) => (
            <li key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
              <Triplet s={f.subject} p={f.predicate} o={f.object} />
              <span style={{ flex: 1 }} />
              <button onClick={() => action('/memory/facts/retract', {
                subject: f.subject, predicate: f.predicate, object: f.object,
              })}>Retirer</button>
            </li>
          ))}
          {facts.length === 0 && <li style={{ opacity: .6 }}>Le carnet est vide.</li>}
        </ul>
      )}

      {onglet === 'brouillon' && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {enAttente.map((c) => (
            <li key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Triplet s={c.subject} p={c.predicate} o={c.object} />
                <span style={{ flex: 1 }} />
                <Score points={c.points} />
                <span style={{ fontSize: 12, opacity: .6, whiteSpace: 'nowrap' }}>
                  {c.message_count} msg
                </span>
                <button onClick={() => action(`/memory/candidates/${c.id}/promote`)}>Valider</button>
                <button onClick={() => action(`/memory/candidates/${c.id}/reject`)}>Écarter</button>
              </div>
              <div style={{ fontSize: 12, opacity: .6, marginTop: 4 }}>
                {phrases[c.id]
                  ? <em>« {phrases[c.id]} »</em>
                  : <a onClick={() => voirPhrase(c)} style={{ cursor: 'pointer' }}>voir la phrase d’origine</a>}
              </div>
            </li>
          ))}
          {enAttente.length === 0 && <li style={{ opacity: .6 }}>Le brouillon est vide.</li>}
        </ul>
      )}
    </div>
  );
}
