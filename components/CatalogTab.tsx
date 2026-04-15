import React, { useState } from 'react';
import { Product } from '../types';
import { Search, Edit2, Trash2, Plus, Globe, Image as ImageIcon } from 'lucide-react';

interface CatalogTabProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onAddNew: () => void;
  onDelete: (id: number) => void;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const CatalogTab: React.FC<CatalogTabProps> = ({ products, onEdit, onAddNew, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 gap-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Globe className="text-indigo-600 dark:text-indigo-400" /> Catálogo da Loja Online
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="Pesquisar produto..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
          </div>
          <button onClick={onAddNew} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 font-bold text-sm whitespace-nowrap">
            <Plus size={18} /> Novo Produto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col group transition-all hover:shadow-md">
            <div className="relative aspect-square bg-gray-100 dark:bg-slate-900">
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon size={48} />
                </div>
              )}
              <div className="absolute top-2 right-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-gray-900 dark:text-white shadow-sm">
                {formatCurrency(product.price)}
              </div>
              {product.comingSoon && (
                <div className="absolute top-2 left-2 bg-purple-600 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                  Em Breve
                </div>
              )}
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{product.category}</div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 line-clamp-2">{product.name}</h3>
              
              <div className="mt-auto pt-4 flex gap-2">
                <button 
                  onClick={() => onEdit(product)} 
                  className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 size={16} /> Editar Layout
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm('Tem a certeza que deseja apagar este produto do catálogo público? O stock físico não será afetado.')) {
                      onDelete(product.id);
                    }
                  }} 
                  className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
            Nenhum produto encontrado no catálogo.
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogTab;
