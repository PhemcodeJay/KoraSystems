export function ComingSoonNotice({ app }: { app: string }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
      <p className="font-medium">
        You are signed in and seeing real data for your account.
      </p>
      <p className="mt-1">
        {app} is not built yet — this is its interim view, scoped server-side to
        your own records. Every figure comes from the{" "}
        <code className="rounded bg-white/60 px-1">kora</code> schema and is keyed
        off your signed-in account, not a URL parameter.
      </p>
    </div>
  );
}
