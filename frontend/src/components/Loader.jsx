import { Loader2 } from 'lucide-react';

export default function Loader({ text = 'Loading JanSamadhan…' }) {
  return (
    <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-3 p-8">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="animate-pulse text-xs font-semibold text-slate-500">{text}</p>
    </div>
  );
}
