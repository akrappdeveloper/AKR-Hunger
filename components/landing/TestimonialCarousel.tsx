'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Testimonial {
    id: number;
    name: string;
    role: string;
    location: string;
    rating: number;
    comment: string;
    avatar?: string;
}

const testimonials: Testimonial[] = [
    {
        id: 1,
        name: 'Rahul Sharma',
        role: 'Customer',
        location: 'Mumbai',
        rating: 5,
        comment: 'Fastest delivery service in the city! My food arrives hot and on time every single time.',
    },
    {
        id: 2,
        name: 'Priya Patel',
        role: 'Restaurant Owner',
        location: 'Delhi',
        rating: 5,
        comment: 'As a restaurant owner, the platform has increased my orders by 300%. Best decision ever!',
    },
    {
        id: 3,
        name: 'Vikram Singh',
        role: 'Delivery Partner',
        location: 'Bangalore',
        rating: 5,
        comment: 'Great earning potential with flexible hours. The app is user-friendly and payments are on time.',
    },
    {
        id: 4,
        name: 'Anita Kumar',
        role: 'Customer',
        location: 'Pune',
        rating: 5,
        comment: 'Love the variety of restaurants available! The search filters make it so easy to find exactly what I want.',
    },
    {
        id: 5,
        name: 'Rajesh Mehta',
        role: 'Restaurant Owner',
        location: 'Hyderabad',
        rating: 5,
        comment: 'The platform has helped us reach customers we never could before. Highly recommended for any restaurant!',
    },
];

export function TestimonialCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % testimonials.length);
        }, 5000); // Auto-advance every 5 seconds

        return () => clearInterval(interval);
    }, [isPaused]);

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    };

    const currentTestimonial = testimonials[currentIndex];

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <Card className="border-2 hover:shadow-xl transition-shadow">
                <CardContent className="p-8 sm:p-12">
                    {/* Stars */}
                    <div className="flex gap-1 mb-6 justify-center">
                        {[...Array(currentTestimonial.rating)].map((_, i) => (
                            <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        ))}
                    </div>

                    {/* Quote */}
                    <blockquote className="text-lg md:text-xl text-center mb-8 leading-relaxed">
                        "{currentTestimonial.comment}"
                    </blockquote>

                    {/* Author */}
                    <div className="flex flex-col items-center gap-4">
                        <Avatar className="w-16 h-16">
                            <AvatarImage src={currentTestimonial.avatar} />
                            <AvatarFallback className="text-lg bg-primary/10 text-primary">
                                {currentTestimonial.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="text-center">
                            <p className="font-bold text-lg">{currentTestimonial.name}</p>
                            <p className="text-sm text-muted-foreground">
                                {currentTestimonial.role}, {currentTestimonial.location}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <Button
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full shadow-lg hidden sm:flex"
                onClick={handlePrevious}
            >
                <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
                variant="outline"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full shadow-lg hidden sm:flex"
                onClick={handleNext}
            >
                <ChevronRight className="w-4 h-4" />
            </Button>

            {/* Mobile Navigation */}
            <div className="flex sm:hidden gap-2 justify-center mt-4">
                <Button variant="outline" size="sm" onClick={handlePrevious}>
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleNext}>
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Indicators */}
            <div className="flex justify-center gap-2 mt-6">
                {testimonials.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={`h-2 rounded-full transition-all ${index === currentIndex
                                ? 'bg-primary w-8'
                                : 'bg-primary/30 w-2 hover:bg-primary/50'
                            }`}
                        aria-label={`Go to testimonial ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
