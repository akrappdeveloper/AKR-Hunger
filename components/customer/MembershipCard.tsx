'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface MembershipCardProps {
    customerName: string;
    cardNumber: string;
    expiryDate: string;
    akrNumber: string;
    userImage?: string;
}

const MembershipCard: React.FC<MembershipCardProps> = ({
    customerName,
    cardNumber,
    expiryDate,
    akrNumber,
    userImage,
}) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const frontRef = useRef<HTMLDivElement>(null);
    const backRef = useRef<HTMLDivElement>(null);

    const handleFlip = () => setIsFlipped(!isFlipped);

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!frontRef.current || !backRef.current) return;

        try {
            toast.loading('Generating PDF...');

            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            container.style.display = 'flex';
            container.style.gap = '40px';
            container.style.padding = '40px';
            container.style.background = '#000';

            document.body.appendChild(container);

            // Helper to clone with styles and sanitize (Fixes 'lab' color error)
            const cloneSide = (ref: HTMLDivElement, isBack: boolean = false) => {
                const clone = ref.cloneNode(true) as HTMLElement;
                clone.style.transform = 'none';
                clone.style.width = '520px';
                clone.style.height = '328px';
                clone.style.position = 'relative';
                clone.style.borderRadius = '16px';
                clone.style.overflow = 'hidden';

                // Use solid HEX backgrounds to avoid gradient parsing errors
                clone.style.background = isBack ? '#111827' : '#1f2937';

                const recursiveSanitize = (node: HTMLElement) => {
                    if (!(node instanceof HTMLElement)) return;

                    // Remove problematic classes that trigger 'lab' colors
                    node.classList.remove('backdrop-blur-xl', 'text-transparent', 'bg-clip-text', 'bg-gradient-to-r', 'bg-gradient-to-br', 'bg-gradient-to-bl');

                    const s = node.style;
                    const c = node.className;

                    if (typeof c === 'string') {
                        // Hide complex effects
                        if (c.includes('blur-') || c.includes('opacity-20')) {
                            s.display = 'none';
                        }

                        // Flatten attributes
                        s.boxShadow = 'none';
                        s.filter = 'none';
                        s.backdropFilter = 'none';

                        // Force simple HEX colors for text
                        if (c.includes('text-white')) s.color = '#ffffff';
                        else if (c.includes('text-gray-300')) s.color = '#d1d5db';
                        else if (c.includes('text-gray-400')) s.color = '#9ca3af';
                        else if (c.includes('text-orange')) s.color = '#fb923c';

                        // Force simple HEX colors for backgrounds/borders
                        if (c.includes('bg-white')) s.backgroundColor = '#ffffff';
                        if (c.includes('bg-black')) s.backgroundColor = '#000000';
                        if (c.includes('border-white')) s.borderColor = '#444444';

                        // Specific fix for "AKR Number" gradient text
                        if (c.includes('from-orange')) {
                            s.background = 'none';
                            s.color = '#f97316'; // Solid Orange Fallback
                        }
                    }

                    Array.from(node.children).forEach(child => recursiveSanitize(child as HTMLElement));
                };

                recursiveSanitize(clone);
                return clone;
            };

            container.appendChild(cloneSide(frontRef.current, false));
            container.appendChild(cloneSide(backRef.current, true));

            const canvas = await html2canvas(container, {
                scale: 2,
                backgroundColor: '#000000', // Strict Hex
                useCORS: true,
                logging: false, // Turn off logging to reduce console noise
                allowTaint: true, // Sometimes helps with images
            });

            document.body.removeChild(container);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('landscape', 'mm', 'a4');

            pdf.setFillColor(0, 0, 0);
            pdf.rect(0, 0, 297, 210, 'F');

            pdf.setFontSize(18);
            pdf.setTextColor(255, 255, 255);
            pdf.text('AKR Membership Card', 10, 15);

            pdf.addImage(imgData, 'PNG', 10, 25, 277, 160);
            pdf.save(`${customerName.replace(/\s+/g, '_')}_AKR_Card.pdf`);

            toast.dismiss();
            toast.success('PDF downloaded!');
        } catch (err) {
            console.error(err);
            toast.dismiss();
            toast.error('PDF failed');
        }
    };

    return (
        <div
            onClick={handleFlip}
            className="[perspective:1000px] w-full max-w-[520px] aspect-[1.586/1] mx-auto cursor-pointer group relative"
        >
            <div
                className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''
                    }`}
            >
                {/* FRONT */}
                <div
                    ref={frontRef}
                    className="absolute inset-0 aspect-[1.586/1] rounded-2xl overflow-hidden border border-white/20 shadow-2xl backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 [backface-visibility:hidden]"
                >
                    <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/30 blur-3xl rounded-full" />
                    <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-orange-500/30 blur-3xl rounded-full" />

                    <div className="relative z-10 p-6 flex flex-col h-full">
                        <p className="text-xs tracking-[0.3em] text-gray-300 uppercase mb-4">
                            Membership Card
                        </p>

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg p-1">
                                    <img
                                        src="/akrhunger.png"
                                        alt="AKR"
                                        className="w-full h-full object-contain drop-shadow-md"
                                    />
                                </div>
                                <span className="text-2xl font-black text-white tracking-widest italic drop-shadow-md">
                                    AKR Hunger
                                </span>
                            </div>

                            <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/20 shadow-inner bg-black/20">
                                {userImage ? (
                                    <img
                                        src={userImage}
                                        alt="User"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gray-600 animate-pulse" />
                                )}
                            </div>
                        </div>

                        <div className="mt-auto mb-4">
                            <p className="font-mono text-xl md:text-4xl tracking-[0.15em] text-white leading-none truncate drop-shadow-xl">
                                {cardNumber.match(/.{1,5}/g)?.join(' ') || cardNumber}
                            </p>
                        </div>

                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-xs text-orange-200 uppercase font-semibold">Card Holder</p>
                                <p className="text-lg md:text-xl font-bold text-white uppercase truncate drop-shadow-md">
                                    {customerName}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-orange-200 uppercase font-semibold">Valid Thru</p>
                                <p className="text-lg md:text-xl font-bold text-white drop-shadow-md">
                                    {expiryDate}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BACK */}
                <div
                    ref={backRef}
                    className="absolute inset-0 aspect-[1.586/1] rounded-2xl overflow-hidden border border-white/20 shadow-2xl backdrop-blur-xl bg-gradient-to-bl from-gray-900 to-black [transform:rotateY(180deg)] [backface-visibility:hidden]"
                >
                    <div className="p-6 h-full flex flex-col bg-black/50">
                        <div className="h-10 bg-black/80 mb-4 w-[calc(100%+3rem)] -mx-6" />

                        <div className="flex justify-between items-center px-1">
                            <span className="text-xs text-gray-400 italic">
                                Authorized Signature
                            </span>
                            <span className="bg-white text-black text-xs font-mono px-2 py-1 rounded shadow-lg transform -skew-x-12">
                                CVV: {akrNumber.slice(0, 3)}
                            </span>
                        </div>

                        <div className="mt-auto flex justify-between items-end">
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
                                    AKR ID
                                </p>
                                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 tracking-[0.2em] drop-shadow-sm">
                                    {akrNumber}
                                </p>
                            </div>

                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                                    `Name: ${customerName}\nCard No: ${cardNumber}\nExpiry: ${expiryDate}\nAKR ID: ${akrNumber}`
                                )}`}
                                alt="QR"
                                className="w-16 h-16 rounded-lg bg-white p-1 shadow-lg opacity-90"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTIONS */}
            <div className="absolute -bottom-16 left-0 right-0 flex justify-center gap-4 group-hover:opacity-100 transition-opacity duration-300 opacity-100">
                <Button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleFlip();
                    }}
                    variant="outline"
                    className="rounded-full bg-gray-950/90 text-white border-white/20 hover:bg-gray-900 hover:text-orange-400 hover:border-orange-500/50 backdrop-blur-md shadow-lg transition-all"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Flip Card
                </Button>
                <Button
                    onClick={handleDownload}
                    className="rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg hover:shadow-orange-500/20 border-0"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                </Button>
            </div>
        </div>
    );
};

export default MembershipCard;