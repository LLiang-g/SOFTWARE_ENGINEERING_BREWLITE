export default function Loading() {
    return (
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-tabs md:px-6 md:pt-10" aria-busy="true">
            <div className="h-9 w-56 rounded-xl bg-line motion-safe:animate-pulse" />
            <div className="mt-3 h-4 w-64 rounded-lg bg-line motion-safe:animate-pulse" />
            <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i}>
                        <div className="aspect-square rounded-[22px] bg-line motion-safe:animate-pulse" />
                        <div className="mt-3 h-4 w-3/4 rounded-lg bg-line motion-safe:animate-pulse" />
                        <div className="mt-2 h-3.5 w-1/3 rounded-lg bg-line motion-safe:animate-pulse" />
                    </div>
                ))}
            </div>
        </main>
    );
}
