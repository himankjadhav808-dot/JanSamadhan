export default function PlaceholderPage({ title, description }) {
  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-slate-600">{description}</p>
      </div>
    </section>
  );
}
