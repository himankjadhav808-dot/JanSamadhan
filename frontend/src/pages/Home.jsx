import { Landmark } from 'lucide-react';
export default function Home() {
  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Landmark className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Home</h1>
        <p className="mt-2 text-slate-600">
          Citizen feed, issue cards, and the nearby map will land here in Step 5.
        </p>
      </div>
    </section>
  );
}
