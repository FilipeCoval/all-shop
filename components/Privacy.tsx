
import React from 'react';
import { STORE_NAME } from '../constants';
import { Lock, Eye, Database, Cookie } from 'lucide-react';

const Privacy: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl animate-fade-in">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-green-50 rounded-full text-green-600 mb-4">
            <Lock size={32} />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
        <p className="text-gray-500">O seu dados estão seguros connosco.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8 text-gray-700 leading-relaxed">
        
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-900 text-sm">
            Na <strong>{STORE_NAME}</strong>, respeitamos a sua privacidade e agradecemos a confiança que deposita em nós. 
            Nesta Política de Privacidade explicamos quem somos, para que finalidades podemos usar os seus dados e como os tratamos.
        </div>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Database size={20} className="text-primary" /> 1. Recolha de Dados
          </h2>
          <p>
            Recolhemos apenas os dados estritamente necessários para processar as suas encomendas e melhorar a sua experiência. 
            Isto inclui:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Nome e contactos (email, telefone) para gestão de clientes.</li>
            <li>Morada para efeitos de envio e faturação.</li>
            <li>Histórico de compras para efeitos de garantia e suporte.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Eye size={20} className="text-primary" /> 2. Utilização dos Dados
          </h2>
          <p>
            Os seus dados são utilizados para:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Processamento de encomendas e envio.</li>
            <li>Serviço de Apoio ao Cliente (garantias, dúvidas).</li>
            <li>Envio de newsletters ou promoções (apenas se consentir explicitamente).</li>
          </ul>
          <p className="mt-2 font-medium">
            Nunca vendemos os seus dados a terceiros.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Cookie size={20} className="text-primary" /> 3. Cookies
          </h2>
          <p>
            Utilizamos cookies para melhorar a navegação no site (ex: manter o carrinho de compras ativo). 
            Pode desativar os cookies no seu navegador, mas algumas funcionalidades da loja podem deixar de funcionar corretamente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            4. Os seus Direitos (RGPD)
          </h2>
          <p>
            Ao abrigo do Regulamento Geral de Proteção de Dados (RGPD), tem o direito de:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Aceder aos dados que temos sobre si.</li>
            <li>Solicitar a retificação de dados incorretos.</li>
            <li>Solicitar o apagamento dos seus dados ("Direito a ser esquecido").</li>
          </ul>
          <p className="mt-2">
            Para exercer estes direitos, basta contactar-nos através do email de suporte ou na sua Área de Cliente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            5. Contacto
          </h2>
          <p>
            Se tiver dúvidas sobre a nossa política de privacidade, entre em contacto connosco através da página de Contactos.
          </p>
        </section>

      </div>
    </div>
  );
};

export default Privacy;
