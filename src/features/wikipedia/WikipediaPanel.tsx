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
      <iframe
        src={data.url}
        title={data.title ?? 'Wikipédia'}
        style={{ flex: 1, border: 'none', width: '100%', minHeight: 400 }}
        sandbox="allow-same-origin allow-scripts allow-popups"
      />
    </div>
  );
}

export type { WikipediaData };
