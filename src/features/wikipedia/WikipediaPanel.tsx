type WikipediaData = {
  query: string;
  title: string | null;
  url: string | null;
  summary: string | null;
  image_url: string | null;
} | null;

type WikipediaProps = {
  data: WikipediaData;
};

export function WikipediaPanel({ data }: WikipediaProps) {
  if (!data || !data.url) {
    return <div className="panel-empty">Aucune page Wikipédia à afficher.</div>;
  }

  const blocksEmbedding = data.url.includes('instagram.com') || data.url.includes('x.com') || data.url.includes('twitter.com') || data.url.includes('facebook.com') || data.url.includes('youtube.com');
  const platformLabel = data.url.includes('instagram.com')
    ? 'Instagram'
    : (data.url.includes('x.com') || data.url.includes('twitter.com'))
    ? 'X'
    : data.url.includes('facebook.com')
    ? 'Facebook'
    : data.url.includes('youtube.com')
    ? 'YouTube'
    : 'le site';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 10px', fontSize: 13, opacity: 0.8, display: 'flex', gap: 10, alignItems: 'center' }}>
        {data.image_url && (
          <img
            src={data.image_url}
            alt={data.title ?? data.query}
            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
          />
        )}
        <span>{data.title ?? data.query}</span>
      </div>
      {blocksEmbedding ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <a href={data.url} target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', fontSize: 15 }}>
            Voir sur {platformLabel} ↗
          </a>
        </div>
      ) : (
        <iframe
          src={data.url}
          title={data.title ?? 'Wikipédia'}
          style={{ flex: 1, border: 'none', width: '100%', minHeight: 400 }}
          sandbox="allow-same-origin allow-scripts allow-popups"
        />
      )}
    </div>
  );
}

export type { WikipediaData };
