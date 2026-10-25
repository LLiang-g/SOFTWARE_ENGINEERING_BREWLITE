'use client';

import { useEffect, useRef, useState } from 'react';

export default function ProductImage({
                                         src,
                                         alt,
                                     }: {
    src: string;
    alt: string;
}) {
    const [failed, setFailed] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        const img = imgRef.current;
        if (img && img.complete && img.naturalWidth === 0) {
            setFailed(true);
        }
    }, []);

    if (failed) {
        return <span className="text-5xl">☕</span>;
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            ref={imgRef}
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
        />
    );
}