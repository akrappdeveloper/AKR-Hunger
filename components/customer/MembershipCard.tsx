'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { IndianRupee } from 'lucide-react';

interface MembershipCardProps {
    balance: number;
    userName?: string;
    membershipId?: string;
    memberSince?: Date;
    className?: string;
}

export default function MembershipCard({
    balance,
    userName,
    membershipId,
    memberSince,
    className = ""
}: MembershipCardProps) {

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-3xl p-6 aspect-[1.586/1] flex flex-col justify-between shadow-2xl group cursor-pointer bg-gradient-to-br from-neutral-950 via-zinc-900 to-neutral-900 text-white border border-white/15 ${className}`}
        >
            {/* Decorative Ambient Accents */}
            <div className="absolute top-[-40%] left-[-40%] w-[80%] h-[80%] bg-primary/25 blur-[70px] rounded-full group-hover:bg-primary/35 transition-all duration-700 pointer-events-none" />
            <div className="absolute bottom-[-40%] right-[-40%] w-[80%] h-[80%] bg-amber-500/20 blur-[70px] rounded-full group-hover:bg-amber-500/30 transition-all duration-700 pointer-events-none" />

            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <h3 className="font-black text-lg tracking-wider text-white flex items-center gap-1.5">
                        <span className="text-primary font-extrabold">HUNGER</span> PREMIUM
                    </h3>
                    <span className="text-[11px] text-zinc-300 font-semibold uppercase tracking-widest">VIP Membership Pass</span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/15 shadow-sm text-primary">
                    <IndianRupee className="w-5 h-5" />
                </div>
            </div>

            <div className="relative z-10">
                <div className="text-[11px] text-zinc-300 font-bold uppercase tracking-wider mb-1">Current Balance</div>
                <div className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-sm">
                    ₹{balance.toFixed(2)}
                </div>
            </div>

            <div className="relative z-10 flex justify-between items-end">
                <div>
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Card Holder</div>
                    <div className="font-bold tracking-wide uppercase text-sm text-white">{userName || 'Valued Customer'}</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Member Since</div>
                    <div className="font-bold tracking-wide text-xs text-white">
                        {memberSince ? new Date(memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '2024'}
                    </div>
                    <div className="text-[9px] text-zinc-400 font-mono uppercase mt-0.5">ID: {membershipId || 'N/A'}</div>
                </div>
            </div>
        </motion.div>
    );
}