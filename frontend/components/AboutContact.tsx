export default function AboutContact({ content }: { content: Record<string, string> }) {
  if (!content.about_us && !content.contact_info) {
    return null;
  }

  return (
    <section className="py-8">
      <div className="grid gap-6 md:grid-cols-2">
        {content.about_us && (
          <div className="rounded-xl border border-hairline bg-white p-6">
            <h2 className="font-serif text-xl font-semibold text-ink">About</h2>
            <p className="mt-3 text-taupe">{content.about_us}</p>
          </div>
        )}
        {content.contact_info && (
          <div className="rounded-xl border border-hairline bg-white p-6">
            <h2 className="font-serif text-xl font-semibold text-ink">Contact</h2>
            <p className="mt-3 text-taupe">{content.contact_info}</p>
          </div>
        )}
      </div>
    </section>
  );
}
