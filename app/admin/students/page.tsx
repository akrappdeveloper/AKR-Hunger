'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  GraduationCap, School, CheckCircle2, XCircle, Clock, Search,
  Filter, ShieldCheck, Tag, Award, Users, RefreshCw, FileText
} from 'lucide-react';

interface StudentApplicant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  collegeName: string;
  studentIdNumber: string;
  idCardUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: any;
  verifiedAt?: any;
  discountCode?: string;
  rejectionReason?: string;
}

export default function StudentVerificationsAdminPage() {
  const [students, setStudents] = useState<StudentApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentApplicant | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Listen to customers with student verification records
    const q = query(collection(db, 'customers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: StudentApplicant[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.studentVerification) {
          const sv = data.studentVerification;
          list.push({
            id: d.id,
            name: data.name || sv.fullName || 'Student',
            email: data.email || sv.collegeEmail || 'No email',
            phone: data.phone || sv.phone || '',
            collegeName: sv.collegeName || 'Unknown College',
            studentIdNumber: sv.studentIdNumber || sv.rollNo || 'N/A',
            idCardUrl: sv.idCardUrl || '',
            status: sv.status || (sv.verified ? 'approved' : 'pending'),
            submittedAt: sv.submittedAt?.toDate?.() || new Date(),
            verifiedAt: sv.verifiedAt?.toDate?.() || null,
            discountCode: sv.discountCode || 'STUDENT15',
            rejectionReason: sv.rejectionReason || '',
          });
        }
      });
      setStudents(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching student verifications:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (student: StudentApplicant) => {
    setActionLoading(true);
    try {
      const code = `STUDENT15`;
      // Update customer record
      await updateDoc(doc(db, 'customers', student.id), {
        'studentVerification.status': 'approved',
        'studentVerification.verified': true,
        'studentVerification.verifiedAt': Timestamp.now(),
        'studentVerification.discountCode': code,
        isStudentVerified: true,
      });

      // Ensure STUDENT15 promo exists in promotions collection
      await setDoc(doc(db, 'promotions', 'STUDENT15'), {
        code: 'STUDENT15',
        title: 'Student Special 15% OFF',
        discountType: 'percentage',
        discountAmount: 15,
        minOrderAmount: 99,
        maxDiscount: 100,
        active: true,
        description: 'Exclusive 15% discount for verified university and college students',
        createdAt: Timestamp.now(),
      }, { merge: true });

      toast.success(`Approved verification for ${student.name}! Code ${code} active.`);
    } catch (err: any) {
      toast.error('Failed to approve student: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedStudent) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'customers', selectedStudent.id), {
        'studentVerification.status': 'rejected',
        'studentVerification.verified': false,
        'studentVerification.rejectionReason': rejectReason || 'Provided ID did not match university verification criteria.',
        'studentVerification.rejectedAt': Timestamp.now(),
        isStudentVerified: false,
      });

      toast.success(`Verification rejected for ${selectedStudent.name}.`);
      setRejectModalOpen(false);
      setRejectReason('');
      setSelectedStudent(null);
    } catch (err: any) {
      toast.error('Failed to reject verification: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.collegeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentIdNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = students.filter(s => s.status === 'pending').length;
  const approvedCount = students.filter(s => s.status === 'approved').length;
  const rejectedCount = students.filter(s => s.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-primary" />
            Student Verifications &amp; Campus Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review college student ID credentials, grant exclusive campus discounts, and monitor student memberships.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Total Applicants
              <Users className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{students.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all colleges</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center justify-between">
              Pending Review
              <Clock className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-500">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting ID card review</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center justify-between">
              Verified Students
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-500">{approvedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Eligible for STUDENT15 discount</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center justify-between">
              Rejected
              <XCircle className="w-4 h-4 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-500">{rejectedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Invalid ID credentials</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-border/60 bg-card/40 backdrop-blur-md">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search student, college, roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl bg-background/50 border-border/60"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={statusFilter === tab ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(tab)}
                  className="capitalize rounded-xl text-xs font-bold"
                >
                  {tab}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/60">
                <TableHead className="font-bold">Student Name</TableHead>
                <TableHead className="font-bold">College / University</TableHead>
                <TableHead className="font-bold">Student ID No</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold">Date</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading student verification records...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No student verifications found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id} className="border-border/40 hover:bg-muted/20">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <School className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="font-medium text-foreground">{s.collegeName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {s.studentIdNumber}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.status === 'approved' && (
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </Badge>
                      )}
                      {s.status === 'pending' && (
                        <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 gap-1 font-semibold">
                          <Clock className="w-3 h-3" /> Pending Review
                        </Badge>
                      )}
                      {s.status === 'rejected' && (
                        <Badge className="bg-red-500/15 text-red-500 border-red-500/30 gap-1 font-semibold">
                          <XCircle className="w-3 h-3" /> Rejected
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.submittedAt?.toLocaleDateString?.() || 'Recent'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {s.status !== 'approved' && (
                          <Button
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => handleApprove(s)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 text-xs font-bold gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </Button>
                        )}
                        {s.status !== 'rejected' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actionLoading}
                            onClick={() => {
                              setSelectedStudent(s);
                              setRejectModalOpen(true);
                            }}
                            className="rounded-xl h-8 text-xs font-bold gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Reject Reason Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="rounded-2xl max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Reject Student Verification</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide feedback for {selectedStudent?.name}. The student will be notified and can re-submit with correct proof.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="e.g. ID card expired, roll number mismatch..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectModalOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading} className="rounded-xl font-bold">
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
