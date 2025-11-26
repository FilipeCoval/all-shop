
import React from 'react';
import { Target, Heart, Users, Award } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="animate-fade-in">
      {/* Header Banner */}
      <div className="bg-secondary text-white py-20 relative overflow-hidden">
         <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20"></div>
         <div className="container mx-auto px-4 relative z-10 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Sobre a Allshop</h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Especialistas em tecnologia que simplifica a sua vida.
            </p>
         </div>
      </div>

      {/* Story Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6 relative">
                    A Nossa Missão
                    <span className="absolute bottom-0 left-0 w-20 h-1 bg-primary rounded-full"></span>
                </h2>
                <div className="space-y-4 text-gray-600 leading-relaxed text-justify">
                    <p>
                        A Allshop nasceu de uma frustração comum: a dificuldade em encontrar equipamentos de streaming e gadgets de qualidade em Portugal, sem ter de esperar semanas por encomendas vindas de fora ou lidar com alfândegas.
                    </p>
                    <p>
                        Não somos apenas uma loja online; somos entusiastas de tecnologia. A nossa equipa testa exaustivamente cada <strong>TV Box, cabo e acessório</strong> antes de o colocar à venda. Acreditamos na filosofia: <em>"Se não serve para a nossa casa, não serve para a do cliente."</em>
                    </p>
                    <p>
                        O nosso foco é a especialização. Enquanto as grandes superfícies vendem de tudo, nós focamo-nos no que sabemos fazer bem: garantir que tem a melhor imagem na sua TV e a internet mais rápida, com stock real e envio imediato.
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {/* Imagem 1: Tech / Setup */}
                <img 
                    src="https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80" 
                    alt="Eletrónica e Chips" 
                    className="rounded-2xl shadow-lg w-full h-64 object-cover mt-8 hover:scale-105 transition-transform duration-500" 
                />
                {/* Imagem 2: Logística / Caixas / Armazém */}
                <img 
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80" 
                    alt="Armazém e Logística" 
                    className="rounded-2xl shadow-lg w-full h-64 object-cover hover:scale-105 transition-transform duration-500" 
                />
            </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">Porquê a Allshop?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                    { icon: Target, title: 'Curadoria', text: 'Não vendemos tudo. Vendemos o que funciona e tem qualidade comprovada.' },
                    { icon: Heart, title: 'Transparência', text: 'Sem taxas escondidas. O que vê é o que paga, com fatura e garantia.' },
                    { icon: Users, title: 'Proximidade', text: 'Atendimento humano via WhatsApp ou Telegram. Falamos a sua língua.' },
                    { icon: Award, title: 'Rapidez', text: 'Stock nacional. Encomendas enviadas rapidamente para chegar até si.' }
                ].map((item, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center hover:transform hover:-translate-y-1 transition-all duration-300">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-primary mb-4">
                            <item.icon size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                        <p className="text-gray-600">{item.text}</p>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default About;
