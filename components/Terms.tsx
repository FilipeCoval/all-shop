

import React from 'react';
import { STORE_NAME } from '../constants';
import { ShieldCheck, Truck, RefreshCw, FileText } from 'lucide-react';

const Terms: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl animate-fade-in">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-blue-50 rounded-full text-primary mb-4">
            <FileText size={32} />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Termos e Condições</h1>
        <p className="text-gray-500">Última atualização: {new Date().getFullYear()}</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8 text-gray-700 leading-relaxed">
        
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            1. Introdução
          </h2>
          <p>
            Bem-vindo à <strong>{STORE_NAME}</strong>. Ao aceder ao nosso site e realizar compras, concorda com os termos aqui descritos. 
            Estes termos aplicam-se a todos os visitantes e utilizadores do serviço.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            2. Produtos e Preços
          </h2>
          <p className="mb-2">
            Todos os preços apresentados incluem IVA à taxa legal em vigor, salvo indicação em contrário. 
            Esforçamo-nos por garantir que todos os detalhes, descrições e preços dos produtos apresentados estejam corretos.
          </p>
          <p>
            Reservamo-nos o direito de alterar preços e especificações sem aviso prévio. Em caso de erro informático 
            no preço, a encomenda poderá ser cancelada.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Truck size={20} className="text-primary" /> 3. Envios e Entregas
          </h2>
          <p>
            Oferecemos portes de envio para Portugal Continental e Ilhas em encomendas <strong>superiores a 50€</strong>. 
            Para encomendas de valor inferior, será calculada a taxa de envio no checkout.
            O tempo estimado de entrega é de 1 a 3 dias úteis para o Continente e até 5 dias úteis para as Ilhas.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ShieldCheck size={20} className="text-green-600" /> 4. Garantia
          </h2>
          <p>
            Todos os equipamentos novos comercializados pela {STORE_NAME} beneficiam de uma garantia de conformidade de <strong>3 Anos</strong> 
            (Decreto-Lei n.º 84/2021), a contar da data de entrega do bem.
          </p>
          <p className="mt-2 text-sm bg-gray-50 p-3 rounded-lg border border-gray-200">
            <strong>Exclusões:</strong> A garantia não cobre danos causados por mau uso, quedas, humidade, ou alterações de software 
            (ex: instalação de firmware não oficial) que comprometam o funcionamento do equipamento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <RefreshCw size={20} className="text-orange-500" /> 5. Devoluções e Direito de Livre Resolução
          </h2>
          <p>
            O cliente tem o direito de devolver o produto num prazo de <strong>14 dias</strong> após a receção, sem necessidade de justificação, 
            desde que o produto se encontre nas condições originais, com a embalagem intacta e todos os acessórios.
          </p>
          <p className="mt-2">
            Os custos de devolução ficam a cargo do cliente, exceto em caso de defeito ou erro no envio.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            6. Lei Aplicável
          </h2>
          <p>
            Estes termos regem-se pela lei portuguesa. Para a resolução de qualquer litígio, é competente o foro da comarca de Lisboa, 
            com renúncia expressa a qualquer outro.
          </p>
        </section>

      </div>
    </div>
  );
};

export default Terms;
