'use client';

import { useEffect, useRef, useState } from 'react';

interface StatsCounterProps {
    end: number;
    duration?: number;
    suffix?: string;
    decimals?: number;
}

export function StatsCounter({ end, duration = 2000, suffix = '', decimals = 0 }: StatsCounterProps) {
    const [count, setCount] = useState(0);
    const [hasAnimated, setHasAnimated] = useState(false);
    const counterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !hasAnimated) {
                    setHasAnimated(true);

                    const startTime = Date.now();
                    const startValue = 0;
                    const change = end - startValue;

                    const animate = () => {
                        const currentTime = Date.now();
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);

                        // Easing function for smooth animation
                        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                        const currentCount = startValue + change * easeOutQuart;

                        setCount(currentCount);

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        }
                    };

                    animate();
                }
            },
            { threshold: 0.5 }
        );

        if (counterRef.current) {
            observer.observe(counterRef.current);
        }

        return () => observer.disconnect();
    }, [end, duration, hasAnimated]);

    return (
        <div ref={counterRef} className="tabular-nums">
            {count.toFixed(decimals)}
            {suffix}
        </div>
    );
}
