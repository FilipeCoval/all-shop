import React from 'react';
import { Target, Heart, Users, Award } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="animate-fade-in">
      {/* Header Banner */}
      <div className="bg-secondary text-white py-20 relative overflow-hidden">
         <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10"></div>
         <div className="container mx-auto px-4 relative z-10 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Sobre a Allshop</h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                A ligar você ao futuro através da tecnologia mais inovadora do mercado.
            </p>
         </div>
      </div>

      {/* Story Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6 relative">
                    A Nossa História
                    <span className="absolute bottom-0 left-0 w-20 h-1 bg-primary rounded-full"></span>
                </h2>
                <div className="space-y-4 text-gray-600 leading-relaxed">
                    <p>
                        Fundada em 2023, a Allshop nasceu de uma paixão simples: tornar a tecnologia de ponta acessível a todos. 
                        Começámos como uma pequena startup e hoje tornámo-nos referência em e-commerce de eletrónica na Europa.
                    </p>
                    <p>
                        Acreditamos que a tecnologia não é apenas sobre especificações técnicas, mas sobre como ela pode melhorar 
                        a vida das pessoas, facilitando o trabalho, melhorando a saúde e proporcionando entretenimento de qualidade.
                    </p>
                    <p>
                        A nossa curadoria é feita por especialistas que testam e aprovam cada item do catálogo, garantindo que você 
                        leve para casa apenas o melhor.
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <img src="https://images.unsplash.com/photo-1531297461136-82af022f0b7f?auto=format&fit=crop&q=80" alt="Tech office" className="rounded-2xl shadow-lg w-full h-64 object-cover mt-8" />
                <img src="https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80" alt="Team meeting" className="rounded-2xl shadow-lg w-full h-64 object-cover" />
            </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">Os Nossos Valores</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                    { icon: Target, title: 'Inovação', text: 'Sempre em busca do que há de mais novo.' },
                    { icon: Heart, title: 'Paixão', text: 'Amamos o que fazemos e isso reflete-se no serviço.' },
                    { icon: Users, title: 'Cliente Foco', text: 'A sua satisfação é a nossa prioridade número um.' },
                    { icon: Award, title: 'Excelência', text: 'Qualidade em produtos e atendimento.' }
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