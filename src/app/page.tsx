import Link from "next/link";
import { buttonClass } from "@/components/ui";

const tiers = [
  { label: "S", color: "#ff7f7f" },
  { label: "A", color: "#ffbf7f" },
  { label: "B", color: "#ffdf7f" },
  { label: "C", color: "#bfff7f" },
];

export default function Landing() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">TierMade</span>
        <nav className="flex gap-2">
          <Link href="/login" className={buttonClass("ghost", "sm")}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClass("primary", "sm")}>
            Sign up
          </Link>
        </nav>
      </header>

      <section className="grid flex-1 items-center gap-10 py-16 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Rank anything. Compare with friends.
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted">
            Build ranked lists and tier lists of albums, songs, games, films and TV. Search, click,
            done: no typing titles or hunting for cover art. Then see how your taste lines up with
            your friends&rsquo;.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/signup" className={buttonClass("primary")}>
              Start ranking
            </Link>
            <Link href="/login" className={buttonClass("secondary")}>
              I have an account
            </Link>
          </div>
        </div>

        <div aria-hidden className="overflow-hidden rounded-xl border border-border bg-surface">
          {tiers.map((t, i) => (
            <div key={t.label} className="flex border-b border-border last:border-b-0">
              <div
                className="flex w-14 shrink-0 items-center justify-center text-xl font-bold text-black/80"
                style={{ background: t.color }}
              >
                {t.label}
              </div>
              <div className="flex flex-1 gap-2 p-2">
                {Array.from({ length: 4 - i }).map((_, j) => (
                  <div key={j} className="aspect-[2/3] w-12 rounded-md bg-surface-2" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border pt-4 text-xs text-muted">
        Data from Deezer, IGDB and TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
    </main>
  );
}
