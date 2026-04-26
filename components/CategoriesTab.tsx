import React, { useState } from 'react';
import { db, storage } from '../services/firebaseConfig';
import { Category } from '../types';
import { Plus, Trash2, Save, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { useStoreCategories } from '../hooks/useStoreCategories';

export default function CategoriesTab() {
  const { categories, loading } = useStoreCategories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Category>>({ name: '', image: '', order: 0 });
  const [isUploading, setIsUploading] = useState(false);

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id || null);
    setFormData({ name: cat.name, image: cat.image, order: cat.order || 0 });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsUploading(true);
      try {
          const storageRef = storage.ref(`categories/${Date.now()}_${file.name}`);
          const uploadTask = await storageRef.put(file);
          const downloadUrl = await uploadTask.ref.getDownloadURL();
          setFormData(prev => ({ ...prev, image: downloadUrl }));
      } catch (error) {
          console.error("Error uploading logo", error);
          alert('Erro ao fazer upload da imagem.');
      } finally {
          setIsUploading(false);
          e.target.value = ''; // Reset input
      }
  };

  const handleAddNew = () => {
    setEditingId('new');
    setFormData({ name: '', image: '', order: categories.length });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: '', image: '', order: 0 });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.image) {
      alert('Nome e Imagem são obrigatórios.');
      return;
    }
    
    try {
      if (editingId && editingId !== 'new') {
        await db.collection('store_categories').doc(editingId).update(formData);
      } else {
        await db.collection('store_categories').add(formData);
      }
      setEditingId(null);
    } catch (error) {
      console.error(error);
      alert('Erro ao guardar categoria');
    }
  };

  const handleDelete = async (id: string) => {
    if(confirm('Tem a certeza que deseja eliminar esta categoria?')) {
        await db.collection('store_categories').doc(id).delete();
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">A carregar categorias...</div>;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Categorias da Loja</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Gira as categorias que aparecem no menu principal da loja.</p>
        </div>
        <button onClick={handleAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
          <Plus size={18} /> Adicionar Categoria
        </button>
      </div>

      <div className="space-y-4">
        {categories.map(cat => (
          editingId === cat.id ? (
             <div key={cat.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-slate-700/50 p-4 rounded-xl border border-gray-200 dark:border-slate-600 items-start">
               <div className="md:col-span-1">
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                 <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white" />
               </div>
               <div className="md:col-span-2">
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL da Imagem</label>
                 <div className="flex gap-2">
                     <input type="text" value={formData.image || ''} placeholder="https://..." onChange={e => setFormData({...formData, image: e.target.value})} className="flex-1 p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white" />
                     <label className={`flex items-center justify-center p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                         {isUploading ? <Loader2 size={20} className="animate-spin text-gray-500" /> : <Upload size={20} className="text-gray-500" />}
                         <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                     </label>
                 </div>
               </div>
               <div className="flex justify-end items-end gap-2 md:col-span-1 h-full pb-1">
                 <button onClick={handleCancel} className="px-3 py-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg">Cancelar</button>
                 <button onClick={handleSave} className="bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-2"><Save size={16}/> Gravar</button>
               </div>
             </div>
          ) : (
            <div key={cat.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                 <div className="w-16 h-16 rounded-full border-2 border-gray-100 overflow-hidden shrink-0">
                    <img src={cat.image} className="w-full h-full object-cover" />
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{cat.name}</h3>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(cat)} className="text-gray-400 hover:text-indigo-600 p-2">Editar</button>
                <button onClick={() => cat.id && handleDelete(cat.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18} /></button>
              </div>
            </div>
          )
        ))}

        {editingId === 'new' && (
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30 items-start">
             <div className="md:col-span-1">
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
               <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white" />
             </div>
             <div className="md:col-span-2">
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL da Imagem</label>
               <div className="flex gap-2">
                   <input type="text" value={formData.image || ''} placeholder="https://..." onChange={e => setFormData({...formData, image: e.target.value})} className="flex-1 p-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white" />
                   <label className={`flex items-center justify-center p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                       {isUploading ? <Loader2 size={20} className="animate-spin text-gray-500" /> : <Upload size={20} className="text-gray-500" />}
                       <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                   </label>
               </div>
             </div>
             <div className="flex justify-end items-end gap-2 md:col-span-1 h-full pb-1">
               <button onClick={handleCancel} className="px-3 py-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg">Cancelar</button>
               <button onClick={handleSave} className="bg-indigo-600 text-white px-3 py-2 rounded-lg flex items-center gap-2"><Save size={16}/> Adicionar</button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
