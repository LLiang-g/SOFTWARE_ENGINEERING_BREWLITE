'use client';

import { useEffect, useRef, useState } from 'react';
import DrinkArt, { drinkKindFor } from './DrinkArt';

// Ảnh sản phẩm lấp đầy khung cha. Chưa có ảnh hoặc ảnh lỗi thì vẽ ly minh họa.
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
        return <DrinkArt kind={drinkKindFor(alt)} className="h-[78%] w-auto" />;
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
