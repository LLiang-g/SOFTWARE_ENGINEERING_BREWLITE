export default function Loading() {
    return (
        <main className="mx-auto w-full max-w-5xl pb-cta md:px-6 md:pt-8" aria-busy="true">
            <div className="md:grid md:grid-cols-2 md:gap-10">
                <div className="aspect-[5/4] rounded-b-[28px] bg-line motion-safe:animate-pulse md:aspect-square md:rounded-[28px]" />
                <div className="px-4 pt-6 md:px-0 md:pt-0">
                    <div className="h-8 w-48 rounded-xl bg-line motion-safe:animate-pulse" />
                    <div className="mt-3 h-4 w-32 rounded-lg bg-line motion-safe:animate-pulse" />
                    <div className="mt-8 grid grid-cols-3 gap-2.5">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-[68px] rounded-2xl bg-line motion-safe:animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
