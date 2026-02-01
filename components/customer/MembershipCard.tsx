'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { IndianRupee } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface MembershipCardProps {
    balance: number;
    userName?: string;
    membershipId?: string;
    memberSince?: Date;
    className?: string; // Allow custom styling/positioning
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
            className={`relative overflow-hidden rounded-2xl p-6 aspect-[1.586/1] flex flex-col justify-between shadow-2xl group cursor-pointer ${className}`}
            style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}
        >
            {/* Decorative Elements */}
            <div className="absolute top-[-50%] left-[-50%] w-[100%] h-[100%] bg-orange-500/20 blur-[80px] rounded-full group-hover:bg-orange-500/30 transition-all duration-700" />
            <div className="absolute bottom-[-50%] right-[-50%] w-[100%] h-[100%] bg-blue-500/20 blur-[80px] rounded-full group-hover:bg-blue-500/30 transition-all duration-700" />

            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg tracking-wider text-white">AKR<span className="text-orange-500">PREMIUM</span></h3>
                    <span className="text-xs text-gray-300 uppercase tracking-widest">Membership Card</span>
                </div>
                <IndianRupee className="w-8 h-8 text-white/80" />
            </div>

            <div className="relative z-10">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Balance</div>
                <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-200">
                    ₹{balance.toFixed(2)}
                </div>
            </div>

            <div className="relative z-10 flex justify-between items-end">
                <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Card Holder</div>
                    <div className="font-medium tracking-wide uppercase text-white">{userName || 'Valued Customer'}</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Member Since</div>
                    <div className="font-medium tracking-wide text-white">
                        {memberSince ? new Date(memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '2024'}
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase mt-1">ID: {membershipId || 'N/A'}</div>
                </div>
            </div>
        </motion.div>
    );
}