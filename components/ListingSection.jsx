export default function ListingSection({ title, children, id, href }) {
  return (
    <section id={id} className="rounded-xl border border-zinc-300 bg-white shadow-sm overflow-hidden">
      <div className="bg-zinc-50 border-b border-zinc-300 px-4 sm:px-5 py-2.5">
        <h2 className="font-semibold text-zinc-900 break-words">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 hover:underline decoration-blue-400"
            >
              {title}
            </a>
          ) : (
            title
          )}
        </h2>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
