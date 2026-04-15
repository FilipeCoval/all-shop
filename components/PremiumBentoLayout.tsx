import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { ShoppingCart, Cpu, Wifi, Play, Star } from 'lucide-react';

interface PremiumBentoLayoutProps {
  product: Product;
  onBuyNow: () => void;
  currentPrice: number;
  isUnavailable: boolean;
}

const renderIcon = (type: string, size = 48, className = "") => {
  switch (type) {
    case 'cpu': return <Cpu size={size} className={className} />;
    case 'wifi': return <Wifi size={size} className={className} />;
    case 'play': return <Play size={size} className={className} />;
    case 'star': return <Star size={size} className={className} />;
    default: return null;
  }
};

const PremiumBentoLayout: React.FC<PremiumBentoLayoutProps> = ({ product, onBuyNow, currentPrice, isUnavailable }) => {
  const pData = product.premiumData || {};
  const blocks = pData.blocks || [];
  const heroContentRef = useRef(null);
  const isHeroContentInView = useInView(heroContentRef, { amount: 0 });
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    // Show sticky bar when hero content is NOT in view
    setShowStickyBar(!isHeroContentInView);
  }, [isHeroContentInView]);
  
  const heroAlignClass = pData.heroAlign === 'left' ? 'items-start text-left' : 
                        pData.heroAlign === 'right' ? 'items-end text-right' : 'items-center text-center';

  return (
    <div className="w-full bg-[#f5f5f7] dark:bg-black text-gray-900 dark:text-white min-h-screen font-sans pb-10">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex flex-col items-center justify-center overflow-hidden pt-16">
        <motion.div 
          ref={heroContentRef}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`z-10 px-4 w-full max-w-7xl mx-auto flex flex-col ${heroAlignClass}`}
          style={{ color: pData.heroTextColor || 'inherit' }}
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">{pData.heroTitle || product.name}</h1>
          <p className="text-xl md:text-2xl opacity-60 max-w-2xl mb-8">
            {pData.heroSubtitle || product.description?.substring(0, 100) + "..."}
          </p>
          {pData.showBuyButton !== false && (
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(currentPrice)}</span>
              <button 
                onClick={() => {
                  console.log("Hero Buy Button Clicked, isUnavailable:", isUnavailable);
                  onBuyNow();
                }}
                className="bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform cursor-pointer"
              >
                Comprar Agora
              </button>
            </div>
          )}
        </motion.div>
        
        {pData.heroImage ? (
          <div className="absolute inset-0 z-0 group">
            <motion.img 
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              src={pData.heroImage} 
              alt={product.name}
              className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-[2000ms]"
            />
            {/* Overlay to ensure text readability if needed, though user didn't ask, it's good practice. 
                Actually, I'll stick to what they asked. */}
          </div>
        ) : (
          <motion.img 
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
            src={product.image} 
            alt={product.name}
            className="absolute bottom-0 w-full max-w-4xl object-contain h-1/2 md:h-2/3 z-0"
            style={{ filter: 'drop-shadow(0px -20px 40px rgba(0,0,0,0.1))' }}
          />
        )}
      </section>

      {/* Bento Grid Section */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 grid-flow-row-dense">
          
          {blocks.length > 0 ? (
            blocks.map((block, idx) => {
              const isFull = block.type === 'full';
              const isRectangle = block.type === 'rectangle';
              const isTall = block.type === 'tall';
              
              const colSpan = (isFull || isRectangle) ? 'md:col-span-2' : '';
              const rowSpan = isTall ? 'md:row-span-2' : '';
              const height = isFull ? 'min-h-[600px]' : isTall ? 'min-h-[824px]' : 'min-h-[400px]';
              
              const hAlignClass = block.textAlign === 'left' ? 'items-start text-left' : 
                                 block.textAlign === 'right' ? 'items-end text-right' : 'items-center text-center';
              
              const vAlignClass = block.textVerticalAlign === 'top' ? 'justify-start' : 
                                 block.textVerticalAlign === 'bottom' ? 'justify-end' : 'justify-center';

              return (
                <motion.div 
                  key={block.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: idx * 0.1 }}
                  className={`${colSpan} ${rowSpan} ${height} bg-white dark:bg-[#111] rounded-[2.5rem] p-12 flex flex-col overflow-hidden relative group shadow-sm border border-gray-100 dark:border-gray-800 ${hAlignClass} ${vAlignClass}`}
                >
                  {block.image && (
                    <div className="absolute inset-0 z-0">
                      <img 
                        src={block.image} 
                        alt={block.title || "Feature"} 
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                      />
                    </div>
                  )}
                  <div className="z-10 relative flex flex-col max-w-xl" style={{ color: block.textColor || (block.image ? '#ffffff' : 'inherit') }}>
                    {block.showIcon && block.iconType && renderIcon(block.iconType, 48, "mb-6 opacity-90")}
                    {block.title && <h3 className={`${isFull ? 'text-4xl md:text-5xl' : 'text-3xl'} font-bold mb-4 tracking-tight`}>{block.title}</h3>}
                    {block.description && <p className={`${isFull ? 'text-xl' : 'text-lg'} opacity-80 leading-relaxed`}>{block.description}</p>}
                  </div>
                </motion.div>
              );
            })
          ) : (
            /* Fallback to old layout if no blocks exist (for backward compatibility) */
            <>
              {/* Bento Item 1: Large Feature */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className={`md:col-span-2 bg-white dark:bg-[#111] rounded-[2rem] p-10 flex flex-col overflow-hidden relative group shadow-sm border border-gray-100 dark:border-gray-800 ${
                  pData.box1Align === 'center' ? 'items-center text-center' : 
                  pData.box1Align === 'right' ? 'items-end text-right' : 'items-start text-left'
                } justify-end min-h-[400px]`}
              >
                <div className="absolute inset-0 z-0">
                  <img 
                    src={pData.box1Image || product.image} 
                    alt="Feature" 
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <div className="z-10 relative mt-auto" style={{ color: pData.box1TextColor || '#ffffff' }}>
                  {pData.box1Title && <h3 className="text-3xl font-bold mb-2">{pData.box1Title}</h3>}
                  {pData.box1Desc && <p className="text-lg max-w-md opacity-90">{pData.box1Desc}</p>}
                </div>
              </motion.div>

              {/* Bento Item 2: Small Feature */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: 0.1 }}
                className={`bg-white dark:bg-[#111] rounded-[2rem] p-10 flex flex-col overflow-hidden relative shadow-sm border border-gray-100 dark:border-gray-800 group ${
                  pData.box2Align === 'left' ? 'items-start text-left' : 
                  pData.box2Align === 'right' ? 'items-end text-right' : 'items-center text-center'
                } justify-center min-h-[400px]`}
              >
                {pData.box2Image && (
                  <div className="absolute inset-0 z-0">
                    <img src={pData.box2Image} alt="Feature" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                  </div>
                )}
                <div className="z-10 relative flex flex-col" style={{ color: pData.box2TextColor || (pData.box2Image ? '#ffffff' : 'inherit') }}>
                  {pData.box2ShowIcon !== false && <Cpu size={48} className={`mb-6 ${!pData.box2Image && !pData.box2TextColor ? 'text-blue-500' : ''}`} />}
                  {pData.box2Title && <h3 className="text-2xl font-bold mb-2">{pData.box2Title}</h3>}
                  {pData.box2Desc && <p className="opacity-80">{pData.box2Desc}</p>}
                </div>
              </motion.div>

              {/* Bento Item 3: Small Feature */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className={`bg-white dark:bg-[#111] rounded-[2rem] p-10 flex flex-col overflow-hidden relative shadow-sm border border-gray-100 dark:border-gray-800 group ${
                  pData.box3Align === 'left' ? 'items-start text-left' : 
                  pData.box3Align === 'right' ? 'items-end text-right' : 'items-center text-center'
                } justify-center min-h-[400px]`}
              >
                {pData.box3Image && (
                  <div className="absolute inset-0 z-0">
                    <img src={pData.box3Image} alt="Feature" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                  </div>
                )}
                <div className="z-10 relative flex flex-col" style={{ color: pData.box3TextColor || (pData.box3Image ? '#ffffff' : 'inherit') }}>
                  {pData.box3ShowIcon !== false && <Wifi size={48} className={`mb-6 ${!pData.box3Image && !pData.box3TextColor ? 'text-green-500' : ''}`} />}
                  {pData.box3Title && <h3 className="text-2xl font-bold mb-2">{pData.box3Title}</h3>}
                  {pData.box3Desc && <p className="opacity-80">{pData.box3Desc}</p>}
                </div>
              </motion.div>

              {/* Bento Item 4: Large Feature */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: 0.1 }}
                className={`md:col-span-2 bg-gradient-to-br from-gray-900 to-black rounded-[2rem] p-10 flex flex-col overflow-hidden relative text-white shadow-xl group ${
                  pData.box4Align === 'center' ? 'items-center text-center' : 
                  pData.box4Align === 'right' ? 'items-end text-right' : 'items-start text-left'
                } justify-center min-h-[400px]`}
              >
                {pData.box4Image && (
                  <div className="absolute inset-0 z-0">
                    <img src={pData.box4Image} alt="Feature" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                  </div>
                )}
                 <div className="z-10 relative max-w-md flex flex-col" style={{ color: pData.box4TextColor || '#ffffff' }}>
                  {pData.box4ShowIcon !== false && <Play size={40} className="mb-6 text-red-500" />}
                  {pData.box4Title && <h3 className="text-3xl font-bold mb-2">{pData.box4Title}</h3>}
                  {pData.box4Desc && <p className="text-lg opacity-80">{pData.box4Desc}</p>}
                </div>
                {/* Abstract background element */}
                {!pData.box4Image && <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-blue-600/20 to-transparent blur-3xl"></div>}
              </motion.div>
            </>
          )}
        </div>
      </section>
      
      {/* Sticky Buy Bar (appears when scrolling past hero) */}
      <div className="sticky bottom-4 z-[100] w-full flex justify-center pointer-events-none mt-4">
        <AnimatePresence>
          {showStickyBar && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white/90 dark:bg-black/90 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl w-[90%] max-w-xl justify-between md:w-auto pointer-events-auto"
            >
              <div className="flex items-center gap-4">
                <span className="font-bold hidden md:block truncate max-w-[150px]">{product.name}</span>
                <span className="font-bold text-xl">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(currentPrice)}</span>
              </div>
              <button 
                onClick={() => {
                  console.log("Sticky Buy Button Clicked, isUnavailable:", isUnavailable);
                  onBuyNow();
                }}
                className="bg-primary text-white px-6 py-2 rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <ShoppingCart size={18} />
                Comprar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PremiumBentoLayout;
