'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Truck, Bike, Car, Upload, FileText, ArrowRight } from 'lucide-react';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { auth, db } from '@/lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';

export default function DeliveryRegisterPage() {
    const router = useRouter();
    const { register } = useDeliveryAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        vehicle: 'bike',
        vehicleNumber: '',
    });

    const [files, setFiles] = useState<{ vehicleImage: File | null; drivingLicense: File | null }>({
        vehicleImage: null,
        drivingLicense: null
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'vehicleImage' | 'drivingLicense') => {
        if (e.target.files && e.target.files[0]) {
            setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
        }
    };

    const handleSelectChange = (value: string) => {
        setFormData(prev => ({ ...prev, vehicle: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password should be at least 6 characters');
            return;
        }

        if (!files.vehicleImage || !files.drivingLicense) {
            setError('Please upload documents for Vehicle RC and Driving License');
            return;
        }

        setLoading(true);

        try {
            // 1. Register User FIRST
            await register({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                vehicle: formData.vehicle,
                vehicleNumber: formData.vehicleNumber,
                vehicleImage: '',
                drivingLicense: '',
                verificationStatus: 'pending'
            }, formData.password);

            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error('Registration successful but auth session missing.');

            // 2. Upload files
            const vehicleImageUrl = await uploadToCloudinary(files.vehicleImage);
            const licenseUrl = await uploadToCloudinary(files.drivingLicense);

            // 3. Update Firestore
            await updateDoc(doc(db, 'deliveryPersons', currentUser.uid), {
                vehicleImage: vehicleImageUrl,
                drivingLicense: licenseUrl
            });

            router.push('/delivery/login?registered=true');
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black p-4 py-8">
            <Card className="w-full max-w-lg border-gray-800 bg-gray-900/50 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center space-y-2">
                    <div className="flex justify-center mb-2">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                            <Package className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white tracking-tight">Become a Delivery Partner</CardTitle>
                    <CardDescription className="text-gray-400">Join our elite fleet and start earning today</CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center justify-center text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Full Name</label>
                            <Input
                                name="name"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                disabled={loading}
                                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Email Address</label>
                            <Input
                                name="email"
                                type="email"
                                placeholder="john@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                disabled={loading}
                                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Phone Number</label>
                            <Input
                                name="phone"
                                type="tel"
                                placeholder="+1 234 567 8900"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                disabled={loading}
                                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Vehicle Type</label>
                                <Select
                                    value={formData.vehicle}
                                    onValueChange={handleSelectChange}
                                    disabled={loading}
                                >
                                    <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                                        <SelectValue placeholder="Select vehicle" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border-gray-800 text-white">
                                        <SelectItem value="bike" className="focus:bg-gray-800 focus:text-white">
                                            <div className="flex items-center gap-2">
                                                <Bike className="w-4 h-4" /> Bike
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="car" className="focus:bg-gray-800 focus:text-white">
                                            <div className="flex items-center gap-2">
                                                <Car className="w-4 h-4" /> Car
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="truck" className="focus:bg-gray-800 focus:text-white">
                                            <div className="flex items-center gap-2">
                                                <Truck className="w-4 h-4" /> Truck
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Vehicle Number</label>
                                <Input
                                    name="vehicleNumber"
                                    placeholder="ABC-1234"
                                    value={formData.vehicleNumber}
                                    onChange={handleChange}
                                    required
                                    disabled={loading}
                                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="bg-gray-800/30 p-4 rounded-xl space-y-4 border border-blue-500/10">
                            <h4 className="font-semibold text-sm flex items-center gap-2 text-blue-400">
                                <FileText className="w-4 h-4" /> Required Documents (Image or PDF)
                            </h4>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400">RC Document (Registration Certificate)</label>
                                <Input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => handleFileChange(e, 'vehicleImage')}
                                    disabled={loading}
                                    className="cursor-pointer bg-gray-900/50 border-gray-700 text-gray-300 file:border-0 file:bg-blue-600 file:text-white file:text-xs file:font-medium file:mr-4 file:px-2 file:py-1 file:rounded-md hover:file:bg-blue-700"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400">Driving License</label>
                                <Input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => handleFileChange(e, 'drivingLicense')}
                                    disabled={loading}
                                    className="cursor-pointer bg-gray-900/50 border-gray-700 text-gray-300 file:border-0 file:bg-blue-600 file:text-white file:text-xs file:font-medium file:mr-4 file:px-2 file:py-1 file:rounded-md hover:file:bg-blue-700"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Password</label>
                            <Input
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                disabled={loading}
                                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Confirm Password</label>
                            <Input
                                name="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                disabled={loading}
                                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 transition-all"
                            />
                        </div>

                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] mt-4" disabled={loading}>
                            {loading ? 'Submitting Application...' : 'Submit Application'} <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </form>

                    <p className="text-center text-sm text-gray-500 mt-6">
                        Already have an account?{' '}
                        <Link href="/delivery/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                            Sign In
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
