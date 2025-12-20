
import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, MessageCircle, Truck, CreditCard, ShieldCheck } from 'lucide-react';
import { SELLER_PHONE } from '../constants';

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Como faço uma encomenda?",
      answer: "É muito simples! Adicione os produtos ao carrinho, clique em 'Finalizar Compra' e escolha se prefere enviar o pedido via WhatsApp ou Telegram. A nossa equipa irá confirmar o stock e os dados de envio consigo em tempo real."
    },
    {
      question: "Quais são os métodos de pagamento aceites?",
      answer: "Aceitamos os principais métodos de pagamento em Portugal: MB Way, Referência Multibanco, Cartões (Visa e Mastercard), Transferência Bancária e o nosso popular Pagamento à Cobrança (paga apenas quando o estafeta entregar a encomenda)."
    },
    {
      question: "Quanto tempo demora a entrega?",
      answer: "Para Portugal Continental, as entregas são feitas geralmente em 24h a 48h úteis após o envio. Para as Ilhas, o prazo pode variar entre 3 a 5 dias úteis."
    },
    {
      question: "Os produtos têm garantia?",
      answer: "Sim! Todos os equipamentos novos têm garantia de 3 Anos, conforme a lei portuguesa. Guarde o comprovativo de compra/fatura para acionar a garantia se necessário."
    },
    {
      question: "Posso levantar a encomenda em mão?",
      answer: "Sim, temos opção de entrega em mão na zona de Lisboa mediante agendamento prévio. Ao falar connosco no checkout, indique essa preferência."
    },
    {
      question: "Enviam o número de seguimento (Tracking)?",
      answer: "Sim. Assim que a encomenda for expedida pelos CTT ou transportadora, enviamos o código de rastreio para que possa acompanhar a entrega."
    }
  ];

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl animate-fade-in">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-full text-indigo-600 mb-4">
            <HelpCircle size={32} />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Perguntas Frequentes</h1>
        <p className="text-gray-600">
            Reunimos as dúvidas mais comuns dos nossos clientes. <br/>
            Se não encontrar a resposta aqui, fale connosco no WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center">
              <Truck className="mx-auto text-blue-500 mb-3" size={24} />
              <h3 className="font-bold text-gray-900">Entregas Rápidas</h3>
              <p className="text-sm text-gray-500 mt-1">1-3 dias úteis</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center">
              <CreditCard className="mx-auto text-green-500 mb-3" size={24} />
              <h3 className="font-bold text-gray-900">Vários Métodos</h3>
              <p className="text-sm text-gray-500 mt-1">Cartão, MB Way e Cobrança</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center">
              <ShieldCheck className="mx-auto text-indigo-500 mb-3" size={24} />
              <h3 className="font-bold text-gray-900">Garantia 3 Anos</h3>
              <p className="text-sm text-gray-500 mt-1">Em todos os produtos</p>
          </div>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <div 
            key={idx} 
            className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${openIndex === idx ? 'border-primary shadow-md' : 'border-gray-200 hover:border-blue-300'}`}
          >
            <button 
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
            >
                <span className={`font-bold text-lg ${openIndex === idx ? 'text-primary' : 'text-gray-800'}`}>
                    {faq.question}
                </span>
                {openIndex === idx ? <ChevronUp className="text-primary" /> : <ChevronDown className="text-gray-400" />}
            </button>
            
            <div 
                className={`px-6 text-gray-600 leading-relaxed transition-all duration-300 ease-in-out ${openIndex === idx ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}
            >
                {faq.answer}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 bg-gray-50 rounded-2xl p-8 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Ainda tem dúvidas?</h3>
          <p className="text-gray-600 mb-6">A nossa equipa de suporte está disponível para ajudar.</p>
          <a 
            href={`https://wa.me/${SELLER_PHONE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg shadow-green-200"
          >
              <MessageCircle size={20} /> Falar no WhatsApp
          </a>
      </div>
    </div>
  );
};

export default FAQ;
