import Link from 'next/link';

export default function Home() {
  return (
    <>
      <section className="rounded-2xl bg-forest text-white p-8 mb-8">
        <h1 className="text-4xl font-bold mb-3">
          Find the race. <span className="text-lime">Join the lime.</span>
        </h1>
        <p className="text-lg max-w-2xl">
          RunLime is the 5K race calendar and run tracker for Trinidad and Tobago. Discover races, get reminders, check in on race day
          and keep your own running history.
        </p>
      </section>
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-6">
          <h2 className="text-xl font-bold mb-2">Organising a race?</h2>
          <p className="mb-4">Apply for an organiser account to list your events once our team has verified you.</p>
          <Link href="/organiser" className="font-semibold">
            Go to the organiser portal →
          </Link>
        </div>
        <div className="rounded-xl border border-line p-6">
          <h2 className="text-xl font-bold mb-2">Adults 18+</h2>
          <p>
            RunLime accounts are for adults aged 18 and over. Children are welcome at events with an adult, who adds them to their group.
          </p>
        </div>
      </section>
    </>
  );
}
