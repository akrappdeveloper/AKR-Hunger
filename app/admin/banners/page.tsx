'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Image, Plus, Trash2, Edit2, Loader2, Eye, EyeOff,
  GripVertical, Link, ToggleLeft, ToggleRight, CheckCircle2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  linkType: 'restaurant' | 'category' | 'deal' | 'external' | 'none';
  linkTarget?: string;
  isActive: boolean;
  position: number;
  bgGradient?: string;
  textColor?: string;
  createdAt: any;
  displayPages: string[];
}

const LINK_TYPES = [
  { value: 'none', label: 'No Link' },
  { value: 'restaurant', label: 'Restaurant Page' },
  { value: 'category', label: 'Category Filter' },
  { value: 'deal', label: 'Deal/Promo' },
  { value: 'external', label: 'External URL' },
];

const DISPLAY_PAGES = [
  { value: 'customer_home', label: 'Customer Home' },
  { value: 'customer_deals', label: 'Customer Deals' },
  { value: 'customer_search', label: 'Customer Search' },
];

const emptyForm = {
  title: '',
  subtitle: '',
  imageUrl: '',
  linkUrl: '',
  linkType: 'none' as const,
  linkTarget: '',
  isActive: true,
  bgGradient: 'from-orange-500 to-amber-600',
  textColor: 'white',
  displayPages: ['customer_home'],
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'banners'), orderBy('position', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm, position: banners.length }); setDialogOpen(true); };
  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({
      title: b.title,
      subtitle: b.subtitle || '',
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl || '',
      linkType: b.linkType,
      linkTarget: b.linkTarget || '',
      isActive: b.isActive,
      bgGradient: b.bgGradient || 'from-orange-500 to-amber-600',
      textColor: b.textColor || 'white',
      displayPages: b.displayPages || ['customer_home'],
      position: b.position,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.imageUrl) { toast.error('Title and image URL are required'); return; }
    setSaving(true);
    try {
      const data = {
        title: form.title,
        subtitle: form.subtitle,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl,
        linkType: form.linkType,
        linkTarget: form.linkTarget,
        isActive: form.isActive,
        bgGradient: form.bgGradient,
        textColor: form.textColor,
        displayPages: form.displayPages,
        position: form.position || 0,
        updatedAt: serverTimestamp(),
      };
      if (editing) {
        await updateDoc(doc(db, 'banners', editing.id), data);
        toast.success('Banner updated');
      } else {
        await addDoc(collection(db, 'banners'), { ...data, createdAt: serverTimestamp() });
        toast.success('Banner created!');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const toggleBanner = async (b: Banner) => {
    setTogglingId(b.id);
    try {
      await updateDoc(doc(db, 'banners', b.id), { isActive: !b.isActive });
      toast.success(b.isActive ? 'Banner hidden' : 'Banner activated');
    } catch {
      toast.error('Failed to update');
    } finally {
      setTogglingId(null);
    }
  };

  const deleteBanner = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'banners', id));
      toast.success('Banner deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const togglePage = (page: string) => {
    setForm((f: any) => ({
      ...f,
      displayPages: f.displayPages.includes(page) ? f.displayPages.filter((p: string) => p !== page) : [...f.displayPages, page],
    }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Image className="w-6 h-6 text-rose-500" /> Banner Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage homepage banners and promotional images</p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-2xl gap-2">
          <Plus className="w-4 h-4" /> New Banner
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-black text-blue-600">{banners.length}</p>
          <p className="text-xs text-muted-foreground">Total Banners</p>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-black text-emerald-600">{banners.filter(b => b.isActive).length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-black text-gray-400">{banners.filter(b => !b.isActive).length}</p>
          <p className="text-xs text-muted-foreground">Hidden</p>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      ) : banners.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-12 text-center">
            <div className="text-5xl mb-3">🖼️</div>
            <p className="text-muted-foreground mb-4">No banners yet. Create your first banner!</p>
            <Button onClick={openAdd} className="bg-rose-500 text-white rounded-xl">Create Banner</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {banners.map((banner, i) => (
              <motion.div key={banner.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className={`rounded-2xl border-0 shadow-md overflow-hidden ${!banner.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex">
                    {/* Banner Preview */}
                    <div className={`w-32 h-24 bg-gradient-to-br ${banner.bgGradient || 'from-orange-500 to-amber-600'} flex flex-col items-center justify-center p-2 flex-shrink-0`}>
                      {banner.imageUrl ? (
                        <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        <span className="text-3xl">🖼️</span>
                      )}
                    </div>
                    {/* Content */}
                    <CardContent className="p-4 flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold truncate">{banner.title}</span>
                            <Badge className={banner.isActive ? 'bg-emerald-100 text-emerald-700 border-0 text-xs' : 'bg-gray-100 text-gray-600 border-0 text-xs'}>
                              {banner.isActive ? 'Active' : 'Hidden'}
                            </Badge>
                          </div>
                          {banner.subtitle && <p className="text-xs text-muted-foreground truncate mb-1">{banner.subtitle}</p>}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span>Position: #{banner.position + 1}</span>
                            <span>Link: {banner.linkType}</span>
                            {banner.displayPages?.map(p => (
                              <Badge key={p} variant="outline" className="text-xs px-1.5 py-0">{p.replace('_', ' ')}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(banner)} className="rounded-xl text-xs gap-1">
                            <Edit2 className="w-3 h-3" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleBanner(banner)}
                            disabled={togglingId === banner.id}
                            className={`rounded-xl text-xs gap-1 ${banner.isActive ? 'text-gray-600' : 'text-emerald-600'}`}
                          >
                            {togglingId === banner.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (banner.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />)}
                            {banner.isActive ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteBanner(banner.id)}
                            disabled={deletingId === banner.id}
                            className="rounded-xl text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            {deletingId === banner.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Banner' : '🖼️ Create New Banner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <Label>Banner Title *</Label>
              <Input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} className="mt-1 rounded-xl" placeholder="e.g. 50% Off Weekend Special!" />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input value={form.subtitle} onChange={e => setForm((f: any) => ({ ...f, subtitle: e.target.value }))} className="mt-1 rounded-xl" placeholder="Supporting text..." />
            </div>
            <div>
              <Label>Image URL *</Label>
              <Input value={form.imageUrl} onChange={e => setForm((f: any) => ({ ...f, imageUrl: e.target.value }))} className="mt-1 rounded-xl" placeholder="https://your-banner-image.jpg" />
            </div>
            <div>
              <Label>Background Gradient (Tailwind classes)</Label>
              <Input value={form.bgGradient} onChange={e => setForm((f: any) => ({ ...f, bgGradient: e.target.value }))} className="mt-1 rounded-xl font-mono text-xs" />
            </div>
            <div>
              <Label>Link Type</Label>
              <select
                value={form.linkType}
                onChange={e => setForm((f: any) => ({ ...f, linkType: e.target.value }))}
                className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-3 text-sm"
              >
                {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {form.linkType !== 'none' && (
              <div>
                <Label>Link Target / URL</Label>
                <Input value={form.linkTarget} onChange={e => setForm((f: any) => ({ ...f, linkTarget: e.target.value }))} className="mt-1 rounded-xl" placeholder={form.linkType === 'external' ? 'https://...' : 'ID or value'} />
              </div>
            )}
            <div>
              <Label>Display Position</Label>
              <Input type="number" min={0} value={form.position} onChange={e => setForm((f: any) => ({ ...f, position: parseInt(e.target.value) }))} className="mt-1 rounded-xl w-24" />
            </div>
            <div>
              <Label>Show on Pages</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DISPLAY_PAGES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => togglePage(p.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${
                      form.displayPages?.includes(p.value) ? 'bg-rose-500 text-white border-rose-500' : 'border-border'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={form.isActive} onCheckedChange={v => setForm((f: any) => ({ ...f, isActive: v }))} />
              <span className="text-sm font-medium">Active (visible to users)</span>
            </label>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editing ? 'Update' : 'Create Banner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
