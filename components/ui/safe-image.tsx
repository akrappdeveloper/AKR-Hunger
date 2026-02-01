'use client';

import React, { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { ChefHat, ImageIcon } from 'lucide-react';

interface SafeImageProps extends Omit<ImageProps, 'src'> {
    src?: string | null;
    fallbackType?: 'food' | 'restaurant' | 'generic';
    useImgTag?: boolean; // Option to use standard <img> tag instead of next/image
}

export default function SafeImage({
    src,
    alt,
    fallbackType = 'generic',
    useImgTag = false,
    className,
    ...props
}: SafeImageProps) {
    const [error, setError] = useState(false);
    const [imgSrc, setImgSrc] = useState<string | null>(src || null);

    useEffect(() => {
        setImgSrc(src || null);
        setError(false);
    }, [src]);

    const handleError = () => {
        setError(true);
    };

    if (!imgSrc || error) {
        return (
            <div className={`flex items-center justify-center bg-gray-900 border border-white/5 ${className} relative overflow-hidden group`}>
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 opacity-50" />
                {/* Stylish Pattern Overlay */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />

                <div className="relative z-10 flex flex-col items-center justify-center text-gray-600">
                    {fallbackType === 'food' && <ChefHat className="w-1/3 h-1/3 opacity-20" />}
                    {fallbackType === 'restaurant' && <StoreIcon className="w-1/3 h-1/3 opacity-20" />}
                    {fallbackType === 'generic' && <ImageIcon className="w-1/3 h-1/3 opacity-20" />}
                </div>
            </div>
        );
    }

    if (useImgTag) {
        /* eslint-disable-next-line @next/next/no-img-element */
        return (
            <img
                src={imgSrc}
                alt={alt || 'Image'}
                className={className}
                onError={handleError}
                {...(props as any)} // Spread remaining props effectively
            />
        );
    }

    return (
        <Image
            src={imgSrc}
            alt={alt || 'Image'}
            className={className}
            onError={handleError}
            {...props}
        />
    );
}

function StoreIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
            <path d="M2 7h20" />
            <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
        </svg>
    )
}
