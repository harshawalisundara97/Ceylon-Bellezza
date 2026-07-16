export default function AboutContact({ content }: { content: Record<string, string> }) {
  if (!content.about_us && !content.contact_info) {
    return null;
  }

  return (
    <section className="bg-ivory px-6 py-12">
      <div className="grid gap-8 md:grid-cols-2">
        {content.about_us && (
          <div>
            <h2 className="font-serif text-2xl text-ink">About Us</h2>
            <p className="mt-3 text-taupe">{content.about_us}</p>
          </div>
        )}
        {content.contact_info && (
          <div>
            <h2 className="font-serif text-2xl text-ink">Contact</h2>
            <p className="mt-3 text-taupe">{content.contact_info}</p>
          </div>
        )}
      </div>
    </section>
  );
}
