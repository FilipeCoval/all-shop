import React from 'react';
import { ArrowRight, Star, Truck, ShieldCheck } from 'lucide-react';
import ProductList from './ProductList';
import { Product } from '../types';

interface HomeProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

const Home: React.FC<HomeProps> = ({ products, onAddToCart }) => {
  const handleNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = path;
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-secondary text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20"></div>
        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="inline-block bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-full px-4 py-1 text-sm font-semibold text-blue-300 mb-4">
              🚀 Novas ofertas chegaram
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
              Tecnologia do <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                Futuro Hoje
              </span>
            </h1>
            <p className="text-gray-300 text-lg md:text-xl max-w-lg mx-auto md:mx-0">
              Descubra os eletrônicos mais desejados com preços imbatíveis e entrega expressa para todo Portugal.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <a 
                href="#/"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded-full font-bold transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                Ver Ofertas
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#about" onClick={handleNav('about')} className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white px-8 py-3 rounded-full font-medium transition-all text-center">
                Saiba Mais
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="bg-blue-100 p-3 rounded-full text-primary">
                      <Star fill="currentColor" size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900">Qualidade Garantida</h3>
                      <p className="text-sm text-gray-500">Produtos originais com garantia</p>
                  </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="bg-green-100 p-3 rounded-full text-green-600">
                      <Truck size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900">Portes Grátis</h3>
                      <p className="text-sm text-gray-500">Oferta em todas as encomendas</p>
                  </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                      <ShieldCheck size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900">Compra Segura</h3>
                      <p className="text-sm text-gray-500">Os seus dados protegidos</p>
                  </div>
              </div>
          </div>
      </section>

      <ProductList products={products} onAddToCart={onAddToCart} />

      {/* Newsletter */}
      <section className="bg-secondary text-white py-16">
          <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl font-bold mb-6">Fique a par das novidades</h2>
              <p className="text-gray-300 mb-8 max-w-xl mx-auto">
                  Inscreva-se para receber ofertas exclusivas e descontos em primeira mão.
              </p>
              <form className="max-w-md mx-auto flex gap-2" onSubmit={(e) => e.preventDefault()}>
                  <input 
                      type="email" 
                      placeholder="O seu melhor e-mail" 
                      className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button type="submit" className="bg-primary hover:bg-blue-600 px-6 py-3 rounded-lg font-bold transition-colors">
                      Assinar
                  </button>
              </form>
          </div>
      </section>
    </>
  );
};

export default Home;