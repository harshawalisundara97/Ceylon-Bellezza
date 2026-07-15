export default function AboutContact({ content }: { content: Record<string, string> }) {
  if (!content.about_us && !content.contact_info) {
    return null;
  }

  return (
    <section className="bg-gray-50 px-6 py-10">
      {content.about_us && (
        <div>
          <h2 className="text-2xl font-semibold">About Us</h2>
          <p className="mt-3 max-w-2xl text-gray-600">{content.about_us}</p>
        </div>
      )}
      {content.contact_info && (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold">Contact</h2>
          <p className="mt-3 max-w-2xl text-gray-600">{content.contact_info}</p>
        </div>
      )}
    </section>
  );
}
